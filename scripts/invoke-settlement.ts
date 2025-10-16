#!/usr/bin/env tsx
/**
 * Script to manually invoke settlement process
 *
 * Usage:
 *   pnpm exec tsx scripts/invoke-settlement.ts
 *
 * This script will:
 * 1. Check wallet balances on all supported blockchains
 * 2. Check Binance balances
 * 3. Calculate settlement amounts based on configured target percentage
 * 4. Execute settlement transfers (deposit to or withdraw from Binance)
 * 5. Log all operations
 *
 * Configuration (in .env):
 *   NODE_ENV=production (for mainnet)
 *   SETTLEMENT_TARGET_PERCENTAGE=50 (default)
 *   SETTLEMENT_MIN_AMOUNT=0.01 (minimum amount to settle)
 *   BINANCE_API_ENABLED=true
 *   BINANCE_API_KEY=your_prod_key
 *   BINANCE_API_SECRET=your_prod_secret
 */

import 'dotenv/config';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SharedModule } from '../src/shared/shared.module';
import { SettlementModule } from '../src/modules/settlement/settlement.module';
import { SettlementService } from '../src/modules/settlement/services/core/settlement.service';
import { BinanceSettlementService } from '../src/modules/settlement/services/binance/binance-settlement.service';
import { WalletService } from '../src/shared/wallets/wallet.service';

@Module({
    imports: [SharedModule, SettlementModule],
})
class SettlementInvokeModule { }

async function main() {
    console.log('🚀 Invoking Settlement Process');
    console.log('='.repeat(80));
    console.log(`   Date: ${new Date().toISOString()}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(80));
    console.log('');

    try {
        // Initialize NestJS application context
        console.log('📦 Initializing application...');
        const app = await NestFactory.createApplicationContext(SettlementInvokeModule, {
            logger: ['error', 'warn', 'log'],
        });

        const settlementService = app.get(SettlementService);
        const binanceSettlement = app.get(BinanceSettlementService);
        const walletService = app.get(WalletService);

        console.log('✅ Application initialized\n');

        // Check Binance API status
        console.log('📊 Checking Binance API status...');
        const binanceStatus = await binanceSettlement.getStatus();
        console.log(`   Binance API Enabled: ${binanceStatus.binanceApiEnabled}`);
        console.log(`   Binance API Operational: ${binanceStatus.binanceApiOperational}`);
        console.log(`   Ready for Settlement: ${binanceStatus.readyForSettlement}`);

        if (!binanceStatus.readyForSettlement) {
            console.log('\n⚠️  Warning: Binance API not ready');
            console.log('   Settlement will proceed with blockchain transfers only');
            console.log('   To enable Binance integration:');
            console.log('   1. Set BINANCE_API_ENABLED=true in .env');
            console.log('   2. Configure BINANCE_API_KEY and BINANCE_API_SECRET');
            console.log('   3. Ensure API key has "Enable Reading" and "Enable Withdrawals" permissions');
            console.log('');
        }

        // Get settlement configuration
        const targetPercentage = Number.parseInt(process.env.SETTLEMENT_TARGET_PERCENTAGE || '50');
        const minAmount = Number.parseFloat(process.env.SETTLEMENT_MIN_AMOUNT || '0.01');

        console.log('\n⚙️  Settlement Configuration:');
        console.log(`   Target Percentage: ${targetPercentage}%`);
        console.log(`   Minimum Amount: ${minAmount}`);
        console.log('');

        // Check wallet balances
        console.log('='.repeat(80));
        console.log('💰 Checking Hot Wallet Balances');
        console.log('='.repeat(80));

        const blockchains = [
            { name: 'BSC Mainnet', key: 'eip155:56', asset: 'BNB' },
            { name: 'Ethereum Mainnet', key: 'eip155:1', asset: 'ETH' },
            { name: 'Solana Mainnet', key: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', asset: 'SOL' },
        ];

        for (const blockchain of blockchains) {
            try {
                const address = walletService.getAddress(blockchain.key);
                console.log(`\n${blockchain.name}:`);
                console.log(`   Address: ${address}`);
                // Note: Getting balance would require blockchain-specific services
                // For now, just show the address
            } catch (error) {
                console.log(`\n${blockchain.name}:`);
                console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Check Binance balances
        if (binanceStatus.readyForSettlement) {
            console.log('\n='.repeat(80));
            console.log('💰 Checking Binance Balances');
            console.log('='.repeat(80));

            for (const blockchain of blockchains) {
                try {
                    const balance = await binanceSettlement.getBinanceBalance(blockchain.asset);
                    console.log(`\n${blockchain.asset}:`);
                    console.log(`   Free: ${balance.free}`);
                    console.log(`   Locked: ${balance.locked}`);
                    console.log(`   Total: ${balance.total}`);
                } catch (error) {
                    console.log(`\n${blockchain.asset}:`);
                    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }

        // Invoke settlement
        console.log('\n' + '='.repeat(80));
        console.log('🔄 Invoking Settlement Process');
        console.log('='.repeat(80));
        console.log('\nThis will:');
        console.log('1. Calculate settlement amounts for each blockchain');
        console.log('2. Transfer funds from hot wallet to Binance (if needed)');
        console.log('3. Withdraw funds from Binance to hot wallet (if needed)');
        console.log('4. Log all operations to settlement_logs table');
        console.log('');

        // Ask for confirmation (in real usage, you might want to add a prompt here)
        console.log('⚠️  Starting settlement in 3 seconds...');
        console.log('   Press Ctrl+C to cancel\n');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Execute settlement
        console.log('▶️  Executing settlement...\n');
        const results = await settlementService.executeSettlement();

        console.log('\n' + '='.repeat(80));
        console.log('✨ Settlement Complete');
        console.log('='.repeat(80));

        if (results.length === 0) {
            console.log('\n   No settlements executed');
            console.log('   This could mean:');
            console.log('   - No currencies with balances found in hot wallets');
            console.log('   - All balances already at target percentage');
            console.log('   - Settlement is disabled in configuration');
        } else {
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            console.log(`\n   Total Results: ${results.length}`);
            console.log(`   Success: ${successCount}`);
            console.log(`   Failed: ${failCount}`);

            console.log('\n   Details:');
            for (const result of results) {
                console.log(`\n   ${result.success ? '✅' : '❌'} ${result.blockchainKey}:`);
                console.log(`      Original Balance: ${result.originalBalance}`);
                console.log(`      Settlement Amount: ${result.settlementAmount}`);
                console.log(`      Remaining Balance: ${result.remainingBalance}`);
                if (result.transactionHash) {
                    console.log(`      TX Hash: ${result.transactionHash}`);
                }
                if (result.error) {
                    console.log(`      Error: ${result.error}`);
                }
                if (result.verified !== undefined) {
                    console.log(`      Verified: ${result.verified ? 'Yes' : 'No'}`);
                    if (result.verificationError) {
                        console.log(`      Verification Error: ${result.verificationError}`);
                    }
                }
            }
        }

        console.log('');
        await app.close();

    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
