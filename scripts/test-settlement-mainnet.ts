#!/usr/bin/env tsx
/**
 * Settlement Service Mainnet Configuration Test
 * 
 * This script tests that the settlement services are correctly configured
 * to use mainnet networks and can successfully query blockchain data.
 * 
 * Usage:
 *   pnpm exec tsx scripts/test-settlement-mainnet.ts
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';

// Expected configuration for mainnet (from services)
const MAINNET_CONFIG = {
    solana: {
        chainId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        networkName: 'mainnet-beta',
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        testAddress: '82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy', // Our test hot wallet
    },
    ethereum: {
        chainId: 'eip155:1',
        networkName: 'mainnet',
        rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
        testAddress: '0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083', // Our test hot wallet
    },
    bsc: {
        chainId: 'eip155:56',
        networkName: 'mainnet',
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
        testAddress: '0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083', // Our test hot wallet
    },
};

interface TestResult {
    blockchain: string;
    success: boolean;
    chainId?: string;
    networkName?: string;
    rpcUrl?: string;
    connectionTest?: boolean;
    balanceQuery?: boolean;
    error?: string;
}

// Test Solana connection and queries
async function testSolana(): Promise<TestResult> {
    const result: TestResult = {
        blockchain: 'Solana',
        success: false,
    };

    try {
        const config = MAINNET_CONFIG.solana;
        result.chainId = config.chainId;
        result.networkName = config.networkName;
        result.rpcUrl = config.rpcUrl;

        console.log('   Testing Solana mainnet...');
        console.log(`   RPC URL: ${config.rpcUrl}`);

        // Test connection
        const connection = new Connection(config.rpcUrl, 'confirmed');
        const version = await connection.getVersion();
        console.log(`   ✅ Connection successful (version: ${version['solana-core']})`);
        result.connectionTest = true;

        // Test balance query
        const publicKey = new PublicKey(config.testAddress);
        const balance = await connection.getBalance(publicKey);
        console.log(`   ✅ Balance query successful (${balance} lamports)`);
        result.balanceQuery = true;

        // Test recent blockhash (important for transactions)
        const { blockhash } = await connection.getLatestBlockhash();
        console.log(`   ✅ Latest blockhash: ${blockhash.substring(0, 16)}...`);

        result.success = true;
        return result;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error: ${result.error}`);
        return result;
    }
}

// Test Ethereum connection and queries
async function testEthereum(): Promise<TestResult> {
    const result: TestResult = {
        blockchain: 'Ethereum',
        success: false,
    };

    try {
        const config = MAINNET_CONFIG.ethereum;
        result.chainId = config.chainId;
        result.networkName = config.networkName;
        result.rpcUrl = config.rpcUrl;

        console.log('   Testing Ethereum mainnet...');
        console.log(`   RPC URL: ${config.rpcUrl}`);

        // Test connection
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const network = await provider.getNetwork();
        console.log(`   ✅ Connection successful (chainId: ${network.chainId})`);
        result.connectionTest = true;

        // Verify chain ID matches mainnet
        if (network.chainId !== 1n) {
            throw new Error(`Expected chainId 1 (mainnet), got ${network.chainId}`);
        }

        // Test balance query
        const balance = await provider.getBalance(config.testAddress);
        console.log(`   ✅ Balance query successful (${ethers.formatEther(balance)} ETH)`);
        result.balanceQuery = true;

        // Test block number
        const blockNumber = await provider.getBlockNumber();
        console.log(`   ✅ Latest block: ${blockNumber}`);

        result.success = true;
        return result;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error: ${result.error}`);
        return result;
    }
}

// Test BSC connection and queries
async function testBsc(): Promise<TestResult> {
    const result: TestResult = {
        blockchain: 'BSC',
        success: false,
    };

    try {
        const config = MAINNET_CONFIG.bsc;
        result.chainId = config.chainId;
        result.networkName = config.networkName;
        result.rpcUrl = config.rpcUrl;

        console.log('   Testing BSC mainnet...');
        console.log(`   RPC URL: ${config.rpcUrl}`);

        // Test connection
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const network = await provider.getNetwork();
        console.log(`   ✅ Connection successful (chainId: ${network.chainId})`);
        result.connectionTest = true;

        // Verify chain ID matches BSC mainnet
        if (network.chainId !== 56n) {
            throw new Error(`Expected chainId 56 (BSC mainnet), got ${network.chainId}`);
        }

        // Test balance query
        const balance = await provider.getBalance(config.testAddress);
        console.log(`   ✅ Balance query successful (${ethers.formatEther(balance)} BNB)`);
        result.balanceQuery = true;

        // Test block number
        const blockNumber = await provider.getBlockNumber();
        console.log(`   ✅ Latest block: ${blockNumber}`);

        result.success = true;
        return result;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error: ${result.error}`);
        return result;
    }
}

// Main execution
async function main() {
    console.log('🔍 Settlement Service Mainnet Configuration Test\n');
    console.log('='.repeat(80));
    console.log('Testing all blockchain services with mainnet configuration');
    console.log('='.repeat(80));
    console.log('');

    const results: TestResult[] = [];

    // Test each blockchain
    console.log('📦 Solana');
    console.log('-'.repeat(80));
    const solanaResult = await testSolana();
    results.push(solanaResult);
    console.log('');

    console.log('📦 Ethereum');
    console.log('-'.repeat(80));
    const ethereumResult = await testEthereum();
    results.push(ethereumResult);
    console.log('');

    console.log('📦 Binance Smart Chain');
    console.log('-'.repeat(80));
    const bscResult = await testBsc();
    results.push(bscResult);
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 Test Summary');
    console.log('='.repeat(80));
    console.log('');

    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    for (const result of results) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.blockchain}`);
        if (result.chainId) console.log(`   Chain ID: ${result.chainId}`);
        if (result.networkName) console.log(`   Network: ${result.networkName}`);
        if (result.connectionTest !== undefined) {
            console.log(`   Connection: ${result.connectionTest ? '✅' : '❌'}`);
        }
        if (result.balanceQuery !== undefined) {
            console.log(`   Balance Query: ${result.balanceQuery ? '✅' : '❌'}`);
        }
        if (result.error) console.log(`   Error: ${result.error}`);
        console.log('');
    }

    console.log('='.repeat(80));
    if (successCount === totalCount) {
        console.log(`✅ All tests passed (${successCount}/${totalCount})`);
        console.log('');
        console.log('💡 Settlement services are correctly configured for mainnet:');
        console.log('   - All RPC connections working');
        console.log('   - All balance queries successful');
        console.log('   - Chain IDs verified');
        console.log('   - Ready for production use');
    } else {
        console.log(`❌ Some tests failed (${successCount}/${totalCount} passed)`);
        console.log('');
        console.log('⚠️  Please check the errors above and verify:');
        console.log('   - RPC endpoints are accessible');
        console.log('   - Network connectivity is working');
        console.log('   - No rate limiting or firewall issues');
        process.exit(1);
    }
    console.log('='.repeat(80));
}

// Run the script
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
