#!/usr/bin/env tsx
/**
 * Mainnet Balance Monitor
 * 
 * Checks real-time balances for hot wallet on all mainnet networks.
 * 
 * Usage:
 *   pnpm exec tsx scripts/monitor-mainnet-balances.ts
 */

import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';

// Hot wallet addresses (account 0 - default MetaMask path)
const ADDRESSES = {
    solana: 'FR7VaPGTSKFD94QFHwj5tRFekLBPyhmQ2yXjs4VUNbq7',
    ethereum: '0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3',
    bsc: '0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3',
};

const RPC = {
    solana: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    ethereum: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
};

async function checkSolanaBalance() {
    console.log('🔵 SOLANA MAINNET-BETA');
    console.log('─'.repeat(90));
    try {
        const connection = new Connection(RPC.solana, 'confirmed');
        const publicKey = new PublicKey(ADDRESSES.solana);

        // Get balance
        const lamports = await connection.getBalance(publicKey);
        const sol = lamports / LAMPORTS_PER_SOL;

        // Get slot (block height)
        const slot = await connection.getSlot();

        // Get version
        const version = await connection.getVersion();

        console.log(`   Chain ID       : solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`);
        console.log(`   Address        : ${ADDRESSES.solana}`);
        console.log(`   Balance        : ${sol.toFixed(9)} SOL`);
        console.log(`   Balance (raw)  : ${lamports.toLocaleString()} lamports`);
        console.log(`   Current Slot   : ${slot.toLocaleString()}`);
        console.log(`   Node Version   : ${version['solana-core']}`);
        console.log(`   RPC URL        : ${RPC.solana}`);

        if (sol > 0) {
            console.log(`   💰 Status      : HAS BALANCE (${sol} SOL)`);
        } else {
            console.log(`   ✅ Status      : Empty (0 SOL)`);
        }

        return { success: true, balance: sol };
    } catch (error) {
        console.log(`   ❌ Error       : ${error instanceof Error ? error.message : String(error)}`);
        return { success: false, error };
    }
}

async function checkEthereumBalance() {
    console.log('🔷 ETHEREUM MAINNET');
    console.log('─'.repeat(90));
    try {
        const provider = new ethers.JsonRpcProvider(RPC.ethereum);

        // Get network info
        const network = await provider.getNetwork();

        // Get balance
        const balanceWei = await provider.getBalance(ADDRESSES.ethereum);
        const balanceEth = ethers.formatEther(balanceWei);

        // Get block number
        const blockNumber = await provider.getBlockNumber();

        console.log(`   Chain ID       : eip155:${network.chainId}`);
        console.log(`   Address        : ${ADDRESSES.ethereum}`);
        console.log(`   Balance        : ${balanceEth} ETH`);
        console.log(`   Balance (raw)  : ${balanceWei.toString()} wei`);
        console.log(`   Block Number   : ${blockNumber.toLocaleString()}`);
        console.log(`   RPC URL        : ${RPC.ethereum}`);

        const balance = parseFloat(balanceEth);
        if (balance > 0) {
            console.log(`   💰 Status      : HAS BALANCE (${balanceEth} ETH)`);
        } else {
            console.log(`   ✅ Status      : Empty (0 ETH)`);
        }

        return { success: true, balance };
    } catch (error) {
        console.log(`   ❌ Error       : ${error instanceof Error ? error.message : String(error)}`);
        return { success: false, error };
    }
}

async function checkBscBalance() {
    console.log('🟡 BINANCE SMART CHAIN MAINNET');
    console.log('─'.repeat(90));
    try {
        const provider = new ethers.JsonRpcProvider(RPC.bsc);

        // Get network info
        const network = await provider.getNetwork();

        // Get balance
        const balanceWei = await provider.getBalance(ADDRESSES.bsc);
        const balanceBnb = ethers.formatEther(balanceWei);

        // Get block number
        const blockNumber = await provider.getBlockNumber();

        console.log(`   Chain ID       : eip155:${network.chainId}`);
        console.log(`   Address        : ${ADDRESSES.bsc}`);
        console.log(`   Balance        : ${balanceBnb} BNB`);
        console.log(`   Balance (raw)  : ${balanceWei.toString()} wei`);
        console.log(`   Block Number   : ${blockNumber.toLocaleString()}`);
        console.log(`   RPC URL        : ${RPC.bsc}`);

        const balance = parseFloat(balanceBnb);
        if (balance > 0) {
            console.log(`   💰 Status      : HAS BALANCE (${balanceBnb} BNB)`);
        } else {
            console.log(`   ✅ Status      : Empty (0 BNB)`);
        }

        return { success: true, balance };
    } catch (error) {
        console.log(`   ❌ Error       : ${error instanceof Error ? error.message : String(error)}`);
        return { success: false, error };
    }
}

async function main() {
    const timestamp = new Date().toISOString();

    console.log('\n💰 Hot Wallet Balance Monitor - Mainnet Networks\n');
    console.log('═'.repeat(90));
    console.log(`⏰ Timestamp: ${timestamp}`);
    console.log('✅ Using DEFAULT derivation path (account 0 - same as MetaMask)');
    console.log('═'.repeat(90));
    console.log('');

    const results = {
        solana: await checkSolanaBalance(),
        ethereum: await checkEthereumBalance(),
        bsc: await checkBscBalance(),
    };

    console.log('');
    console.log('═'.repeat(90));
    console.log('📊 BALANCE SUMMARY');
    console.log('═'.repeat(90));
    console.log('');

    const successCount = Object.values(results).filter((r) => r.success).length;
    const totalCount = Object.keys(results).length;

    console.log('┌────────────────┬──────────────────────────────┬─────────────────────┐');
    console.log('│ Network        │ Status                       │ Balance             │');
    console.log('├────────────────┼──────────────────────────────┼─────────────────────┤');

    const formatBalance = (result: { success: boolean; balance?: number }) => {
        if (!result.success) return 'Error';
        if (!result.balance) return '0';
        return result.balance > 0 ? `💰 ${result.balance}` : '0';
    };

    console.log(`│ Solana         │ ${results.solana.success ? '✅ Connected'.padEnd(28) : '❌ Failed'.padEnd(28)} │ ${formatBalance(results.solana).padEnd(19)} │`);
    console.log(`│ Ethereum       │ ${results.ethereum.success ? '✅ Connected'.padEnd(28) : '❌ Failed'.padEnd(28)} │ ${formatBalance(results.ethereum).padEnd(19)} │`);
    console.log(`│ BSC            │ ${results.bsc.success ? '✅ Connected'.padEnd(28) : '❌ Failed'.padEnd(28)} │ ${formatBalance(results.bsc).padEnd(19)} │`);
    console.log('└────────────────┴──────────────────────────────┴─────────────────────┘');
    console.log('');

    if (successCount === totalCount) {
        console.log(`✅ All networks checked successfully (${successCount}/${totalCount})`);

        const hasAnyBalance = Object.values(results).some((r) => r.success && r.balance && r.balance > 0);
        if (hasAnyBalance) {
            console.log('');
            console.log('⚠️  WARNING: Some wallets have balances!');
            console.log('   This is unexpected for test wallets.');
            console.log('   Please verify the addresses and investigate.');
        } else {
            console.log('');
            console.log('✅ All wallets are empty (expected for test wallet)');
        }
    } else {
        console.log(`⚠️  Some checks failed (${successCount}/${totalCount} succeeded)`);
        process.exit(1);
    }

    console.log('');
    console.log('═'.repeat(90));
    console.log('');
}

main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
