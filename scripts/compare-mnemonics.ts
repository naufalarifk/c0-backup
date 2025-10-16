#!/usr/bin/env tsx
/**
 * Compare addresses from different mnemonics
 */

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';

const MNEMONIC_1 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const MNEMONIC_2 = 'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';

function toHex(bytes: Uint8Array): string {
    return '0x' + Buffer.from(bytes).toString('hex');
}

async function deriveAddresses(mnemonic: string) {
    const seed = await mnemonicToSeed(mnemonic);
    const masterKey = HDKey.fromMasterSeed(seed);

    // Solana (account 1005)
    const solPath = "m/44'/501'/0'/0/0";
    const solKey = masterKey.derive(solPath);
    if (!solKey.privateKey) throw new Error('No private key');
    const solKeypair = Keypair.fromSeed(solKey.privateKey.slice(0, 32));
    const solAddress = solKeypair.publicKey.toBase58();

    // EVM (account 1005)
    const evmPath = "m/44'/60'/0'/0/0";
    const evmKey = masterKey.derive(evmPath);
    if (!evmKey.privateKey) throw new Error('No private key');
    const evmWallet = new ethers.Wallet(toHex(evmKey.privateKey));
    const evmAddress = evmWallet.address;

    return { solAddress, evmAddress };
}

async function main() {
    console.log('\n🔑 Mnemonic Comparison\n');
    console.log('═'.repeat(90));

    console.log('\n📝 MNEMONIC 1 (BIP39 standard test):');
    console.log('   ' + MNEMONIC_1);
    console.log('\n   Generated Addresses:');
    const addr1 = await deriveAddresses(MNEMONIC_1);
    console.log('   Solana  : ' + addr1.solAddress);
    console.log('   ETH/BSC : ' + addr1.evmAddress);

    console.log('\n📝 MNEMONIC 2 (Our E2E test mnemonic):');
    console.log('   ' + MNEMONIC_2);
    console.log('\n   Generated Addresses:');
    const addr2 = await deriveAddresses(MNEMONIC_2);
    console.log('   Solana  : ' + addr2.solAddress);
    console.log('   ETH/BSC : ' + addr2.evmAddress);
    console.log('   💰 BSC has 0.001 BNB on mainnet!');

    console.log('\n═'.repeat(90));
    console.log('✅ These are COMPLETELY DIFFERENT addresses from different mnemonics!');
    console.log('   Always use the SAME mnemonic to get the SAME addresses.');
    console.log('═'.repeat(90));
    console.log('');
}

main().catch(console.error);
