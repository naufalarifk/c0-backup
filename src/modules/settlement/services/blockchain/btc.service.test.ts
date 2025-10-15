import type { WalletFactory } from '../../../../shared/wallets/wallet.factory';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { BtcService } from './btc.service';

/**
 * BTC Service Unit Tests
 *
 * Tests Bitcoin blockchain settlement service functionality including:
 * - Balance queries from Blockstream API
 * - Transaction status and confirmation checking
 * - Transaction verification and matching
 * - Address balance queries and change tracking
 * - Network configuration (mainnet/testnet)
 */
describe('BtcService', () => {
  let btcService: BtcService;
  let mockWalletFactory: WalletFactory;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Store original fetch
    originalFetch = global.fetch;

    // Mock WalletFactory
    mockWalletFactory = {
      getBlockchain: mock.fn(() => ({
        getHotWallet: mock.fn(async () => ({
          getAddress: mock.fn(async () => 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'),
        })),
      })),
    } as unknown as WalletFactory;

    btcService = new BtcService(mockWalletFactory);
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Network Configuration', () => {
    it('should return mainnet blockchain key by default', () => {
      const key = btcService.getBlockchainKey();
      assert.equal(key, 'bip122:000000000019d6689c085ae165831e93');
    });

    it('should return mainnet network name by default', () => {
      const network = btcService.getNetworkName();
      assert.equal(network, 'mainnet');
    });

    it('should return Blockstream API URL', () => {
      const url = btcService.getRpcUrl();
      assert.equal(url, 'https://blockstream.info/api');
    });
  });

  describe('Balance Queries', () => {
    it('should get hot wallet balance', async () => {
      // Mock fetch for address balance
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          chain_stats: {
            funded_txo_sum: 1000000,
            spent_txo_sum: 500000,
          },
          mempool_stats: {
            funded_txo_sum: 100000,
            spent_txo_sum: 50000,
          },
        }),
      })) as unknown as typeof fetch;

      const balance = await btcService.getBalance();

      // Balance = (funded - spent) + (mempool_funded - mempool_spent)
      // = (1000000 - 500000) + (100000 - 50000) = 550000
      assert.equal(balance, 550000);
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        statusText: 'Not Found',
      })) as unknown as typeof fetch;

      await assert.rejects(btcService.getBalance(), /Failed to fetch balance/);
    });

    it('should get balance for specific address', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          chain_stats: {
            funded_txo_sum: 2000000,
            spent_txo_sum: 1000000,
          },
          mempool_stats: {
            funded_txo_sum: 0,
            spent_txo_sum: 0,
          },
        }),
      })) as unknown as typeof fetch;

      const balance = await btcService.getAddressBalance(
        'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      );
      assert.equal(balance, 1000000);
    });
  });

  describe('Transaction Status', () => {
    it('should check if transaction is confirmed', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          status: {
            confirmed: true,
            block_height: 800000,
            block_time: 1234567890,
          },
        }),
      })) as unknown as typeof fetch;

      const status = await btcService.getTransactionStatus('abc123def456');

      assert.equal(status.confirmed, true);
      assert.equal(status.success, true);
      assert.equal(status.blockHeight, 800000);
      assert.equal(status.blockTime, 1234567890);
    });

    it('should return false for unconfirmed transaction', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          status: {
            confirmed: false,
          },
        }),
      })) as unknown as typeof fetch;

      const status = await btcService.getTransactionStatus('unconfirmed_tx');

      assert.equal(status.confirmed, false);
      assert.equal(status.success, false);
    });
  });

  describe('Transaction Details', () => {
    it('should get transaction details with inputs and outputs', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          status: {
            confirmed: true,
            block_height: 800000,
            block_time: 1234567890,
          },
          fee: 5000,
          vin: [
            {
              prevout: {
                scriptpubkey_address: 'bc1qsender',
                value: 1000000,
              },
            },
          ],
          vout: [
            {
              scriptpubkey_address: 'bc1qreceiver',
              value: 900000,
            },
            {
              scriptpubkey_address: 'bc1qchange',
              value: 95000,
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const details = await btcService.getTransactionDetails('tx_hash');

      assert.equal(details.success, true);
      assert.equal(details.fee, 5000);
      assert.equal(details.inputs?.length, 1);
      assert.equal(details.outputs?.length, 2);
      assert.equal(details.inputs?.[0].address, 'bc1qsender');
      assert.equal(details.outputs?.[0].value, 900000);
    });
  });

  describe('Transaction Verification', () => {
    it('should verify valid transfer', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          status: {
            confirmed: true,
          },
          fee: 5000,
          vin: [
            {
              prevout: {
                scriptpubkey_address: 'bc1qsender',
                value: 1000000,
              },
            },
          ],
          vout: [
            {
              scriptpubkey_address: 'bc1qreceiver',
              value: 500000,
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const result = await btcService.verifyTransfer(
        'tx_hash',
        'bc1qsender',
        'bc1qreceiver',
        500000,
      );

      assert.equal(result.verified, true);
      assert.equal(result.success, true);
      assert.equal(result.actualAmount, 500000);
    });

    it('should detect amount mismatch', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          status: {
            confirmed: true,
          },
          fee: 5000,
          vin: [
            {
              prevout: {
                scriptpubkey_address: 'bc1qsender',
                value: 1000000,
              },
            },
          ],
          vout: [
            {
              scriptpubkey_address: 'bc1qreceiver',
              value: 400000, // Different from expected
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const result = await btcService.verifyTransfer(
        'tx_hash',
        'bc1qsender',
        'bc1qreceiver',
        500000, // Expected amount
      );

      assert.equal(result.verified, false);
      assert.ok(result.errors);
      assert.ok(result.errors.some((e: string) => e.includes('Amount mismatch')));
    });
  });

  describe('Transaction Matching', () => {
    it('should get transaction for settlement matching', async () => {
      // Simple single mock that returns transaction details
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          status: {
            confirmed: true,
            block_height: 800000,
            block_time: 1234567890,
          },
          fee: 5000,
          vin: [
            {
              prevout: {
                scriptpubkey_address: 'bc1qsender',
                value: 1000000,
              },
            },
          ],
          vout: [
            {
              scriptpubkey_address: 'bc1qreceiver',
              value: 50000000, // 0.5 BTC in satoshis
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const result = await btcService.getTransactionForMatching('tx_hash');

      assert.equal(result.found, true);
      assert.equal(result.confirmed, true);
      assert.equal(result.success, true);
      assert.equal(result.amount, '0.5'); // BTC (converted from satoshis)
      assert.equal(result.from, 'bc1qsender');
      assert.equal(result.to, 'bc1qreceiver');
    });
  });

  describe('Address Balance Change', () => {
    it('should calculate balance change for recipient', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          status: {
            confirmed: true,
          },
          fee: 5000,
          vin: [
            {
              prevout: {
                scriptpubkey_address: 'bc1qsender',
                value: 1000000,
              },
            },
          ],
          vout: [
            {
              scriptpubkey_address: 'bc1qreceiver',
              value: 500000,
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const result = await btcService.getAddressBalanceChange('tx_hash', 'bc1qreceiver');

      assert.equal(result.found, true);
      assert.equal(result.success, true);
      assert.equal(result.balanceChange, 500000);
    });

    it('should calculate balance change for sender (negative with fee)', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          status: {
            confirmed: true,
          },
          fee: 5000,
          vin: [
            {
              prevout: {
                scriptpubkey_address: 'bc1qsender',
                value: 1000000,
              },
            },
          ],
          vout: [
            {
              scriptpubkey_address: 'bc1qreceiver',
              value: 500000,
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const result = await btcService.getAddressBalanceChange('tx_hash', 'bc1qsender');

      assert.equal(result.found, true);
      assert.equal(result.success, true);
      // Sender sent 1000000 but received nothing, plus paid 5000 fee
      assert.equal(result.balanceChange, -1000000 - 5000);
    });
  });
});
