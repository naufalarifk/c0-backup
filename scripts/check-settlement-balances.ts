#!/usr/bin/env tsx

/**
 * Settlement Balance Checker
 * 
 * This script checks:
 * 1. Hot wallet addresses for all blockchains
 * 2. On-chain balances for each address
 * 3. Database balances (if any)
 * 4. Binance balances via API
 * 5. Settlement calculation preview
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SettlementModule } from '../src/modules/settlement/settlement.module';
import { WalletModule } from '../src/shared/wallets/wallet.module';
import { SharedModule } from '../src/shared/shared.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [SharedModule, WalletModule, SettlementModule],
})
class CheckBalancesModule {}

async function checkBalances() {
  console.log('🔍 Settlement Balance Checker\n');
  console.log('='.repeat(80));

  const app = await NestFactory.createApplicationContext(CheckBalancesModule, {
    logger: ['error', 'warn'],
  });

  try {
    const walletService = app.get('WalletService');
    const binanceClient = app.get('BinanceClient');
    const appConfig = app.get('AppConfigService');
    
    console.log('\n📊 Configuration:');
    console.log(`   Environment: ${appConfig.nodeEnv}`);
    console.log(`   Binance API Enabled: ${appConfig.binanceApiEnabled}`);
    console.log(`   Binance API URL: ${appConfig.binanceApiBaseUrl}`);
    console.log(`   Settlement Target: ${appConfig.settlementTargetPercentage}%`);
    console.log(`   Settlement Min Amount: ${appConfig.settlementMinAmount}`);

    // Get all blockchain keys
    const blockchainKeys = [
      'eip155:56',      // BSC Mainnet
      'eip155:1',       // Ethereum Mainnet
      'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana Mainnet
    ];

    console.log('\n🔑 Hot Wallet Addresses:');
    console.log('='.repeat(80));

    const walletInfo: Array<{
      blockchain: string;
      address: string;
      balance?: string;
    }> = [];

    for (const blockchainKey of blockchainKeys) {
      try {
        const wallet = await walletService.getHotWallet(blockchainKey);
        const address = wallet.address;
        
        console.log(`\n${blockchainKey}:`);
        console.log(`   Address: ${address}`);
        
        // Try to get balance
        try {
          const balance = await wallet.getBalance();
          console.log(`   Balance: ${balance.value} ${balance.symbol}`);
          
          walletInfo.push({
            blockchain: blockchainKey,
            address,
            balance: `${balance.value} ${balance.symbol}`,
          });
        } catch (err) {
          console.log(`   Balance: Unable to fetch (${err instanceof Error ? err.message : 'Unknown error'})`);
          walletInfo.push({
            blockchain: blockchainKey,
            address,
            balance: 'Unable to fetch',
          });
        }
      } catch (err) {
        console.log(`\n${blockchainKey}:`);
        console.log(`   ❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Check Binance balances
    console.log('\n💰 Binance Exchange Balances:');
    console.log('='.repeat(80));

    if (appConfig.binanceApiEnabled && binanceClient.isApiEnabled()) {
      try {
        // Get account info
        const accountInfo = await binanceClient.getAccountInfo();
        
        console.log(`\nAccount Type: ${accountInfo.accountType}`);
        console.log(`Can Trade: ${accountInfo.canTrade}`);
        console.log(`Can Withdraw: ${accountInfo.canWithdraw}`);
        console.log(`Can Deposit: ${accountInfo.canDeposit}`);

        console.log('\nBalances (non-zero):');
        
        const nonZeroBalances = accountInfo.balances.filter(
          (b: { free: string; locked: string }) => 
            parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        );

        if (nonZeroBalances.length === 0) {
          console.log('   ⚠️  No balances found in Binance account');
        } else {
          for (const balance of nonZeroBalances) {
            const total = parseFloat(balance.free) + parseFloat(balance.locked);
            console.log(`   ${balance.asset}: ${total.toFixed(8)} (free: ${balance.free}, locked: ${balance.locked})`);
          }
        }

        // Check specific assets we care about
        console.log('\nKey Assets:');
        const keyAssets = ['BNB', 'USDT', 'BTC', 'ETH', 'SOL'];
        
        for (const asset of keyAssets) {
          const assetBalance = await binanceClient.getAssetBalance(asset);
          if (assetBalance) {
            const total = parseFloat(assetBalance.free) + parseFloat(assetBalance.locked);
            console.log(`   ${asset}: ${total.toFixed(8)}`);
          } else {
            console.log(`   ${asset}: 0.00000000`);
          }
        }

      } catch (err) {
        console.log(`\n❌ Error fetching Binance balances: ${err instanceof Error ? err.message : 'Unknown error'}`);
        if (err instanceof Error && err.message.includes('401')) {
          console.log('   💡 Tip: Check if your Binance API key is valid and IP is whitelisted');
        }
      }
    } else {
      console.log('\n⚠️  Binance API is disabled. Enable it in .env with BINANCE_API_ENABLED=true');
    }

    // Settlement Preview
    console.log('\n📈 Settlement Preview:');
    console.log('='.repeat(80));
    console.log('\nTo execute settlement, there must be:');
    console.log('1. ✓ Currencies registered in the database');
    console.log('2. ✓ Hot wallet balances recorded in the database (via deposits/transfers)');
    console.log('3. ✓ Total balance > minimum amount (0.01)');
    console.log('4. ✓ Valid Binance deposit addresses for each network');
    
    console.log('\nCurrent Status:');
    console.log(`   Hot Wallets Detected: ${walletInfo.length}`);
    console.log(`   Binance API: ${appConfig.binanceApiEnabled ? '✓ Enabled' : '✗ Disabled'}`);
    
    console.log('\n💡 Next Steps:');
    console.log('1. If balances show 0, you need to add test data or wait for real deposits');
    console.log('2. Test Binance deposit address: curl -X POST http://localhost:3000/api/test/settlement/binance-deposit-address -d \'{"asset":"BNB","network":"BSC"}\'');
    console.log('3. Execute settlement: curl -X POST http://localhost:3000/api/test/settlement/execute-settlement');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Balance check complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await app.close();
  }
}

checkBalances()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
