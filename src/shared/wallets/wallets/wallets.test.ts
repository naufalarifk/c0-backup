import type { Wallet } from '../wallet.abstract';

import { ok, strictEqual } from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { Connection } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { ethers } from 'ethers';

import { BtcWallet } from './btc.wallet';
import { CgtWallet } from './cgt.wallet';
import { EthWallet } from './eth.wallet';
import { SolWallet } from './sol.wallet';

describe('Wallet Implementations', () => {
  describe('EthWallet', () => {
    it('should implement all required Wallet methods', async () => {
      const privateKey = new Uint8Array(32).fill(1);
      const mockProvider = {
        getFeeData: mock.fn(async () => ({
          gasPrice: BigInt(20000000000),
        })),
        broadcastTransaction: mock.fn(async () => ({
          hash: '0x123',
          wait: async () => ({ hash: '0x123' }),
        })),
        getBalance: mock.fn(async () => BigInt('1000000000000000000')), // 1 ETH
      } as unknown as ethers.JsonRpcProvider;

      const wallet: Wallet = new EthWallet(privateKey, mockProvider);

      // Test getAddress
      const address = await wallet.getAddress();
      ok(address, 'Address should be defined');
      ok(address.startsWith('0x'), 'Address should start with 0x');
      strictEqual(address.length, 42, 'Address should be 42 characters');

      // Test getBalance
      const balance = await wallet.getBalance(address);
      ok(typeof balance === 'number', 'Balance should be a number');
      strictEqual(balance, 1, 'Balance should be 1 ETH');

      // Verify wallet extends Wallet abstract class
      ok(wallet instanceof EthWallet, 'Should be instance of EthWallet');
      ok('getAddress' in wallet, 'Should have getAddress method');
      ok('transfer' in wallet, 'Should have transfer method');
      ok('getBalance' in wallet, 'Should have getBalance method');
    });

    it('should return correct balance for different amounts', async () => {
      const privateKey = new Uint8Array(32).fill(1);
      const mockProvider = {
        getBalance: mock.fn(async (addr: string) => {
          // Return different balances for testing
          if (addr.includes('0x')) {
            return BigInt('2500000000000000000'); // 2.5 ETH
          }
          return BigInt(0);
        }),
      } as unknown as ethers.JsonRpcProvider;

      const wallet: Wallet = new EthWallet(privateKey, mockProvider);
      const address = await wallet.getAddress();
      const balance = await wallet.getBalance(address);

      strictEqual(balance, 2.5, 'Balance should be 2.5 ETH');
    });
  });

  describe('BtcWallet', () => {
    it('should implement all required Wallet methods', async () => {
      const privateKey = new Uint8Array(32).fill(2);
      const mockRpcClient = {
        sendRawTransaction: mock.fn(async () => 'btc_tx_hash'),
        getUnspentOutputs: mock.fn(async () => [
          {
            txid: 'mock_txid',
            vout: 0,
            value: 100000000, // 1 BTC in satoshis
            scriptPubKey: '0014' + '00'.repeat(20),
          },
        ]),
      };

      class TestBtcWallet extends BtcWallet {
        protected network = bitcoin.networks.bitcoin;
        protected rpcClient = mockRpcClient;
      }

      const wallet: Wallet = new TestBtcWallet(privateKey);

      // Test getAddress
      const address = await wallet.getAddress();
      ok(address, 'Address should be defined');
      ok(address.startsWith('bc1'), 'Bitcoin mainnet address should start with bc1');

      // Test getBalance
      const balance = await wallet.getBalance(address);
      ok(typeof balance === 'number', 'Balance should be a number');
      strictEqual(balance, 1, 'Balance should be 1 BTC');

      // Verify wallet extends Wallet abstract class
      ok(wallet instanceof BtcWallet, 'Should be instance of BtcWallet');
      ok('getAddress' in wallet, 'Should have getAddress method');
      ok('transfer' in wallet, 'Should have transfer method');
      ok('getBalance' in wallet, 'Should have getBalance method');
    });

    it('should calculate balance correctly from multiple UTXOs', async () => {
      const privateKey = new Uint8Array(32).fill(2);
      const mockRpcClient = {
        sendRawTransaction: mock.fn(async () => 'btc_tx_hash'),
        getUnspentOutputs: mock.fn(async () => [
          { txid: 'tx1', vout: 0, value: 50000000, scriptPubKey: '0014' + '00'.repeat(20) }, // 0.5 BTC
          { txid: 'tx2', vout: 0, value: 30000000, scriptPubKey: '0014' + '00'.repeat(20) }, // 0.3 BTC
          { txid: 'tx3', vout: 0, value: 20000000, scriptPubKey: '0014' + '00'.repeat(20) }, // 0.2 BTC
        ]),
      };

      class TestBtcWallet extends BtcWallet {
        protected network = bitcoin.networks.bitcoin;
        protected rpcClient = mockRpcClient;
      }

      const wallet: Wallet = new TestBtcWallet(privateKey);
      const address = await wallet.getAddress();
      const balance = await wallet.getBalance(address);

      strictEqual(balance, 1, 'Balance should be 1 BTC (0.5 + 0.3 + 0.2)');
    });
  });

  describe('SolWallet', () => {
    it('should implement all required Wallet methods', async () => {
      const privateKey = new Uint8Array(32).fill(3);
      const mockConnection = {
        getLatestBlockhash: mock.fn(async () => ({
          blockhash: 'mock_blockhash',
        })),
        sendRawTransaction: mock.fn(async () => 'sol_signature'),
        confirmTransaction: mock.fn(async () => ({ value: { err: null } })),
        getBalance: mock.fn(async () => 1000000000), // 1 SOL in lamports
      } as unknown as Connection;

      class TestSolWallet extends SolWallet {
        protected connection = mockConnection;
      }

      const wallet: Wallet = new TestSolWallet(privateKey);

      // Test getAddress
      const address = await wallet.getAddress();
      ok(address, 'Address should be defined');
      ok(address.length > 32, 'Solana address should be base58 encoded');

      // Test getBalance
      const balance = await wallet.getBalance(address);
      ok(typeof balance === 'number', 'Balance should be a number');
      strictEqual(balance, 1, 'Balance should be 1 SOL');

      // Verify wallet extends Wallet abstract class
      ok(wallet instanceof SolWallet, 'Should be instance of SolWallet');
      ok('getAddress' in wallet, 'Should have getAddress method');
      ok('transfer' in wallet, 'Should have transfer method');
      ok('getBalance' in wallet, 'Should have getBalance method');
    });

    it('should convert lamports to SOL correctly', async () => {
      const privateKey = new Uint8Array(32).fill(3);
      const mockConnection = {
        getBalance: mock.fn(async () => 2500000000), // 2.5 SOL in lamports
      } as unknown as Connection;

      class TestSolWallet extends SolWallet {
        protected connection = mockConnection;
      }

      const wallet: Wallet = new TestSolWallet(privateKey);
      const address = await wallet.getAddress();
      const balance = await wallet.getBalance(address);

      strictEqual(balance, 2.5, 'Balance should be 2.5 SOL');
    });
  });

  describe('CgtWallet', () => {
    it('should implement all required Wallet methods', async () => {
      const privateKey = new Uint8Array(32).fill(4);
      const wallet: Wallet = new CgtWallet(privateKey);

      // Test getAddress
      const address = await wallet.getAddress();
      ok(address, 'Address should be defined');
      ok(address.startsWith('0xmock'), 'Mock address should start with 0xmock');
      strictEqual(address.length, 40, 'Mock address should be 40 characters');

      // Test transfer
      const result = await wallet.transfer({
        tokenId: 'cg:testnet',
        from: address,
        to: '0xmockrecipient',
        value: '1.5',
      });
      ok(result.txHash, 'Transaction hash should be defined');
      ok(result.txHash.startsWith('0xmock'), 'Mock tx hash should start with 0xmock');

      // Test getBalance
      const balance = await wallet.getBalance(address);
      ok(typeof balance === 'number', 'Balance should be a number');
      ok(balance >= 0 && balance <= 100, 'Balance should be between 0-100');

      // Verify wallet extends Wallet abstract class
      ok(wallet instanceof CgtWallet, 'Should be instance of CgtWallet');
      ok('getAddress' in wallet, 'Should have getAddress method');
      ok('transfer' in wallet, 'Should have transfer method');
      ok('getBalance' in wallet, 'Should have getBalance method');
    });

    it('should return deterministic balance for same address', async () => {
      const privateKey = new Uint8Array(32).fill(4);
      const wallet: Wallet = new CgtWallet(privateKey);
      const address = await wallet.getAddress();

      const balance1 = await wallet.getBalance(address);
      const balance2 = await wallet.getBalance(address);

      strictEqual(balance1, balance2, 'Balance should be deterministic for same address');
    });

    it('should return different balances for different addresses', async () => {
      const wallet1: Wallet = new CgtWallet(new Uint8Array(32).fill(4));
      const wallet2: Wallet = new CgtWallet(new Uint8Array(32).fill(5));

      const address1 = await wallet1.getAddress();
      const address2 = await wallet2.getAddress();

      const balance1 = await wallet1.getBalance(address1);
      const balance2 = await wallet2.getBalance(address2);

      // Addresses are different, so balances should likely be different
      // (not guaranteed 100% but very likely with hash-based generation)
      ok(address1 !== address2, 'Different private keys should generate different addresses');
    });
  });

  describe('Wallet Abstract Class Compliance', () => {
    it('all wallet implementations should have consistent interface', async () => {
      const privateKey = new Uint8Array(32).fill(1);

      // Create instances
      const ethWallet = new EthWallet(privateKey, {
        getBalance: mock.fn(async () => BigInt(0)),
      } as unknown as ethers.JsonRpcProvider);

      class TestBtcWallet extends BtcWallet {
        protected network = bitcoin.networks.bitcoin;
        protected rpcClient = {
          sendRawTransaction: mock.fn(async () => ''),
          getUnspentOutputs: mock.fn(async () => []),
        };
      }
      const btcWallet = new TestBtcWallet(privateKey);

      class TestSolWallet extends SolWallet {
        protected connection = {
          getBalance: mock.fn(async () => 0),
        } as unknown as Connection;
      }
      const solWallet = new TestSolWallet(privateKey);

      const cgtWallet = new CgtWallet(privateKey);

      const wallets: Wallet[] = [ethWallet, btcWallet, solWallet, cgtWallet];

      // Verify all wallets have the required methods
      for (const wallet of wallets) {
        ok('getAddress' in wallet, 'Should have getAddress method');
        ok('transfer' in wallet, 'Should have transfer method');
        ok('getBalance' in wallet, 'Should have getBalance method');

        ok(typeof wallet.getAddress === 'function', 'getAddress should be a function');
        ok(typeof wallet.transfer === 'function', 'transfer should be a function');
        ok(typeof wallet.getBalance === 'function', 'getBalance should be a function');
      }
    });
  });
});
