// biome-ignore-all lint/suspicious/noExplicitAny: hard config structure

import { ok, strictEqual } from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { DiscoveryService } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { LogWaitStrategy } from 'testcontainers/build/wait-strategies/log-wait-strategy';
import { assertDefined, assertPropString, hasProp, isDefined } from 'typeshaper';

import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { BitcoinService } from '../btc.service';
import { AddressChanged, DetectedTransaction } from '../indexer-listener.abstract';
import { BitcoinMainnetIndexerListener } from './bitcoin-mainnet.listener';

/**
 * Test implementation of Bitcoin service for local regtest testing
 */
class TestBitcoinService extends BitcoinService {
  constructor(private rpcUrlOverride: string) {
    super();
    (this as any).rpcUrl = rpcUrlOverride;
    (this as any).rpcUser = 'bitcoinrpc';
    (this as any).rpcPassword = 'testpassword123';
  }

  // Skip the module init health check during testing
  onModuleInit() {
    // Do nothing
  }
}

/**
 * Test implementation of BitcoinMainnetIndexerListener for local testing
 */
class TestBitcoinIndexerListener extends BitcoinMainnetIndexerListener {
  readonly logger = new TelemetryLogger('TestBitcoinIndexerListener');

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    btcService: BitcoinService,
  ) {
    // Use 2 second polling interval for testing
    super(discovery, redis, invoicePaymentQueue, btcService, 2000);
  }

  // Override getBlockchainKey for testing
  override getBlockchainKey() {
    return 'bip122:000000000019d6689c085ae165831e93';
  }
}

describe('BitcoinIndexerListener Integration Tests', function () {
  let bitcoinContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  let module: TestingModule;
  let listener: TestBitcoinIndexerListener;
  let redisService: RedisService;
  let btcService: TestBitcoinService;
  let detectedTransactions: DetectedTransaction[] = [];
  let bitcoinRpcUrl: string;

  before(
    async function () {
      const bitcoinPort = Math.floor(18443 + Math.random() * 10000);
      const redisPort = Math.floor(6379 + Math.random() * 10000);
      const redisHost = 'localhost';

      bitcoinRpcUrl = `http://localhost:${bitcoinPort}`;

      [bitcoinContainer, redisContainer] = await Promise.all([
        new GenericContainer('ruimarinho/bitcoin-core:23.0')
          .withCommand([
            '-regtest',
            '-server',
            '-rpcbind=0.0.0.0',
            '-rpcallowip=0.0.0.0/0',
            '-rpcuser=bitcoinrpc',
            '-rpcpassword=testpassword123',
            '-fallbackfee=0.00001',
            '-txindex=1',
            '-printtoconsole',
          ])
          .withWaitStrategy(new LogWaitStrategy('Done loading', 1))
          // .withLogConsumer(function (stream) {
          //   stream.pipe(process.stdout);
          // })
          .withExposedPorts({
            container: 18443,
            host: bitcoinPort,
          })
          .withStartupTimeout(60000)
          .start(),
        new GenericContainer('valkey/valkey:8-alpine')
          .withAutoRemove(true)
          .withExposedPorts({
            container: 6379,
            host: redisPort,
          })
          .withWaitStrategy(new LogWaitStrategy('Ready to accept connections tcp', 1))
          // .withLogConsumer(function (stream) {
          //   stream.pipe(process.stdout);
          // })
          .start(),
      ]);

      // Wait a bit for Bitcoin to be fully ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Create a wallet for testing
      try {
        await makeRpcCall(bitcoinRpcUrl, 'createwallet', ['testwallet']);
      } catch (error) {
        // Wallet might already exist, ignore error
        console.error('Wallet creation note:', error);
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
            provide: BitcoinService,
            useFactory: () => {
              return new TestBitcoinService(bitcoinRpcUrl);
            },
          },
          {
            provide: TestBitcoinIndexerListener,
            useFactory: (
              discovery: DiscoveryService,
              redis: RedisService,
              queue: InvoicePaymentQueueService,
              btc: BitcoinService,
            ) => {
              return new TestBitcoinIndexerListener(discovery, redis, queue, btc);
            },
            inject: [DiscoveryService, RedisService, InvoicePaymentQueueService, BitcoinService],
          },
          DiscoveryService,
        ],
      }).compile();

      redisService = module.get<RedisService>(RedisService);
      listener = module.get<TestBitcoinIndexerListener>(TestBitcoinIndexerListener);
      btcService = module.get<BitcoinService>(BitcoinService) as TestBitcoinService;

      await module.init();
    },
    { timeout: 90000 },
  );

  after(
    async function () {
      detectedTransactions = [];
      if (listener) await listener.stop();
      if (module) await module.close();
      if (redisContainer) await redisContainer.stop();
      if (bitcoinContainer) await bitcoinContainer.stop();
    },
    { timeout: 30000 },
  );

  describe('Native BTC Transaction Detection', function () {
    it(
      'should detect native BTC transaction to watched address',
      { timeout: 30000 },
      async function () {
        detectedTransactions = [];

        // Generate a new address using Bitcoin RPC
        const recipientAddress = await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', ['test']);
        ok(recipientAddress, 'Should generate new address');
        ok(typeof recipientAddress === 'string', 'Address should be a string');

        // Start the listener
        await listener.start();

        // Add address to watch via Redis pub/sub
        const addressChange: AddressChanged = {
          tokenId: 'slip:0',
          address: recipientAddress,
          derivedPath: "m/44'/0'/0'/0/1",
        };

        await redisService.publish(
          'indexer:bip122:000000000019d6689c085ae165831e93:address:added',
          JSON.stringify(addressChange),
        );

        // Give it time to process
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate 101 blocks to have spendable coins
        await makeRpcCall(bitcoinRpcUrl, 'generatetoaddress', [
          101,
          await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', []),
        ]);

        // Send BTC to watched address
        const txid = await makeRpcCall(bitcoinRpcUrl, 'sendtoaddress', [recipientAddress, 1.5]);
        ok(txid, 'Transaction should have txid');
        ok(typeof txid === 'string', 'Txid should be a string');

        // Mine a block to confirm the transaction
        await makeRpcCall(bitcoinRpcUrl, 'generatetoaddress', [
          1,
          await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', []),
        ]);

        // Wait for polling to detect the transaction (polling is 2s, wait 5s to be safe)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify detection
        strictEqual(detectedTransactions.length, 1, 'Should detect one transaction');

        const detected = detectedTransactions[0];
        assertDefined(detected);
        strictEqual(detected.blockchainKey, 'bip122:000000000019d6689c085ae165831e93');
        strictEqual(detected.tokenId, 'slip:0');
        strictEqual(detected.address, recipientAddress);
        strictEqual(detected.derivedPath, "m/44'/0'/0'/0/1");
        strictEqual(detected.txHash, txid);
        strictEqual(detected.amount, '150000000'); // 1.5 BTC in satoshis
        ok(detected.timestamp > 0, 'Should have timestamp');
      },
    );

    it(
      'should not detect transactions to non-watched addresses',
      { timeout: 20000 },
      async function () {
        detectedTransactions = [];

        // Generate a new address that we won't watch
        const recipientAddress = await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', ['test']);

        // Send BTC to non-watched address
        const txid = await makeRpcCall(bitcoinRpcUrl, 'sendtoaddress', [recipientAddress, 0.5]);
        ok(txid, 'Transaction should have txid');

        // Mine a block to confirm
        await makeRpcCall(bitcoinRpcUrl, 'generatetoaddress', [
          1,
          await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', []),
        ]);

        // Wait for polling (polling is 2s, wait 5s to be safe)
        await new Promise(resolve => setTimeout(resolve, 5000));

        strictEqual(
          detectedTransactions.length,
          0,
          'Should not detect transaction to non-watched address',
        );
      },
    );

    it('should stop detecting after address is removed', { timeout: 20000 }, async function () {
      detectedTransactions = [];

      const recipientAddress = await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', ['test']);

      // Add and then remove address
      const addressChange: AddressChanged = {
        tokenId: 'slip:0',
        address: recipientAddress,
        derivedPath: "m/44'/0'/0'/0/3",
      };

      await redisService.publish(
        'indexer:bip122:000000000019d6689c085ae165831e93:address:added',
        JSON.stringify(addressChange),
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      await redisService.publish(
        'indexer:bip122:000000000019d6689c085ae165831e93:address:removed',
        JSON.stringify(addressChange),
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send transaction
      const txid = await makeRpcCall(bitcoinRpcUrl, 'sendtoaddress', [recipientAddress, 0.3]);
      ok(txid, 'Transaction should have txid');

      // Mine a block
      await makeRpcCall(bitcoinRpcUrl, 'generatetoaddress', [
        1,
        await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', []),
      ]);

      // Wait for polling (polling is 2s, wait 5s to be safe)
      await new Promise(resolve => setTimeout(resolve, 5000));

      strictEqual(detectedTransactions.length, 0, 'Should not detect after removal');
    });
  });

  describe('Listener Lifecycle', function () {
    it('should handle multiple addresses for same token', { timeout: 30000 }, async function () {
      detectedTransactions = [];

      const recipient1 = await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', ['test']);
      const recipient2 = await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', ['test']);

      // Add two addresses
      await redisService.publish(
        'indexer:bip122:000000000019d6689c085ae165831e93:address:added',
        JSON.stringify({
          tokenId: 'slip:0',
          address: recipient1,
          derivedPath: "m/44'/0'/0'/0/5",
        }),
      );

      await redisService.publish(
        'indexer:bip122:000000000019d6689c085ae165831e93:address:added',
        JSON.stringify({
          tokenId: 'slip:0',
          address: recipient2,
          derivedPath: "m/44'/0'/0'/0/6",
        }),
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send to both addresses
      const txid1 = await makeRpcCall(bitcoinRpcUrl, 'sendtoaddress', [recipient1, 0.1]);
      const txid2 = await makeRpcCall(bitcoinRpcUrl, 'sendtoaddress', [recipient2, 0.2]);

      // Mine a block
      await makeRpcCall(bitcoinRpcUrl, 'generatetoaddress', [
        1,
        await makeRpcCall(bitcoinRpcUrl, 'getnewaddress', []),
      ]);

      // Wait for polling (polling is 2s, wait 5s to be safe)
      await new Promise(resolve => setTimeout(resolve, 5000));

      strictEqual(detectedTransactions.length, 2, 'Should detect both transactions');

      const tx1Detected = detectedTransactions.find(tx => tx.txHash === txid1);
      const tx2Detected = detectedTransactions.find(tx => tx.txHash === txid2);

      assertDefined(tx1Detected);
      assertDefined(tx2Detected);

      strictEqual(tx1Detected.address, recipient1);
      strictEqual(tx2Detected.address, recipient2);
      strictEqual(tx1Detected.amount, '10000000'); // 0.1 BTC in satoshis
      strictEqual(tx2Detected.amount, '20000000'); // 0.2 BTC in satoshis
    });
  });
});

/**
 * Helper function to make RPC calls to Bitcoin node
 */
async function makeRpcCall(rpcUrl: string, method: string, params: unknown[] = []): Promise<any> {
  const requestBody = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: method,
    params: params,
  };

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from('bitcoinrpc:testpassword123').toString('base64')}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (isDefined(data) && hasProp(isDefined, data, 'error')) {
    throw new Error(
      `Bitcoin RPC error: ${'message' in data.error ? data.error.message : data.error}`,
    );
  }

  return isDefined(data) && hasProp(isDefined, data, 'result') ? data.result : null;
}
