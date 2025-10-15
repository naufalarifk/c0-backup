#!/usr/bin/env node

/**
 * Get Solana Hot Wallet Address
 * Usage: SOLANA_USE_TESTNET=true node scripts/get-solana-address.js
 */

import { WalletFactory } from '../src/shared/wallets/wallet.factory';
import { WalletConfig } from '../src/shared/wallets/wallet.config';

const SOLANA_MAINNET_KEY = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_TESTNET_KEY = 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z';

const isTestnet = process.env.SOLANA_USE_TESTNET === 'true';
const blockchainKey = isTestnet ? SOLANA_TESTNET_KEY : SOLANA_MAINNET_KEY;
const network = isTestnet ? 'testnet' : 'mainnet';

async function getAddress() {
  try {
    console.log('');
    console.log('🔍 Initializing wallet factory...');
    
    const config = new WalletConfig();
    const factory = new WalletFactory(config);
    
    console.log(`📡 Fetching Solana ${network} hot wallet...`);
    
    const blockchain = factory.getBlockchain(blockchainKey);
    if (!blockchain) {
      console.error(`❌ Blockchain ${blockchainKey} not found`);
      console.error('   Available blockchains:', factory.getAllBlockchains().map(b => b.constructor.name).join(', '));
      process.exit(1);
    }
    
    const hotWallet = await blockchain.getHotWallet();
    const address = await hotWallet.getAddress();
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ SOLANA ${network.toUpperCase()} HOT WALLET ADDRESS:`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  ', address);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 Blockchain Key:', blockchainKey);
    console.log('🌐 Network:', network);
    
    if (isTestnet) {
      console.log('');
      console.log('💰 Next Steps:');
      console.log('   1. Visit: https://faucet.solana.com');
      console.log('   2. Paste this address:', address);
      console.log('   3. Request 1-2 SOL');
      console.log('   4. Wait ~10 seconds for confirmation');
      console.log('');
      console.log('🔍 Check balance:');
      console.log(`   https://explorer.solana.com/address/${address}?cluster=testnet`);
    } else {
      console.log('');
      console.log('⚠️  This is MAINNET address - use real SOL only!');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

getAddress();
