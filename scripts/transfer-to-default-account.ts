#!/usr/bin/env tsx
/**
 * Transfer funds from account 1005 (hot wallet) to account 0 (default MetaMask)
 * 
 * This script transfers all available balance from the hot wallet (account 1005)
 * to the default wallet (account 0) that MetaMask shows by default.
 * 
 * Usage:
 *   NETWORK=bsc pnpm exec tsx scripts/execute-settlement-transfer.ts
 *   NETWORK=eth pnpm exec tsx scripts/execute-settlement-transfer.ts
 *   NETWORK=sol pnpm exec tsx scripts/execute-settlement-transfer.ts
 */

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { Keypair, Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';

const MNEMONIC = process.env.WALLET_MNEMONIC ||
    'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';

const NETWORK = process.env.NETWORK || 'bsc'; // bsc, eth, or sol

function toHex(bytes: Uint8Array): string {
    return '0x' + Buffer.from(bytes).toString('hex');
}

interface WalletInfo {
    address: string;
    privateKey: string | Uint8Array;
}

async function deriveEVMWallet(accountIndex: number): Promise<WalletInfo> {
    const seed = await mnemonicToSeed(MNEMONIC);
    const masterKey = HDKey.fromMasterSeed(seed);
    const path = `m/44'/60'/${accountIndex}'/0/0`;
    const key = masterKey.derive(path);

    if (!key.privateKey) throw new Error('No private key');

    const wallet = new ethers.Wallet(toHex(key.privateKey));
    return {
        address: wallet.address,
        privateKey: toHex(key.privateKey),
    };
}

async function deriveSolanaWallet(accountIndex: number): Promise<WalletInfo> {
    const seed = await mnemonicToSeed(MNEMONIC);
    const masterKey = HDKey.fromMasterSeed(seed);
    const path = `m/44'/501'/${accountIndex}'/0/0`;
    const key = masterKey.derive(path);

    if (!key.privateKey) throw new Error('No private key');

    const keypair = Keypair.fromSeed(key.privateKey.slice(0, 32));
    return {
        address: keypair.publicKey.toBase58(),
        privateKey: key.privateKey.slice(0, 32),
    };
}

async function transferBSC() {
    console.log('\n💸 BSC Transfer: Account 1005 → Account 0\n');
    console.log('═'.repeat(90));

    const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Derive both wallets
    const from = await deriveEVMWallet(1005);
    const to = await deriveEVMWallet(0);

    console.log(`From (Account 1005): ${from.address}`);
    console.log(`To (Account 0)     : ${to.address}`);
    console.log('');

    // Get balance
    const balance = await provider.getBalance(from.address);
    console.log(`Current Balance: ${ethers.formatEther(balance)} BNB`);

    if (balance === 0n) {
        console.log('❌ No balance to transfer');
        return;
    }

    // Estimate gas
    const wallet = new ethers.Wallet(from.privateKey as string, provider);
    const gasPrice = (await provider.getFeeData()).gasPrice;

    if (!gasPrice) throw new Error('Could not get gas price');

    const gasLimit = 21000n; // Standard transfer
    const gasCost = gasPrice * gasLimit;
    const amountToSend = balance - gasCost;

    if (amountToSend <= 0n) {
        console.log('❌ Insufficient balance to cover gas fees');
        console.log(`   Balance: ${ethers.formatEther(balance)} BNB`);
        console.log(`   Gas Cost: ${ethers.formatEther(gasCost)} BNB`);
        return;
    }

    console.log('');
    console.log('Transaction Details:');
    console.log(`   Amount to Send: ${ethers.formatEther(amountToSend)} BNB`);
    console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
    console.log(`   Gas Limit: ${gasLimit}`);
    console.log(`   Gas Cost: ${ethers.formatEther(gasCost)} BNB`);
    console.log('');

    // Confirm
    console.log('⚠️  Ready to send transaction...');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Send transaction
    console.log('');
    console.log('📤 Sending transaction...');

    const tx = await wallet.sendTransaction({
        to: to.address,
        value: amountToSend,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
    });

    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log(`   View on BscScan: https://bscscan.com/tx/${tx.hash}`);
    console.log('');
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log('');
    console.log('💰 Final Balances:');
    const finalFromBalance = await provider.getBalance(from.address);
    const finalToBalance = await provider.getBalance(to.address);
    console.log(`   From (Account 1005): ${ethers.formatEther(finalFromBalance)} BNB`);
    console.log(`   To (Account 0)     : ${ethers.formatEther(finalToBalance)} BNB`);
    console.log('');
    console.log('═'.repeat(90));
}

async function transferETH() {
    console.log('\n💸 Ethereum Transfer: Account 1005 → Account 0\n');
    console.log('═'.repeat(90));

    const rpcUrl = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Derive both wallets
    const from = await deriveEVMWallet(1005);
    const to = await deriveEVMWallet(0);

    console.log(`From (Account 1005): ${from.address}`);
    console.log(`To (Account 0)     : ${to.address}`);
    console.log('');

    // Get balance
    const balance = await provider.getBalance(from.address);
    console.log(`Current Balance: ${ethers.formatEther(balance)} ETH`);

    if (balance === 0n) {
        console.log('❌ No balance to transfer');
        return;
    }

    // Estimate gas
    const wallet = new ethers.Wallet(from.privateKey as string, provider);
    const gasPrice = (await provider.getFeeData()).gasPrice;

    if (!gasPrice) throw new Error('Could not get gas price');

    const gasLimit = 21000n; // Standard transfer
    const gasCost = gasPrice * gasLimit;
    const amountToSend = balance - gasCost;

    if (amountToSend <= 0n) {
        console.log('❌ Insufficient balance to cover gas fees');
        console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
        console.log(`   Gas Cost: ${ethers.formatEther(gasCost)} ETH`);
        return;
    }

    console.log('');
    console.log('Transaction Details:');
    console.log(`   Amount to Send: ${ethers.formatEther(amountToSend)} ETH`);
    console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
    console.log(`   Gas Limit: ${gasLimit}`);
    console.log(`   Gas Cost: ${ethers.formatEther(gasCost)} ETH`);
    console.log('');

    // Confirm
    console.log('⚠️  Ready to send transaction...');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Send transaction
    console.log('');
    console.log('📤 Sending transaction...');

    const tx = await wallet.sendTransaction({
        to: to.address,
        value: amountToSend,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
    });

    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log(`   View on Etherscan: https://etherscan.io/tx/${tx.hash}`);
    console.log('');
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log('');
    console.log('💰 Final Balances:');
    const finalFromBalance = await provider.getBalance(from.address);
    const finalToBalance = await provider.getBalance(to.address);
    console.log(`   From (Account 1005): ${ethers.formatEther(finalFromBalance)} ETH`);
    console.log(`   To (Account 0)     : ${ethers.formatEther(finalToBalance)} ETH`);
    console.log('');
    console.log('═'.repeat(90));
}

async function transferSOL() {
    console.log('\n💸 Solana Transfer: Account 1005 → Account 0\n');
    console.log('═'.repeat(90));

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Derive both wallets
    const from = await deriveSolanaWallet(1005);
    const to = await deriveSolanaWallet(0);

    console.log(`From (Account 1005): ${from.address}`);
    console.log(`To (Account 0)     : ${to.address}`);
    console.log('');

    // Get balance
    const fromPubkey = new PublicKey(from.address);
    const toPubkey = new PublicKey(to.address);

    const balance = await connection.getBalance(fromPubkey);
    console.log(`Current Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);

    if (balance === 0) {
        console.log('❌ No balance to transfer');
        return;
    }

    // Estimate transaction fee
    const { blockhash } = await connection.getLatestBlockhash();
    const testTx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey,
    }).add(
        SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: balance,
        })
    );

    const fee = await connection.getFeeForMessage(testTx.compileMessage());
    const txFee = fee.value || 5000; // Default 5000 lamports if estimation fails
    const amountToSend = balance - txFee;

    if (amountToSend <= 0) {
        console.log('❌ Insufficient balance to cover transaction fee');
        console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
        console.log(`   Fee: ${(txFee / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
        return;
    }

    console.log('');
    console.log('Transaction Details:');
    console.log(`   Amount to Send: ${(amountToSend / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    console.log(`   Transaction Fee: ${(txFee / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    console.log('');

    // Confirm
    console.log('⚠️  Ready to send transaction...');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Send transaction
    console.log('');
    console.log('📤 Sending transaction...');

    const keypair = Keypair.fromSeed(from.privateKey as Uint8Array);
    const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey,
    }).add(
        SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: amountToSend,
        })
    );

    const signature = await connection.sendTransaction(transaction, [keypair]);

    console.log(`✅ Transaction sent: ${signature}`);
    console.log(`   View on Solscan: https://solscan.io/tx/${signature}`);
    console.log('');
    console.log('⏳ Waiting for confirmation...');

    await connection.confirmTransaction(signature, 'confirmed');

    console.log(`✅ Transaction confirmed`);
    console.log('');
    console.log('💰 Final Balances:');
    const finalFromBalance = await connection.getBalance(fromPubkey);
    const finalToBalance = await connection.getBalance(toPubkey);
    console.log(`   From (Account 1005): ${(finalFromBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    console.log(`   To (Account 0)     : ${(finalToBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    console.log('');
    console.log('═'.repeat(90));
}

async function main() {
    console.log('\n💸 Settlement Transfer Tool\n');
    console.log('═'.repeat(90));
    console.log('⚠️  This will transfer ALL funds from account 1005 to account 0');
    console.log('   Account 1005 = Hot wallet (has funds)');
    console.log('   Account 0    = Default MetaMask account (will receive funds)');
    console.log('═'.repeat(90));

    try {
        if (NETWORK === 'bsc') {
            await transferBSC();
        } else if (NETWORK === 'eth') {
            await transferETH();
        } else if (NETWORK === 'sol') {
            await transferSOL();
        } else {
            console.error(`\n❌ Invalid network: ${NETWORK}`);
            console.log('\nUsage:');
            console.log('   NETWORK=bsc pnpm exec tsx scripts/execute-settlement-transfer.ts');
            console.log('   NETWORK=eth pnpm exec tsx scripts/execute-settlement-transfer.ts');
            console.log('   NETWORK=sol pnpm exec tsx scripts/execute-settlement-transfer.ts');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

main().catch(console.error);
