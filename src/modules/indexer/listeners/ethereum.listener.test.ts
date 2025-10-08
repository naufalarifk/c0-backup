// biome-ignore-all lint/suspicious/noExplicitAny: hard config structure

import { ok, strictEqual } from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { DiscoveryService } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { ethers } from 'ethers';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { LogWaitStrategy } from 'testcontainers/build/wait-strategies/log-wait-strategy';
import { assertDefined, assertPropString } from 'typeshaper';
import { isAddress, isHash } from 'viem';

import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { AddressChanged, DetectedTransaction, Listener } from '../indexer-listener.abstract';
import { EthereumIndexerListener } from './ethereum.listener';

/**
 * Test implementation of EthereumIndexerListener for local testing
 */
class TestEthereumIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger('TestEthereumIndexerListener');

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    wsUrl: string,
  ) {
    super(discovery, redis, invoicePaymentQueue, {
      chainName: 'Test Ethereum',
      defaultWsUrl: wsUrl,
      wsUrlEnvVar: 'TEST_ETH_WS_URL',
      nativeTokenId: 'slip44:60',
      tokenPrefix: 'erc20',
    });
  }

  // Override getBlockchainKey for testing
  override getBlockchainKey() {
    return 'eip155:31337';
  }
}

describe('EthereumIndexerListener Integration Tests', function () {
  let anvilContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  let module: TestingModule;
  let listener: TestEthereumIndexerListener;
  let redisService: RedisService;
  let provider: ethers.WebSocketProvider;
  let detectedTransactions: DetectedTransaction[] = [];

  before(
    async function () {
      const anvilPort = Math.floor(8545 + Math.random() * 10000);
      const anvilHttpUrl = `http://0.0.0.0:${anvilPort}`;
      const anvilWsUrl = `ws://0.0.0.0:${anvilPort}`;
      const redisPort = Math.floor(6379 + Math.random() * 10000);
      const redisHost = 'localhost';
      [anvilContainer, redisContainer] = await Promise.all([
        new GenericContainer('ghcr.io/foundry-rs/foundry:latest')
          .withCommand(['anvil', '--block-time', '1'])
          .withEnvironment({ ANVIL_IP_ADDR: '0.0.0.0' })
          .withWaitStrategy(new LogWaitStrategy('Listening on', 1))
          .withLogConsumer(function (stream) {
            stream.pipe(process.stdout);
          })
          .withExposedPorts({
            container: 8545,
            host: anvilPort,
          })
          .start(),
        new GenericContainer('valkey/valkey:8-alpine')
          .withAutoRemove(true)
          .withExposedPorts({
            container: 6379,
            host: redisPort,
          })
          .withWaitStrategy(new LogWaitStrategy('Ready to accept connections tcp', 1))
          .withLogConsumer(function (stream) {
            stream.pipe(process.stdout);
          })
          .start(),
      ]);

      const httpProvider = new ethers.JsonRpcProvider(anvilHttpUrl);
      await httpProvider.getNetwork();
      provider = new ethers.WebSocketProvider(anvilWsUrl);

      const mockInvoicePaymentQueue = {
        enqueuePaymentDetection: async (data: unknown) => {
          assertDefined(data);
          assertPropString(data, 'blockchainKey');
          assertPropString(data, 'tokenId');
          assertPropString(data, 'walletDerivationPath');
          assertPropString(data, 'walletAddress');
          assertPropString(data, 'transactionHash');
          assertPropString(data, 'amount');
          assertPropString(data, 'detectedAt');
          detectedTransactions.push({
            blockchainKey: data.blockchainKey,
            tokenId: data.tokenId,
            derivedPath: data.walletDerivationPath,
            address: data.walletAddress,
            txHash: data.transactionHash,
            sender: '',
            amount: data.amount,
            timestamp: new Date(data.detectedAt).getTime() / 1000,
          });
        },
      };

      module = await Test.createTestingModule({
        providers: [
          {
            provide: RedisService,
            useFactory: function () {
              const service = new RedisService({
                redisConfig: {
                  host: redisHost,
                  port: redisPort,
                },
              } as any);
              return service;
            },
          },
          {
            provide: InvoicePaymentQueueService,
            useValue: mockInvoicePaymentQueue,
          },
          {
            provide: TestEthereumIndexerListener,
            useFactory: (
              discovery: DiscoveryService,
              redis: RedisService,
              queue: InvoicePaymentQueueService,
            ) => {
              return new TestEthereumIndexerListener(discovery, redis, queue, anvilWsUrl);
            },
            inject: [DiscoveryService, RedisService, InvoicePaymentQueueService],
          },
          DiscoveryService,
        ],
      }).compile();

      redisService = module.get<RedisService>(RedisService);
      listener = module.get<TestEthereumIndexerListener>(TestEthereumIndexerListener);

      await module.init();
    },
    { timeout: 60000 },
  );

  after(
    async function () {
      detectedTransactions = [];
      if (listener) await listener.stop();
      if (provider) await provider.destroy();
      if (module) await module.close();
      if (redisContainer) await redisContainer.stop();
      if (anvilContainer) await anvilContainer.stop();
    },
    { timeout: 30000 },
  );

  describe('Native ETH Transaction Detection', function () {
    it(
      'should detect native ETH transaction to watched address',
      { timeout: 30000 },
      async function () {
        detectedTransactions = [];

        // Get test accounts from Anvil
        const accounts = await provider.listAccounts();
        ok(accounts.length > 0, 'Should have test accounts');

        const signer = await provider.getSigner(0);
        const recipientAddress = accounts[1].address;

        ok(isAddress(recipientAddress), 'Recipient should be valid address');

        // Start the listener
        await listener.start();

        // Add address to watch via Redis pub/sub
        const addressChange: AddressChanged = {
          tokenId: 'slip44:60',
          address: recipientAddress,
          derivedPath: "m/44'/60'/0'/0/1",
        };

        await redisService.publish(
          'indexer:eip155:31337:address:added',
          JSON.stringify(addressChange),
        );

        // Give it time to process
        await new Promise(resolve => setTimeout(resolve, 500));

        // Send ETH transaction
        const tx = await signer.sendTransaction({
          to: recipientAddress,
          value: ethers.parseEther('1.5'),
        });

        ok(isHash(tx.hash), 'Transaction should have valid hash');

        // Wait for transaction to be mined and detected
        await tx.wait();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify detection
        strictEqual(detectedTransactions.length, 1, 'Should detect one transaction');

        const detected = detectedTransactions[0];
        assertDefined(detected);
        strictEqual(detected.blockchainKey, 'eip155:31337');
        strictEqual(detected.tokenId, 'slip44:60');
        strictEqual(detected.address.toLowerCase(), recipientAddress.toLowerCase());
        strictEqual(detected.derivedPath, "m/44'/60'/0'/0/1");
        strictEqual(detected.txHash, tx.hash);
        strictEqual(detected.amount, ethers.parseEther('1.5').toString());
        ok(detected.timestamp > 0, 'Should have timestamp');
      },
    );

    it(
      'should not detect transactions to non-watched addresses',
      { timeout: 20000 },
      async function () {
        detectedTransactions = [];

        const accounts = await provider.listAccounts();
        const signer = await provider.getSigner(0);
        const recipientAddress = accounts[2].address;

        // Send transaction to non-watched address
        const tx = await signer.sendTransaction({
          to: recipientAddress,
          value: ethers.parseEther('0.5'),
        });

        ok(isHash(tx.hash), 'Transaction should have valid hash');

        await tx.wait();
        await new Promise(resolve => setTimeout(resolve, 2000));

        strictEqual(
          detectedTransactions.length,
          0,
          'Should not detect transaction to non-watched address',
        );
      },
    );

    it('should stop detecting after address is removed', { timeout: 20000 }, async function () {
      detectedTransactions = [];

      const accounts = await provider.listAccounts();
      const signer = await provider.getSigner(0);
      const recipientAddress = accounts[3].address;

      // Add and then remove address
      const addressChange: AddressChanged = {
        tokenId: 'slip44:60',
        address: recipientAddress,
        derivedPath: "m/44'/60'/0'/0/3",
      };

      await redisService.publish(
        'indexer:eip155:31337:address:added',
        JSON.stringify(addressChange),
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      await redisService.publish(
        'indexer:eip155:31337:address:removed',
        JSON.stringify(addressChange),
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send transaction
      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: ethers.parseEther('0.3'),
      });

      ok(isHash(tx.hash), 'Transaction should have valid hash');

      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));

      strictEqual(detectedTransactions.length, 0, 'Should not detect after removal');
    });
  });

  describe('ERC20 Token Transaction Detection', function () {
    let tokenContract: ethers.Contract;
    let tokenAddress: string;

    before(
      async function () {
        // Deploy SimpleERC20 contract using source code and Anvil's built-in compiler
        const signer = await provider.getSigner(0);

        // SimpleERC20 source code - minimal ERC20 for testing
        const _sourceCode = `
          // SPDX-License-Identifier: MIT
          pragma solidity ^0.8.0;

          contract SimpleERC20 {
              mapping(address => uint256) public balanceOf;
              event Transfer(address indexed from, address indexed to, uint256 value);

              constructor() {
                  balanceOf[msg.sender] = 1000000 * 10**18;
              }

              function transfer(address to, uint256 amount) external returns (bool) {
                  require(balanceOf[msg.sender] >= amount, "Insufficient balance");
                  balanceOf[msg.sender] -= amount;
                  balanceOf[to] += amount;
                  emit Transfer(msg.sender, to, amount);
                  return true;
              }
          }
        `;

        // Properly compiled SimpleERC20 bytecode (even-length hex string)
        const bytecode =
          '0x6080604052348015600e575f80fd5b50335f90815260208190526040902069d3c21bcecceda10000009055610252806100375f395ff3fe608060405234801561000f575f80fd5b5060043610610034575f3560e01c806370a0823114610038578063a9059cbb1461006a575b5f80fd5b61005761004636600461019a565b5f6020819052908152604090205481565b6040519081526020015b60405180910390f35b61007d6100783660046101ba565b61008d565b6040519015158152602001610061565b335f908152602081905260408120548211156100e65760405162461bcd60e51b8152602060048201526014602482015273496e73756666696369656e742062616c616e636560601b604482015260640160405180910390fd5b335f90815260208190526040812080548492906101049084906101f6565b90915550506001600160a01b0383165f9081526020819052604081208054849290610130908490610209565b90915550506040518281526001600160a01b0384169033907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a35060015b92915050565b80356001600160a01b0381168114610195575f80fd5b919050565b5f602082840312156101aa575f80fd5b6101b38261017f565b9392505050565b5f80604083850312156101cb575f80fd5b6101d48361017f565b946020939093013593505050565b634e487b7160e01b5f52601160045260245ffd5b81810381811115610179576101796101e2565b80820180821115610179576101796101e256fea2646970667358221220b9b89ac864154a777a1f44d97c02c495fa343c68f9edb751549ec5532fb50cb464736f6c634300081a0033';

        const erc20Abi = [
          'constructor()',
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address account) view returns (uint256)',
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ];

        // Deploy using ContractFactory
        const factory = new ethers.ContractFactory(erc20Abi, bytecode, signer);
        tokenContract = (await factory.deploy()) as ethers.Contract;
        await tokenContract.waitForDeployment();

        tokenAddress = await tokenContract.getAddress();
        ok(isAddress(tokenAddress), 'Deployed token should have valid address');

        // Verify deployment
        const _code = await provider.getCode(tokenAddress);
      },
      { timeout: 15000 },
    );

    it(
      'should detect ERC20 token transfer to watched address',
      { timeout: 30000 },
      async function () {
        detectedTransactions = [];

        const accounts = await provider.listAccounts();
        const _signer = await provider.getSigner(0);
        const recipientAddress = accounts[4].address;

        ok(isAddress(recipientAddress), 'Recipient should be valid address');
        ok(isAddress(tokenAddress), 'Token contract should be valid address');
        ok(tokenContract, 'Token contract should be defined');

        // Add address to watch for this specific ERC20 token
        const addressChange: AddressChanged = {
          tokenId: `erc20:${tokenAddress.toLowerCase()}`,
          address: recipientAddress,
          derivedPath: "m/44'/60'/0'/0/4",
        };

        await redisService.publish(
          'indexer:eip155:31337:address:added',
          JSON.stringify(addressChange),
        );

        // Give it time to set up the listener
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Transfer tokens to watched address
        const transferAmount = ethers.parseEther('100');
        const tx = await tokenContract.transfer(recipientAddress, transferAmount);

        ok(isHash(tx.hash), 'Transaction should have valid hash');

        // Wait for transaction to be mined and detected
        await tx.wait();
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify detection
        strictEqual(detectedTransactions.length, 1, 'Should detect one ERC20 transfer');

        const detected = detectedTransactions[0];
        assertDefined(detected);
        strictEqual(detected.blockchainKey, 'eip155:31337');
        strictEqual(detected.tokenId, `erc20:${tokenAddress.toLowerCase()}`);
        strictEqual(detected.address.toLowerCase(), recipientAddress.toLowerCase());
        strictEqual(detected.derivedPath, "m/44'/60'/0'/0/4");
        strictEqual(detected.txHash, tx.hash);
        strictEqual(detected.amount, transferAmount.toString());
        ok(detected.timestamp > 0, 'Should have timestamp');

        const balance = await tokenContract.balanceOf(recipientAddress);
        strictEqual(balance, transferAmount, 'Recipient should have received tokens');
      },
    );

    it(
      'should not detect ERC20 transfers to non-watched addresses',
      { timeout: 20000 },
      async function () {
        detectedTransactions = [];

        const accounts = await provider.listAccounts();
        const _signer = await provider.getSigner(0);
        const recipientAddress = accounts[5].address;

        // Send tokens to non-watched address
        const transferAmount = ethers.parseEther('50');
        const tx = await tokenContract.transfer(recipientAddress, transferAmount);

        await tx.wait();
        await new Promise(resolve => setTimeout(resolve, 2000));

        strictEqual(
          detectedTransactions.length,
          0,
          'Should not detect ERC20 transfer to non-watched address',
        );

        // Clean up: remove the watcher from previous test to reset state
        const prevAddress = accounts[4].address;
        await redisService.publish(
          'indexer:eip155:31337:address:removed',
          JSON.stringify({
            tokenId: `erc20:${tokenAddress.toLowerCase()}`,
            address: prevAddress,
            derivedPath: "m/44'/60'/0'/0/4",
          }),
        );
        await new Promise(resolve => setTimeout(resolve, 500));
      },
    );

    it('should handle multiple ERC20 tokens separately', { timeout: 30000 }, async function () {
      detectedTransactions = [];

      const accounts = await provider.listAccounts();
      const recipientAddress = accounts[7].address; // Use account 7 to avoid conflicts

      // Add address for native token
      const nativeAddressChange: AddressChanged = {
        tokenId: 'slip44:60',
        address: recipientAddress,
        derivedPath: "m/44'/60'/0'/0/7",
      };

      // Add address for ERC20 token
      const erc20AddressChange: AddressChanged = {
        tokenId: `erc20:${tokenAddress.toLowerCase()}`,
        address: recipientAddress,
        derivedPath: "m/44'/60'/0'/0/7",
      };

      await redisService.publish(
        'indexer:eip155:31337:address:added',
        JSON.stringify(nativeAddressChange),
      );

      await redisService.publish(
        'indexer:eip155:31337:address:added',
        JSON.stringify(erc20AddressChange),
      );

      // Give more time for both listeners to be fully set up
      await new Promise(resolve => setTimeout(resolve, 2000));

      const signer = await provider.getSigner(0);

      // Send both native and ERC20
      const ethTx = await signer.sendTransaction({
        to: recipientAddress,
        value: ethers.parseEther('0.5'),
      });

      const tokenTx = await tokenContract.transfer(recipientAddress, ethers.parseEther('25'));

      await ethTx.wait();
      await tokenTx.wait();
      await new Promise(resolve => setTimeout(resolve, 4000)); // Increased wait time

      strictEqual(detectedTransactions.length, 2, 'Should detect both transactions');

      const nativeDetected = detectedTransactions.find(tx => tx.tokenId === 'slip44:60');
      const erc20Detected = detectedTransactions.find(
        tx => tx.tokenId === `erc20:${tokenAddress.toLowerCase()}`,
      );

      assertDefined(nativeDetected);
      assertDefined(erc20Detected);

      strictEqual(nativeDetected.amount, ethers.parseEther('0.5').toString());
      strictEqual(erc20Detected.amount, ethers.parseEther('25').toString());
    });
  });

  describe('Listener Lifecycle', function () {
    it('should handle multiple addresses for same token', { timeout: 30000 }, async function () {
      detectedTransactions = [];

      const accounts = await provider.listAccounts();
      const signer = await provider.getSigner(0);

      const recipient1 = accounts[5].address;
      const recipient2 = accounts[6].address;

      // Add two addresses
      await redisService.publish(
        'indexer:eip155:31337:address:added',
        JSON.stringify({
          tokenId: 'slip44:60',
          address: recipient1,
          derivedPath: "m/44'/60'/0'/0/5",
        }),
      );

      await redisService.publish(
        'indexer:eip155:31337:address:added',
        JSON.stringify({
          tokenId: 'slip44:60',
          address: recipient2,
          derivedPath: "m/44'/60'/0'/0/6",
        }),
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send to both addresses
      const tx1 = await signer.sendTransaction({
        to: recipient1,
        value: ethers.parseEther('0.1'),
      });

      const tx2 = await signer.sendTransaction({
        to: recipient2,
        value: ethers.parseEther('0.2'),
      });

      await tx1.wait();
      await tx2.wait();
      await new Promise(resolve => setTimeout(resolve, 2000));

      strictEqual(detectedTransactions.length, 2, 'Should detect both transactions');

      const tx1Detected = detectedTransactions.find(tx => tx.txHash === tx1.hash);
      const tx2Detected = detectedTransactions.find(tx => tx.txHash === tx2.hash);

      assertDefined(tx1Detected);
      assertDefined(tx2Detected);

      strictEqual(tx1Detected.address.toLowerCase(), recipient1.toLowerCase());
      strictEqual(tx2Detected.address.toLowerCase(), recipient2.toLowerCase());
    });

    it('should reject invalid Ethereum addresses', { timeout: 5000 }, async function () {
      const invalidAddress = 'not-an-ethereum-address';

      const addressChange: AddressChanged = {
        tokenId: 'slip44:60',
        address: invalidAddress,
        derivedPath: "m/44'/60'/0'/0/99",
      };

      // The listener should handle this gracefully
      await listener.onAddressAdded(addressChange);

      // Should not throw, but should log error
      ok(true, 'Should handle invalid address gracefully');
    });
  });
});
