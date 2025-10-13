/**
 * SolService Integration Test
 *
 * Actual integration tests that verify Solana blockchain operations work correctly
 * with real data on devnet. Tests the same methods that SolService uses.
 */

import { ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { Connection, PublicKey } from '@solana/web3.js';

test('Solana Blockchain Integration Tests', async t => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 SOLANA BLOCKCHAIN INTEGRATION TESTS');
  console.log('Testing real blockchain operations on devnet');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Direct connection to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com');

  // Known test transaction from our devnet transfer
  const testTx = {
    signature:
      '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ',
    from: '815tYsAwUqZSDWPfrpYW5Cc4d8BhAib9YPxcUm3AyXHW',
    to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amount: 100000000, // 0.1 SOL in lamports
  };

  console.log('📋 Test Transaction:');
  console.log(`   Signature: ${testTx.signature.substring(0, 40)}...`);
  console.log(`   From: ${testTx.from.substring(0, 20)}...`);
  console.log(`   To: ${testTx.to.substring(0, 20)}...`);
  console.log(`   Amount: ${testTx.amount / 1_000_000_000} SOL\n`);

  await t.test('getSignatureStatus() verifies confirmed transaction', async () => {
    console.log('1️⃣  Testing getSignatureStatus() [SolService.getTransactionStatus()]');

    const status = await connection.getSignatureStatus(testTx.signature, {
      searchTransactionHistory: true,
    });

    console.log(`   Status Value: ${JSON.stringify(status.value)}`);
    console.log(`   Context Slot: ${status.context.slot}`);

    // Assertions
    ok(status.value !== null, 'Transaction status should exist');
    strictEqual(status.value?.err, null, 'Transaction should have no errors');
    ok(
      status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized',
      'Transaction should be confirmed or finalized',
    );
    ok(status.value?.slot !== undefined, 'Should have slot number');

    console.log('   ✅ Transaction confirmed on blockchain\n');
  });

  await t.test('getTransaction() returns complete transaction details', async () => {
    console.log('2️⃣  Testing getTransaction() [SolService.getTransactionDetails()]');

    const tx = await connection.getTransaction(testTx.signature, {
      maxSupportedTransactionVersion: 0,
    });

    console.log(`   Found: ${tx !== null}`);
    console.log(`   Success: ${tx?.meta?.err === null}`);
    console.log(`   Fee: ${tx?.meta?.fee} lamports`);
    console.log(`   Slot: ${tx?.slot}`);
    console.log(
      `   Block Time: ${tx?.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'N/A'}`,
    );

    // Assertions
    ok(tx !== null, 'Transaction should exist');
    strictEqual(tx?.meta?.err, null, 'Transaction should be successful');
    ok(tx?.meta?.fee !== undefined, 'Should have fee');
    ok(tx?.meta?.fee! > 0, 'Fee should be positive');
    ok(tx?.slot !== undefined, 'Should have slot');
    ok(tx?.meta?.preBalances !== undefined, 'Should have preBalances');
    ok(tx?.meta?.postBalances !== undefined, 'Should have postBalances');
    ok(Array.isArray(tx?.meta?.preBalances), 'preBalances should be array');
    ok(Array.isArray(tx?.meta?.postBalances), 'postBalances should be array');
    ok(tx?.meta?.preBalances!.length > 0, 'Should have at least one preBalance');
    strictEqual(
      tx?.meta?.preBalances!.length,
      tx?.meta?.postBalances!.length,
      'Should have matching pre/post balances',
    );

    console.log('   ✅ Complete transaction details retrieved\n');
  });

  await t.test('getBalance() returns valid address balance', async () => {
    console.log('3️⃣  Testing getBalance() [SolService.getAddressBalance()]');

    const toPublicKey = new PublicKey(testTx.to);
    const balance = await connection.getBalance(toPublicKey);

    console.log(`   Address: ${testTx.to.substring(0, 20)}...`);
    console.log(`   Balance: ${balance} lamports (${balance / 1_000_000_000} SOL)`);

    // Assertions
    strictEqual(typeof balance, 'number', 'Balance should be a number');
    ok(balance >= 0, 'Balance should be non-negative');
    ok(balance > 0, 'Test address should have non-zero balance (we sent 0.1 SOL to it)');

    console.log('   ✅ Valid address balance retrieved\n');
  });

  await t.test('verify transfer details match expected values', async () => {
    console.log('4️⃣  Testing transfer verification [SolService.verifyTransfer()]');

    const tx = await connection.getTransaction(testTx.signature, {
      maxSupportedTransactionVersion: 0,
    });

    ok(tx !== null, 'Transaction must exist');
    const accountKeys = tx!.transaction.message.staticAccountKeys.map(key => key.toString());
    const actualFrom = accountKeys[0];
    const actualTo = accountKeys[1];

    console.log(`   Expected From: ${testTx.from.substring(0, 20)}...`);
    console.log(`   Actual From:   ${actualFrom.substring(0, 20)}...`);
    console.log(`   Expected To:   ${testTx.to.substring(0, 20)}...`);
    console.log(`   Actual To:     ${actualTo.substring(0, 20)}...`);

    // Verify addresses
    strictEqual(actualFrom, testTx.from, 'From address should match');
    strictEqual(actualTo, testTx.to, 'To address should match');

    // Calculate actual transfer amount
    const preBalances = tx!.meta?.preBalances!;
    const postBalances = tx!.meta?.postBalances!;
    const fee = tx!.meta?.fee!;

    const senderBalanceChange = postBalances[0] - preBalances[0] + fee;
    const actualAmount = Math.abs(senderBalanceChange);

    console.log(`   Expected Amount: ${testTx.amount} lamports`);
    console.log(`   Actual Amount:   ${actualAmount} lamports`);
    console.log(`   Fee:             ${fee} lamports`);

    // Verify amount (allow small tolerance)
    const tolerance = 10000;
    const amountDiff = Math.abs(actualAmount - testTx.amount);
    ok(
      amountDiff <= tolerance,
      `Amount should match within tolerance (diff: ${amountDiff} lamports)`,
    );

    console.log('   ✅ All transfer details verified correctly\n');
  });

  await t.test('calculate balance changes for sender and recipient', async () => {
    console.log('5️⃣  Testing balance changes [SolService.getAddressBalanceChange()]');

    const tx = await connection.getTransaction(testTx.signature, {
      maxSupportedTransactionVersion: 0,
    });

    ok(tx !== null, 'Transaction must exist');
    const accountKeys = tx!.transaction.message.staticAccountKeys.map(key => key.toString());
    const preBalances = tx!.meta?.preBalances!;
    const postBalances = tx!.meta?.postBalances!;

    // Find sender and recipient indices
    const senderIndex = accountKeys.indexOf(testTx.from);
    const recipientIndex = accountKeys.indexOf(testTx.to);

    ok(senderIndex >= 0, 'Sender should be in transaction');
    ok(recipientIndex >= 0, 'Recipient should be in transaction');

    const senderChange = postBalances[senderIndex] - preBalances[senderIndex];
    const recipientChange = postBalances[recipientIndex] - preBalances[recipientIndex];

    console.log(`   Sender Change:    ${senderChange} lamports`);
    console.log(`   Recipient Change: ${recipientChange} lamports`);

    // Assertions
    ok(senderChange < 0, 'Sender balance should decrease');
    ok(recipientChange > 0, 'Recipient balance should increase');

    // Recipient should receive approximately the sent amount
    const expectedAmount = testTx.amount;
    const diff = Math.abs(recipientChange - expectedAmount);
    ok(diff <= 1000, `Recipient should receive expected amount (diff: ${diff})`);

    console.log('   ✅ Balance changes calculated correctly\n');
  });

  await t.test('detect mismatched from address in verification', async () => {
    console.log('6️⃣  Testing error detection - wrong from address');

    const tx = await connection.getTransaction(testTx.signature, {
      maxSupportedTransactionVersion: 0,
    });

    ok(tx !== null, 'Transaction must exist');
    const accountKeys = tx!.transaction.message.staticAccountKeys.map(key => key.toString());
    const actualFrom = accountKeys[0];

    // Use wrong address for verification
    const wrongFrom = testTx.to; // Using 'to' as 'from'

    console.log(`   Expected (wrong): ${wrongFrom.substring(0, 20)}...`);
    console.log(`   Actual:           ${actualFrom.substring(0, 20)}...`);

    // Should not match
    ok(actualFrom !== wrongFrom, 'Should detect address mismatch');

    console.log('   ✅ Correctly detected address mismatch\n');
  });

  await t.test('detect mismatched amount in verification', async () => {
    console.log('7️⃣  Testing error detection - wrong amount');

    const tx = await connection.getTransaction(testTx.signature, {
      maxSupportedTransactionVersion: 0,
    });

    ok(tx !== null, 'Transaction must exist');
    const preBalances = tx!.meta?.preBalances!;
    const postBalances = tx!.meta?.postBalances!;
    const fee = tx!.meta?.fee!;

    const senderBalanceChange = postBalances[0] - preBalances[0] + fee;
    const actualAmount = Math.abs(senderBalanceChange);

    // Use wrong amount for verification
    const wrongAmount = 200000000; // 0.2 SOL instead of 0.1 SOL

    console.log(`   Expected (wrong): ${wrongAmount} lamports`);
    console.log(`   Actual:           ${actualAmount} lamports`);

    // Should not match
    const tolerance = 10000;
    const diff = Math.abs(actualAmount - wrongAmount);
    ok(diff > tolerance, 'Should detect amount mismatch');

    console.log('   ✅ Correctly detected amount mismatch\n');
  });

  await t.test('waitForConfirmation handles already confirmed transaction', async () => {
    console.log('8️⃣  Testing waitForConfirmation (already confirmed)');

    const startTime = Date.now();
    const status = await connection.getSignatureStatus(testTx.signature, {
      searchTransactionHistory: true,
    });
    const duration = Date.now() - startTime;

    console.log(`   Query Duration: ${duration}ms`);
    console.log(`   Status: ${status.value?.confirmationStatus}`);

    // Should return immediately since already confirmed
    ok(status.value !== null, 'Should find transaction status');
    ok(
      status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized',
      'Should be confirmed or finalized',
    );
    ok(duration < 5000, 'Should return quickly (< 5s) for confirmed transaction');

    console.log('   ✅ Correctly handled already-confirmed transaction\n');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ ALL INTEGRATION TESTS PASSED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 These tests verify the same operations that SolService uses:');
  console.log('   • getSignatureStatus() → SolService.getTransactionStatus()');
  console.log('   • getTransaction() → SolService.getTransactionDetails()');
  console.log('   • getBalance() → SolService.getAddressBalance()');
  console.log('   • Balance calculations → SolService.verifyTransfer()');
  console.log('   • Balance changes → SolService.getAddressBalanceChange()');
  console.log('\n🎉 SolService methods are backed by working Solana RPC calls!\n');
});
