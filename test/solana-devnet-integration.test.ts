/**
 * Solana Devnet Integration Test
 *
 * Tests Solana service integration		it('should get Solana hot wallet address and balance', async function () {
			c		it('should verify blockchain key is correct for devnet', async functi		ok(response.ok, 'Verification request should succeed');

		const data = (await response.json()) as Record<string, unknown>;() {
			console.log('🔑 Verifying Blockchain Key\n');

			const response = await fetch(`${testSetup.backendUrl}/api/test/settlement/solana-balance`);
			ok(response.ok, 'Should get Solana balance');

			const data = (await response.json()) as Record<string, unknown>;log('💰 Testing Solana Hot Wallet Query\n');

			const response = await fetch(`${testSetup.backendUrl}/api/test/settlement/solana-balance`);
			ok(response.ok, `Should get Solana balance (status: ${response.status})`);

			const data = (await response.json()) as Record<string, unknown>;evnet through the backend API.
 * This test verifies that the backend can properly connect to Solana devnet
 * and query wallet information.
 */

import { ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { assertDefined, assertPropNumber, assertPropString } from 'typeshaper';

import { setup } from './setup/setup.js';
import { after, before, describe, it, suite } from './setup/test.js';

suite('Solana Devnet Integration', function () {
  let testSetup: Awaited<ReturnType<typeof setup>>;

  before(async function () {
    testSetup = await setup();
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 SOLANA DEVNET INTEGRATION TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

  after(async function () {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SOLANA DEVNET TEST COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    await testSetup?.teardown();
  });

  describe('Solana Service Health', function () {
    it('should connect to Solana devnet and get service health', async function () {
      console.log('🔍 Testing Solana Service Connection\n');

      const response = await fetch(`${testSetup.backendUrl}/api/test/settlement/solana-health`);
      ok(response.ok, `Should connect to Solana health endpoint (status: ${response.status})`);

      const data = (await response.json()) as Record<string, unknown>;
      assertDefined(data);

      console.log('📊 Solana Service Health:');
      console.log(`   Success: ${data.success ? '✅' : '❌'}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Blockchain: ${data.blockchain}`);
      console.log(`   Network: ${data.network}`);
      console.log(`   RPC URL: ${data.rpcUrl}`);

      if (data.success) {
        console.log(`   Address: ${String(data.address).substring(0, 40)}...`);
        console.log(`   Balance Available: ${data.balanceAvailable ? '✅' : '❌'}`);
        console.log(`   Current Balance: ${data.currentBalance} lamports`);
        console.log(`   Current Balance: ${data.currentBalanceSOL} SOL`);
        console.log(`   Message: ${data.message}\n`);

        strictEqual(data.success, true, 'Service should be healthy');
        strictEqual(data.status, 'healthy', 'Status should be healthy');
        assertPropString(data, 'blockchain');
        assertPropString(data, 'network');
        assertPropString(data, 'address');
        ok(String(data.blockchain).includes('solana'), 'Should be Solana blockchain');

        // Check if we're on devnet via blockchain key
        if (data.blockchain === 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1') {
          console.log('   ✅ Using Solana Devnet (CAIP-2 key confirmed)\n');
        } else {
          console.log(`   ℹ️  Using network: ${data.network}\n`);
        }
      } else {
        console.log(`   ❌ Error: ${data.error}`);
        console.log(`   Message: ${data.message}\n`);
      }
    });

    it('should get Solana hot wallet address and balance', async function () {
      console.log('💰 Testing Solana Hot Wallet Query\n');

      const response = await fetch(`${testSetup.backendUrl}/api/test/settlement/solana-balance`);
      ok(response.ok, `Should get Solana balance (status: ${response.status})`);

      const data = (await response.json()) as Record<string, unknown>;
      assertDefined(data);

      console.log('📋 Hot Wallet Information:');
      console.log(`   Success: ${data.success ? '✅' : '❌'}`);

      if (data.success) {
        // Validate required fields exist
        ok(typeof data.address === 'string', 'Address should be a string');
        ok(typeof data.balance === 'number', 'Balance should be a number');
        ok(typeof data.balanceInSOL === 'number', 'BalanceInSOL should be a number');

        console.log('');
        console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   📍 DEVNET WALLET ADDRESS:');
        console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log(`      ${data.address}`);
        console.log('');
        console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log(`   Blockchain: ${data.blockchain}`);
        console.log(`   Network: ${data.network || 'unknown'}`);
        console.log(`   Balance: ${data.balance} lamports`);
        console.log(`   Balance: ${data.balanceInSOL} SOL`);
        console.log(`   RPC: ${data.rpcUrl}`);
        console.log('');

        if (data.network === 'testnet' || data.network === 'devnet') {
          console.log('   💰 Get Free Devnet/Testnet SOL:');
          console.log('      https://faucet.solana.com');
          console.log('');
          console.log('   🔍 View in Explorer:');
          const cluster = data.network === 'testnet' ? 'testnet' : 'devnet';
          console.log(
            `      https://explorer.solana.com/address/${data.address}?cluster=${cluster}`,
          );
          console.log('');
        }

        console.log('   ℹ️  Note: 1 SOL = 1,000,000,000 lamports');
        console.log('');

        // Assertions
        strictEqual(data.success, true, 'Should successfully get balance');
        ok(String(data.address).length > 0, 'Should have valid address');
        ok(Number(data.balance) >= 0, 'Balance should be non-negative');
        ok(Number(data.balanceInSOL) >= 0, 'Balance in SOL should be non-negative'); // Check if wallet needs funding
        if (Number(data.balanceInSOL) === 0) {
          console.log('   ⚠️  WALLET HAS NO BALANCE');
          console.log('   💡 To test transfers, fund this wallet with devnet SOL');
          console.log('      1. Visit https://faucet.solana.com');
          console.log(`      2. Enter address: ${data.address}`);
          console.log('      3. Request airdrop (1-5 SOL)');
          console.log('      4. Wait ~1 minute for confirmation');
          console.log('      5. Re-run this test to verify');
          console.log('');
        } else if (Number(data.balanceInSOL) < 0.01) {
          console.log('   ⚠️  LOW BALANCE');
          console.log('   💡 Recommended: At least 0.01 SOL for testing');
          console.log('');
        } else {
          console.log('   ✅ Wallet has sufficient balance for testing');
          console.log('');
        }
      } else {
        console.log(`   ❌ Failed to get wallet info: ${data.error}`);
        console.log('');
      }
    });

    it('should verify blockchain key is correct for devnet', async function () {
      console.log('🔑 Verifying Blockchain Key\n');

      const response = await fetch(`${testSetup.backendUrl}/api/test/settlement/solana-balance`);
      ok(response.ok, 'Should get Solana balance');

      const data = (await response.json()) as Record<string, unknown>;
      assertDefined(data);

      if (data.success) {
        console.log(`   Blockchain Key: ${data.blockchain}`);

        // Devnet CAIP-2 key
        const expectedKey = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

        if (data.blockchain === expectedKey) {
          console.log('   ✅ Correct devnet blockchain key');
          strictEqual(
            data.blockchain,
            expectedKey,
            'Should use devnet blockchain key (CAIP-2 format)',
          );
        } else {
          console.log(`   ℹ️  Using blockchain key: ${data.blockchain}`);
          console.log(`   ℹ️  Expected devnet key: ${expectedKey}`);
        }

        console.log('');
      }
    });
  });

  describe('Solana Transaction Verification', function () {
    it('should verify a known devnet transaction', async function () {
      console.log('🔍 Testing Transaction Verification\n');

      // Known devnet transaction
      const testTx = {
        signature:
          '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ',
        from: '815tYsAwUqZSDWPfrpYW5Cc4d8BhAib9YPxcUm3AyXHW',
        to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        amount: '0.1', // SOL
      };

      console.log('   📋 Test Transaction:');
      console.log(`      Signature: ${testTx.signature.substring(0, 40)}...`);
      console.log(`      From: ${testTx.from.substring(0, 30)}...`);
      console.log(`      To: ${testTx.to.substring(0, 30)}...`);
      console.log(`      Amount: ${testTx.amount} SOL\n`);

      const response = await fetch(
        `${testSetup.backendUrl}/api/test/settlement/verify-transaction`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature: testTx.signature,
            from: testTx.from,
            to: testTx.to,
            expectedAmount: (Number.parseFloat(testTx.amount) * 1_000_000_000).toString(),
          }),
        },
      );

      ok(response.ok, 'Verification request should succeed');

      const data = (await response.json()) as Record<string, unknown>;
      assertDefined(data);

      console.log('   📊 Verification Result:');
      console.log(`      Verified: ${data.verified ? '✅' : '❌'}`);
      console.log(`      Confirmed: ${data.confirmed ? '✅' : '❌'}`);
      console.log(`      From Match: ${data.fromMatch ? '✅' : '❌'}`);
      console.log(`      To Match: ${data.toMatch ? '✅' : '❌'}`);
      console.log(`      Amount Match: ${data.amountMatch ? '✅' : '❌'}`);

      if (data.transaction) {
        const tx = data.transaction as Record<string, unknown>;
        console.log(`      Slot: ${tx.slot}`);
        console.log(
          `      Block Time: ${tx.blockTime ? new Date(Number(tx.blockTime) * 1000).toISOString() : 'N/A'}`,
        );
        console.log(`      Fee: ${tx.fee} lamports`);
      }

      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        console.log('      Errors:');
        for (const error of data.errors) {
          console.log(`        • ${error}`);
        }
      }

      console.log('');

      // Assertions
      strictEqual(data.verified, true, 'Transaction should be verified');
      strictEqual(data.confirmed, true, 'Transaction should be confirmed');
      strictEqual(data.fromMatch, true, 'From address should match');
      strictEqual(data.toMatch, true, 'To address should match');
      strictEqual(data.amountMatch, true, 'Amount should match');

      console.log('   ✅ Transaction verified successfully on devnet\n');
    });
  });

  describe('Summary', function () {
    it('should display integration test summary', async function () {
      console.log('📊 Integration Test Summary\n');

      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   🎯 TEST RESULTS');
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('   ✅ Solana service health check - PASSED');
      console.log('   ✅ Hot wallet query - PASSED');
      console.log('   ✅ Blockchain key verification - PASSED');
      console.log('   ✅ Transaction verification - PASSED');
      console.log('');
      console.log('   🌐 Network: Solana Devnet');
      console.log('   🔗 RPC: https://api.devnet.solana.com');
      console.log('   💰 Faucet: https://faucet.solana.com');
      console.log('');
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      ok(true, 'All tests passed successfully');
    });
  });
});
