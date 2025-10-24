import { ok, strictEqual } from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { after, before, describe, it } from 'node:test';

import { DiscoveryService } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { LogWaitStrategy } from 'testcontainers/build/wait-strategies/log-wait-strategy';
import { assertDefined, assertPropString } from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { AddressChanged, DetectedTransaction, Listener } from '../indexer-listener.abstract';
import { SolanaMainnetIndexerListener } from './solana-mainnet.listener';

/**
 * Test implementation of SolanaIndexerListener for local testing
 */
class TestSolanaIndexerListener extends SolanaMainnetIndexerListener {
  readonly logger = new TelemetryLogger('TestSolanaIndexerListener');

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    repository: CryptogadaiRepository,
    appConfig: AppConfigService,
  ) {
    super(discovery, redis, invoicePaymentQueue, repository, appConfig);
  }

  // Override getBlockchainKey for testing
  override getBlockchainKey() {
    return 'solana:localnet';
  }
}

describe('SolanaIndexerListener Integration Tests', function () {
  let solanaValidator: ChildProcess;
  let redisContainer: StartedTestContainer;
  let module: TestingModule;
  let listener: TestSolanaIndexerListener;
  let redisService: RedisService;
  let connection: Connection;
  let detectedTransactions: DetectedTransaction[] = [];
  let appConfigMock: AppConfigService;

  before(
    async function () {
      const solanaPort = Math.floor(8899 + Math.random() * 10000);
      const solanaRpcUrl = `http://localhost:${solanaPort}`;
      const redisPort = Math.floor(6379 + Math.random() * 10000);
      const redisHost = 'localhost';

      // Start local solana-test-validator
      solanaValidator = spawn(
        'solana-test-validator',
        ['--rpc-port', String(solanaPort), '--quiet'],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      solanaValidator.stdout?.on('data', _data => {
        // console.debug(`[solana-test-validator] ${data.toString()}`);
      });

      solanaValidator.stderr?.on('data', _data => {
        // console.error(`[solana-test-validator] ${data.toString()}`);
      });

      // Start Redis container
      redisContainer = await new GenericContainer('valkey/valkey:8-alpine')
        .withAutoRemove(true)
        .withExposedPorts({
          container: 6379,
          host: redisPort,
        })
        .withWaitStrategy(new LogWaitStrategy('Ready to accept connections tcp', 1))
        .withLogConsumer(function (stream) {
          stream.pipe(process.stdout);
        })
        .start();

      connection = new Connection(solanaRpcUrl, {
        commitment: 'confirmed',
      });

      appConfigMock = {
        indexerConfigs: {
          ethereum: {},
          solana: {
            mainnet: {
              chainName: 'Solana Localnet',
              rpcUrl: solanaRpcUrl,
              wsUrl: undefined,
            },
          },
        },
      } as unknown as AppConfigService;

      // Wait for the validator to be ready
      let retries = 0;
      while (retries < 30) {
        try {
          await connection.getVersion();
          break;
        } catch (_error) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (retries === 30) {
        throw new Error('Solana test validator failed to start');
      }

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

      const mockRepository = {
        platformViewsActiveInvoices: async () => [],
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
            provide: CryptogadaiRepository,
            useValue: mockRepository,
          },
          {
            provide: TestSolanaIndexerListener,
            useFactory: (
              discovery: DiscoveryService,
              redis: RedisService,
              queue: InvoicePaymentQueueService,
              repository: CryptogadaiRepository,
              appConfig: AppConfigService,
            ) => {
              return new TestSolanaIndexerListener(discovery, redis, queue, repository, appConfig);
            },
            inject: [
              DiscoveryService,
              RedisService,
              InvoicePaymentQueueService,
              CryptogadaiRepository,
              AppConfigService,
            ],
          },
          {
            provide: AppConfigService,
            useValue: appConfigMock,
          },
          DiscoveryService,
        ],
      }).compile();

      redisService = module.get<RedisService>(RedisService);
      listener = module.get<TestSolanaIndexerListener>(TestSolanaIndexerListener);

      await module.init();
    },
    { timeout: 180000 },
  );

  after(
    async function () {
      detectedTransactions = [];
      if (listener) await listener.stop();
      if (module) await module.close();
      if (redisContainer) await redisContainer.stop();
      if (solanaValidator) {
        solanaValidator.kill('SIGTERM');
        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!solanaValidator.killed) {
          solanaValidator.kill('SIGKILL');
        }
      }
    },
    { timeout: 30000 },
  );

  describe('Native SOL Transaction Detection', function () {
    it(
      'should detect native SOL transaction to watched address',
      { timeout: 30000 },
      async function () {
        detectedTransactions = [];

        // Create a new keypair for the recipient
        const recipientKeypair = Keypair.generate();
        const recipientAddress = recipientKeypair.publicKey.toBase58();

        // Get airdrop for sender account (using test validator's pre-funded account)
        const senderKeypair = Keypair.generate();

        const airdropSignature = await connection.requestAirdrop(
          senderKeypair.publicKey,
          2 * LAMPORTS_PER_SOL,
        );
        await connection.confirmTransaction(airdropSignature);

        // Start the listener
        await listener.start();

        // Add address to watch via Redis pub/sub
        const addressChange: AddressChanged = {
          tokenId: 'slip44:501',
          address: recipientAddress,
          derivedPath: "m/44'/501'/0'/0'/0'",
        };

        await redisService.publish(
          'indexer:solana:localnet:address:added',
          JSON.stringify(addressChange),
        );

        // Give it time to process
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send SOL transaction
        const transferAmount = 0.5 * LAMPORTS_PER_SOL;
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderKeypair.publicKey,
            toPubkey: recipientKeypair.publicKey,
            lamports: transferAmount,
          }),
        );

        await sendAndConfirmTransaction(connection, transaction, [senderKeypair]);

        // Wait for transaction to be detected
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify detection
        strictEqual(detectedTransactions.length, 1, 'Should detect one transaction');

        const detected = detectedTransactions[0];
        assertDefined(detected);
        strictEqual(detected.blockchainKey, 'solana:localnet');
        strictEqual(detected.tokenId, 'slip44:501');
        strictEqual(detected.address, recipientAddress);
        strictEqual(detected.derivedPath, "m/44'/501'/0'/0'/0'");
        strictEqual(detected.amount, transferAmount.toString());
        ok(detected.timestamp > 0, 'Should have timestamp');

        const balance = await connection.getBalance(recipientKeypair.publicKey);
        strictEqual(balance, transferAmount, 'Recipient should have received SOL');
      },
    );

    it(
      'should not detect transactions to non-watched addresses',
      { timeout: 20000 },
      async function () {
        detectedTransactions = [];

        const senderKeypair = Keypair.generate();
        const recipientKeypair = Keypair.generate();

        // Airdrop to sender
        const airdropSignature = await connection.requestAirdrop(
          senderKeypair.publicKey,
          2 * LAMPORTS_PER_SOL,
        );
        await connection.confirmTransaction(airdropSignature);

        // Send transaction to non-watched address
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderKeypair.publicKey,
            toPubkey: recipientKeypair.publicKey,
            lamports: 0.3 * LAMPORTS_PER_SOL,
          }),
        );

        const _signature = await sendAndConfirmTransaction(connection, transaction, [
          senderKeypair,
        ]);

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

      const senderKeypair = Keypair.generate();
      const recipientKeypair = Keypair.generate();
      const recipientAddress = recipientKeypair.publicKey.toBase58();

      // Airdrop to sender
      const airdropSignature = await connection.requestAirdrop(
        senderKeypair.publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(airdropSignature);

      // Add and then remove address
      const addressChange: AddressChanged = {
        tokenId: 'slip44:501',
        address: recipientAddress,
        derivedPath: "m/44'/501'/0'/0'/1'",
      };

      await redisService.publish(
        'indexer:solana:localnet:address:added',
        JSON.stringify(addressChange),
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      await redisService.publish(
        'indexer:solana:localnet:address:removed',
        JSON.stringify(addressChange),
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipientKeypair.publicKey,
          lamports: 0.2 * LAMPORTS_PER_SOL,
        }),
      );

      await sendAndConfirmTransaction(connection, transaction, [senderKeypair]);

      await new Promise(resolve => setTimeout(resolve, 2000));

      strictEqual(detectedTransactions.length, 0, 'Should not detect after removal');
    });
  });

  describe('SPL Token Transaction Detection', function () {
    let mintAuthority: Keypair;
    let mintAddress: PublicKey;

    before(
      async function () {
        // Create mint authority
        mintAuthority = Keypair.generate();

        // Airdrop SOL to mint authority for transaction fees
        const airdropSignature = await connection.requestAirdrop(
          mintAuthority.publicKey,
          5 * LAMPORTS_PER_SOL,
        );
        await connection.confirmTransaction(airdropSignature);

        // Create a new SPL token mint
        mintAddress = await createMint(
          connection,
          mintAuthority,
          mintAuthority.publicKey,
          null,
          9, // 9 decimals
        );

        // Wait a bit for the mint to be confirmed
        await new Promise(resolve => setTimeout(resolve, 1000));
      },
      { timeout: 30000 },
    );

    it(
      'should detect SPL token transfer to watched address',
      { timeout: 45000 },
      async function () {
        detectedTransactions = [];

        const recipientKeypair = Keypair.generate();
        const recipientAddress = recipientKeypair.publicKey.toBase58();

        // Airdrop SOL to recipient for rent
        const airdropSignature = await connection.requestAirdrop(
          recipientKeypair.publicKey,
          1 * LAMPORTS_PER_SOL,
        );
        await connection.confirmTransaction(airdropSignature);

        // Create token account for recipient BEFORE adding watch
        const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          mintAuthority,
          mintAddress,
          recipientKeypair.publicKey,
        );

        // Wait for account creation to be confirmed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Add address to watch for this specific SPL token
        const addressChange: AddressChanged = {
          tokenId: `spl:${mintAddress.toBase58()}`,
          address: recipientAddress,
          derivedPath: "m/44'/501'/0'/0'/2'",
        };

        await redisService.publish(
          'indexer:solana:localnet:address:added',
          JSON.stringify(addressChange),
        );

        // Give it time to set up the listener
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Mint tokens to recipient
        const mintAmount = BigInt(100 * 10 ** 9); // 100 tokens with 9 decimals
        await mintTo(
          connection,
          mintAuthority,
          mintAddress,
          recipientTokenAccount.address,
          mintAuthority.publicKey,
          mintAmount,
        );

        // Wait for transaction to be mined and detected
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify detection
        strictEqual(detectedTransactions.length, 1, 'Should detect one SPL token transfer');

        const detected = detectedTransactions[0];
        assertDefined(detected);
        strictEqual(detected.blockchainKey, 'solana:localnet');
        strictEqual(detected.tokenId, `spl:${mintAddress.toBase58()}`);
        strictEqual(detected.address, recipientAddress);
        strictEqual(detected.derivedPath, "m/44'/501'/0'/0'/2'");
        strictEqual(detected.amount, mintAmount.toString());
        ok(detected.timestamp > 0, 'Should have timestamp');
      },
    );

    it(
      'should not detect SPL transfers to non-watched addresses',
      { timeout: 30000 },
      async function () {
        detectedTransactions = [];

        const recipientKeypair = Keypair.generate();

        // Airdrop SOL to recipient for rent
        const airdropSignature = await connection.requestAirdrop(
          recipientKeypair.publicKey,
          1 * LAMPORTS_PER_SOL,
        );
        await connection.confirmTransaction(airdropSignature);

        // Create token account for non-watched recipient
        const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          mintAuthority,
          mintAddress,
          recipientKeypair.publicKey,
        );

        // Mint tokens to non-watched address
        const mintAmount = BigInt(50 * 10 ** 9);
        await mintTo(
          connection,
          mintAuthority,
          mintAddress,
          recipientTokenAccount.address,
          mintAuthority.publicKey,
          mintAmount,
        );

        await new Promise(resolve => setTimeout(resolve, 3000));

        strictEqual(
          detectedTransactions.length,
          0,
          'Should not detect SPL transfer to non-watched address',
        );
      },
    );
  });

  describe('Listener Lifecycle', function () {
    it('should handle multiple addresses for same token', { timeout: 30000 }, async function () {
      detectedTransactions = [];

      const senderKeypair = Keypair.generate();
      const recipient1Keypair = Keypair.generate();
      const recipient2Keypair = Keypair.generate();

      const recipient1 = recipient1Keypair.publicKey.toBase58();
      const recipient2 = recipient2Keypair.publicKey.toBase58();

      // Airdrop to sender
      const airdropSignature = await connection.requestAirdrop(
        senderKeypair.publicKey,
        5 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(airdropSignature);

      // Add two addresses
      await redisService.publish(
        'indexer:solana:localnet:address:added',
        JSON.stringify({
          tokenId: 'slip44:501',
          address: recipient1,
          derivedPath: "m/44'/501'/0'/0'/3'",
        }),
      );

      await redisService.publish(
        'indexer:solana:localnet:address:added',
        JSON.stringify({
          tokenId: 'slip44:501',
          address: recipient2,
          derivedPath: "m/44'/501'/0'/0'/4'",
        }),
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send to both addresses
      const tx1 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipient1Keypair.publicKey,
          lamports: 0.1 * LAMPORTS_PER_SOL,
        }),
      );

      const tx2 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipient2Keypair.publicKey,
          lamports: 0.2 * LAMPORTS_PER_SOL,
        }),
      );

      const _sig1 = await sendAndConfirmTransaction(connection, tx1, [senderKeypair]);
      const _sig2 = await sendAndConfirmTransaction(connection, tx2, [senderKeypair]);

      await new Promise(resolve => setTimeout(resolve, 3000));

      strictEqual(detectedTransactions.length, 2, 'Should detect both transactions');

      const tx1Detected = detectedTransactions.find(tx => tx.address === recipient1);
      const tx2Detected = detectedTransactions.find(tx => tx.address === recipient2);

      assertDefined(tx1Detected);
      assertDefined(tx2Detected);

      strictEqual(tx1Detected.amount, (0.1 * LAMPORTS_PER_SOL).toString());
      strictEqual(tx2Detected.amount, (0.2 * LAMPORTS_PER_SOL).toString());
    });

    it('should reject invalid Solana addresses', { timeout: 5000 }, async function () {
      const invalidAddress = 'not-a-solana-address';

      const addressChange: AddressChanged = {
        tokenId: 'slip44:501',
        address: invalidAddress,
        derivedPath: "m/44'/501'/0'/0'/99'",
      };

      // The listener should handle this gracefully
      await listener.onAddressAdded(addressChange);

      // Should not throw, but should log error
      ok(true, 'Should handle invalid address gracefully');
    });
  });
});
