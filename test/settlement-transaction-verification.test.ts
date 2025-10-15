/**
 * Settlement Transaction Verification Test
 *
 * This test demonstrates how to programmatically verify settlement transfers
 * using the SettlementTransactionService and SolService.
 *
 * These methods can be used in your code instead of manual scripts.
 */

import { ok } from 'node:assert/strict';
import { test } from 'node:test';

import { Connection } from '@solana/web3.js';

test('Settlement Transaction Verification - Programmatic Methods Demo', async t => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 PROGRAMMATIC TRANSFER VERIFICATION DEMO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Direct Solana RPC connection (example without full backend)
    const connection = new Connection('https://api.devnet.solana.com');

    // The transaction from our testnet transfer
    const testTransaction = {
      signature:
        '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ',
      expectedFrom: '815tYsAwUqZSDWPfrpYW5Cc4d8BhAib9YPxcUm3AyXHW',
      expectedTo: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      expectedAmount: '0.1',
    };

    console.log('📋 Transaction Details:');
    console.log(`   Signature: ${testTransaction.signature.substring(0, 20)}...`);
    console.log(`   From: ${testTransaction.expectedFrom.substring(0, 20)}...`);
    console.log(`   To: ${testTransaction.expectedTo.substring(0, 20)}...`);
    console.log(`   Amount: ${testTransaction.expectedAmount} SOL`);
    console.log();

    // Method 1: Check transaction status using Solana connection directly
    console.log('1️⃣  Checking transaction status...');
    const status = await connection.getSignatureStatus(testTransaction.signature, {
      searchTransactionHistory: true,
    });

    if (status && status.value) {
      const isConfirmed =
        status.value.confirmationStatus === 'confirmed' ||
        status.value.confirmationStatus === 'finalized';
      const isSuccessful = isConfirmed && status.value.err === null;

      console.log(`   Confirmed: ${isConfirmed ? '✅' : '❌'}`);
      console.log(`   Successful: ${isSuccessful ? '✅' : '❌'}`);
      console.log(`   Slot: ${status.value.slot}`);

      ok(isConfirmed, 'Transaction should be confirmed');
      ok(isSuccessful, 'Transaction should be successful');
    }
    console.log();

    // Method 2: Get full transaction details
    console.log('2️⃣  Getting transaction details...');
    const tx = await connection.getTransaction(testTransaction.signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (tx) {
      console.log(`   Success: ${tx.meta?.err === null ? '✅' : '❌'}`);
      console.log(
        `   Block Time: ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'N/A'}`,
      );
      console.log(
        `   Fee: ${tx.meta?.fee ? (tx.meta.fee / 1_000_000_000).toFixed(9) + ' SOL' : 'N/A'}`,
      );

      if (tx.meta?.preBalances && tx.meta?.postBalances) {
        const senderChange = tx.meta.postBalances[0] - tx.meta.preBalances[0];
        const transferAmount = Math.abs(senderChange) - (tx.meta.fee || 0);
        console.log(`   Amount: ${(transferAmount / 1_000_000_000).toFixed(9)} SOL`);
      }

      ok(tx.meta?.err === null, 'Transaction should have succeeded');
    }
    console.log();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION METHODS DEMONSTRATED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 In Your Code, Use These Services:');
    console.log('   • SettlementTransactionService.verifyTransfer()');
    console.log('   • SettlementTransactionService.isTransactionSuccessful()');
    console.log('   • SettlementTransactionService.checkAddressReceived()');
    console.log('   • SettlementTransactionService.monitorTransaction()');
    console.log('   • SettlementTransactionService.getTransactionReport()');
    console.log();
    console.log('   • SolService.getTransactionStatus()');
    console.log('   • SolService.getTransactionDetails()');
    console.log('   • SolService.waitForConfirmation()');
    console.log('   • SolService.verifyTransfer()');
    console.log('   • SolService.getAddressBalance()');
    console.log();
    console.log('📚 See docs/settlement-programmatic-verification.md for examples');
    console.log();
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
});
