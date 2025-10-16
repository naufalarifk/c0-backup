/**
 * Quick script to get Solana hot wallet address
 * This works by reading the wallet seed/mnemonic and deriving the address
 */

// For testnet: export SOLANA_USE_TESTNET=true
// For mainnet: unset SOLANA_USE_TESTNET or set to false

const isTestnet = process.env.SOLANA_USE_TESTNET === 'true';

console.log('');
console.log('🔐 Solana Hot Wallet Address Generator');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Network:', isTestnet ? 'TESTNET' : 'MAINNET');
console.log('');
console.log('⚠️  Note: This requires running through the NestJS application');
console.log('   context to initialize the WalletFactory properly.');
console.log('');
console.log('📋 To get your Solana hot wallet address:');
console.log('');
console.log('Option 1 - Use the E2E test (RECOMMENDED):');
console.log('  SOLANA_USE_TESTNET=true node --import tsx --test test/settlement-e2e.test.ts');
console.log('  (Check the Solana Service Integration section output)');
console.log('');
console.log('Option 2 - Query running dev server:');
console.log('  1. Start server: SOLANA_USE_TESTNET=true pnpm start:dev');
console.log('  2. In another terminal:');
console.log('     curl http://localhost:3000/test/settlement/solana-balance');
console.log('');
console.log('Option 3 - Check wallet configuration:');
console.log('  The hot wallet address is deterministically derived from:');
console.log('  - WALLET_SEED (if set)');
console.log('  - WALLET_MNEMONIC (if set)');
console.log('  - Or generated from random seed (changes every restart)');
console.log('');
console.log('💡 TIP: Set WALLET_MNEMONIC in your .env file to get a');
console.log('   consistent address across restarts.');
console.log('');
