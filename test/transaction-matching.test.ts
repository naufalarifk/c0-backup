/**
 * Transaction Matching Service Tests
 *
 * Tests cross-platform transaction verification between Binance and blockchain.
 * These are integration tests that verify transactions exist on both systems.
 */

import assert from 'node:assert';
import { before, describe, it } from 'node:test';

import { ConfigService } from '@nestjs/config';

import { Connection } from '@solana/web3.js';

import { BinanceClientService } from '../src/modules/settlement/services/binance/binance-client.service';
import { BinanceDepositVerificationService } from '../src/modules/settlement/services/binance/binance-deposit-verification.service';
import { SolService } from '../src/modules/settlement/services/blockchain/sol.service';
import { SettlementWalletService } from '../src/modules/settlement/services/blockchain/wallet.service';
import { TransactionMatchingService } from '../src/modules/settlement/services/matching/transaction-matching.service';
import { WalletFactory } from '../src/shared/wallets/wallet.factory';

// Mock configuration for testing
class MockConfigService {
  get(key: string, defaultValue?: any): any {
    const config: Record<string, any> = {
      SOLANA_USE_DEVNET: 'true',
      SOLANA_RPC_URL: 'https://api.devnet.solana.com',
      BINANCE_API_ENABLED: 'false', // Disable real Binance API for tests
      NODE_ENV: 'development',
    };
    return config[key] ?? defaultValue;
  }
}

describe('TransactionMatchingService - Integration Tests', () => {
  let transactionMatching: TransactionMatchingService;
  let solService: SolService;
  let binanceClient: BinanceClientService;
  let binanceDepositService: BinanceDepositVerificationService;
  let walletFactory: WalletFactory;
  let walletService: SettlementWalletService;
  let connection: Connection;

  before(async () => {
    // Setup services
    const configService = new MockConfigService() as any;

    binanceClient = new BinanceClientService(configService);
    binanceDepositService = new BinanceDepositVerificationService(binanceClient);

    walletFactory = new WalletFactory(configService);
    walletService = new SettlementWalletService(walletFactory);

    solService = new SolService(walletFactory, walletService);

    transactionMatching = new TransactionMatchingService(binanceClient, binanceDepositService);

    connection = new Connection('https://api.devnet.solana.com');

    console.log('\n📋 Transaction Matching Test Configuration:');
    console.log(`   Network: Solana Devnet`);
    console.log(`   RPC: https://api.devnet.solana.com`);
    console.log(
      `   Binance API: ${binanceClient.isApiEnabled() ? 'Enabled' : 'Disabled (mock mode)'}\n`,
    );
  });

  describe('getTransactionForMatching', () => {
    it('should retrieve comprehensive transaction details for a real Solana transaction', async () => {
      // Use a REAL known successful Solana devnet transaction
      const testTxHash =
        '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ';

      const result = await solService.getTransactionForMatching(testTxHash);

      console.log('   📊 Real Transaction Details:');
      console.log(`      Found: ${result.found}`);
      console.log(`      Confirmed: ${result.confirmed}`);
      console.log(`      Success: ${result.success}`);

      if (result.found) {
        console.log(`      Amount: ${result.amount} SOL`);
        console.log(`      From: ${result.from?.substring(0, 20)}...`);
        console.log(`      To: ${result.to?.substring(0, 20)}...`);
        console.log(`      Fee: ${result.fee} SOL`);
        console.log(
          `      Block Time: ${result.blockTime ? new Date(result.blockTime * 1000).toISOString() : 'N/A'}`,
        );
        console.log(`      Confirmations: ${result.confirmations ?? 'N/A'}`);
      }

      // This should be a real confirmed transaction
      assert.strictEqual(result.found, true, 'Transaction should be found');
      assert.strictEqual(result.confirmed, true, 'Transaction should be confirmed');
      assert.strictEqual(result.success, true, 'Transaction should be successful');
      assert.ok(result.from, 'Should have sender address');
      assert.ok(result.to, 'Should have recipient address');
      assert.ok(result.amount, 'Should have transfer amount');
    });

    it('should handle invalid transaction hash gracefully', async () => {
      const invalidHash = 'invalid-hash-123';

      const result = await solService.getTransactionForMatching(invalidHash);

      console.log('   ❌ Invalid Transaction:');
      console.log(`      Found: ${result.found}`);
      console.log(`      Confirmed: ${result.confirmed}`);

      assert.strictEqual(result.found, false);
      assert.strictEqual(result.confirmed, false);
      assert.strictEqual(result.success, false);
    });
  });

  describe('matchDeposit - Real Transaction', () => {
    it('should verify real blockchain transaction and check Binance (expected to not match)', async () => {
      // Use REAL transaction - it exists on blockchain but not in Binance (test mode)
      const realCriteria = {
        txHash:
          '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ',
        blockchain: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        coin: 'SOL',
        expectedAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // Real destination address
        expectedAmount: '0.1', // Real amount transferred
        network: 'SOL',
      };

      const result = await transactionMatching.matchDeposit(realCriteria, solService);

      console.log('\n   💰 Real Deposit Match Result:');
      console.log(`      Success: ${result.success}`);
      console.log(`      Matched: ${result.matched}`);
      console.log(`      TxHash: ${result.txHash.substring(0, 40)}...`);
      console.log(`      Blockchain: ${result.blockchain}`);

      if (result.blockchainData) {
        console.log('\n   📊 Blockchain Data:');
        console.log(`      Found: ${result.blockchainData.found}`);
        console.log(`      Confirmed: ${result.blockchainData.confirmed}`);
        console.log(`      Success: ${result.blockchainData.success}`);
        console.log(`      Amount: ${result.blockchainData.amount} SOL`);
        console.log(`      From: ${result.blockchainData.from?.substring(0, 20)}...`);
        console.log(`      To: ${result.blockchainData.to?.substring(0, 20)}...`);
      }

      if (result.binanceData) {
        console.log('\n   🏦 Binance Data:');
        console.log(`      Found: ${result.binanceData.found}`);
        console.log(`      Status: ${result.binanceData.status}`);
      }

      if (result.discrepancies && result.discrepancies.length > 0) {
        console.log('\n   ⚠️  Discrepancies:');
        result.discrepancies.forEach(d => console.log(`      - ${d}`));
      }

      if (result.message) {
        console.log(`\n   📝 Message: ${result.message}`);
      }

      // Blockchain should be found and confirmed
      assert.ok(result.blockchainData, 'Should have blockchain data');
      assert.strictEqual(
        result.blockchainData.found,
        true,
        'Transaction should exist on blockchain',
      );
      assert.strictEqual(result.blockchainData.confirmed, true, 'Transaction should be confirmed');

      // Binance won't be found in test mode
      assert.strictEqual(
        result.binanceData?.found,
        false,
        'Binance record not expected in test mode',
      );
    });
  });

  describe('matchWithdrawal - Mock Example', () => {
    it('should demonstrate withdrawal matching structure', async () => {
      // This is a mock example showing how withdrawal matching would work
      // In production, this would match Binance withdrawal against blockchain transaction

      const mockCriteria = {
        withdrawalId: 'binance-withdrawal-12345',
        blockchain: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        coin: 'SOL',
        expectedAddress: 'DestinationWalletAddress...',
        expectedAmount: '5.25',
        network: 'SOL',
      };

      const result = await transactionMatching.matchWithdrawal(mockCriteria, solService);

      console.log('\n   💸 Withdrawal Match Result:');
      console.log(`      Success: ${result.success}`);
      console.log(`      Matched: ${result.matched}`);
      console.log(`      TxHash: ${result.txHash}`);
      console.log(`      Blockchain: ${result.blockchain}`);

      if (result.binanceData) {
        console.log(`      Binance Found: ${result.binanceData.found}`);
        console.log(`      Binance Type: ${result.binanceData.type}`);
        console.log(`      Binance Status: ${result.binanceData.status}`);
      }

      if (result.blockchainData) {
        console.log(`      Blockchain Found: ${result.blockchainData.found}`);
        console.log(`      Blockchain Confirmed: ${result.blockchainData.confirmed}`);
      }

      if (result.message) {
        console.log(`      Message: ${result.message}`);
      }

      // Since Binance API is disabled, should return error
      assert.strictEqual(result.success, false);
      assert.ok(result.error || result.message);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should explain deposit verification workflow', async () => {
      console.log('\n   📝 Deposit Verification Workflow:');
      console.log('   1. User deposits SOL to Binance deposit address on blockchain');
      console.log('   2. Transaction is broadcasted and confirmed on Solana');
      console.log('   3. matchDeposit() checks:');
      console.log('      a. Transaction exists on Solana with getTransactionForMatching()');
      console.log('      b. Transaction is confirmed on blockchain');
      console.log('      c. Deposit appears in Binance records via API');
      console.log('      d. Amount matches between blockchain and Binance');
      console.log('      e. Destination address matches Binance deposit address');
      console.log('   4. Returns matched=true if all checks pass\n');

      assert.ok(true); // Demonstration test
    });

    it('should explain withdrawal verification workflow', async () => {
      console.log('\n   📝 Withdrawal Verification Workflow:');
      console.log('   1. Binance initiates withdrawal to user wallet address');
      console.log('   2. Binance broadcasts transaction to blockchain');
      console.log('   3. matchWithdrawal() checks:');
      console.log('      a. Withdrawal exists in Binance records');
      console.log('      b. Withdrawal has blockchain txId assigned');
      console.log('      c. Transaction is confirmed on blockchain');
      console.log('      d. Amount approximately matches (accounting for fees)');
      console.log('      e. Destination address matches expected recipient');
      console.log('   4. Returns matched=true if all checks pass\n');

      assert.ok(true); // Demonstration test
    });

    it('should demonstrate batch matching capabilities', async () => {
      console.log('\n   📦 Batch Matching:');
      console.log('   - batchMatchDeposits(): Match multiple deposits in parallel');
      console.log('   - batchMatchWithdrawals(): Match multiple withdrawals in parallel');
      console.log('   - Useful for reconciliation and audit processes');
      console.log('   - Returns array of match results for analysis\n');

      const mockDepositsList = [
        {
          txHash: 'tx1...',
          blockchain: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
          coin: 'SOL',
          expectedAddress: 'addr1...',
          expectedAmount: '10.0',
        },
        {
          txHash: 'tx2...',
          blockchain: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
          coin: 'SOL',
          expectedAddress: 'addr2...',
          expectedAmount: '20.0',
        },
      ];

      const results = await transactionMatching.batchMatchDeposits(mockDepositsList, solService);

      console.log(`   ✅ Batch processed ${results.length} deposits`);
      assert.strictEqual(results.length, 2);
    });
  });

  describe('Use Cases', () => {
    it('should list practical use cases', async () => {
      console.log('\n   🎯 Practical Use Cases:');
      console.log('   1. Settlement Reconciliation:');
      console.log('      - Verify all deposits from hot wallet to Binance');
      console.log('      - Verify all withdrawals from Binance to hot wallet');
      console.log('      - Detect any missing or failed transactions');
      console.log('');
      console.log('   2. User Deposit Verification:');
      console.log('      - User deposits crypto to Binance');
      console.log('      - System verifies transaction on blockchain');
      console.log('      - Matches with Binance deposit record');
      console.log('      - Confirms credit to user account');
      console.log('');
      console.log('   3. Withdrawal Confirmation:');
      console.log('      - User requests withdrawal from Binance');
      console.log('      - System tracks Binance withdrawal status');
      console.log('      - Verifies transaction appears on blockchain');
      console.log('      - Confirms user received funds');
      console.log('');
      console.log('   4. Audit Trail:');
      console.log('      - Daily reconciliation of all transactions');
      console.log('      - Identify discrepancies for investigation');
      console.log('      - Generate reports for compliance');
      console.log('      - Maintain transaction integrity\n');

      assert.ok(true); // Documentation test
    });
  });
});
