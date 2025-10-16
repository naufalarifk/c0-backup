#!/usr/bin/env tsx
/**
 * Show all accounts from the test mnemonic (like MetaMask's account switcher)
 */

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';

const MNEMONIC = 'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';

function toHex(bytes: Uint8Array): string {
    return '0x' + Buffer.from(bytes).toString('hex');
}

async function showAllAccounts() {
    const seed = await mnemonicToSeed(MNEMONIC);
    const masterKey = HDKey.fromMasterSeed(seed);

    console.log('\n🦊 MetaMask-Style Account List (EVM)\n');
    console.log('═'.repeat(100));
    console.log('Mnemonic: increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle');
    console.log('═'.repeat(100));
    console.log('');

    console.log('📝 ETHEREUM/BSC ACCOUNTS (like MetaMask shows)\n');

    // Show first few accounts (MetaMask default behavior)
    const accounts = [0, 1, 2, 3, 4, 5, 1005]; // Include our account 1005

    for (const accountIndex of accounts) {
        const path = `m/44'/60'/${accountIndex}'/0/0`;
        const key = masterKey.derive(path);

        if (key.privateKey) {
            const wallet = new ethers.Wallet(toHex(key.privateKey));
            const isOurAccount = accountIndex === 1005;
            const label = isOurAccount ? '🔥 OUR HOT WALLET (has 0.001 BNB on BSC!)' : '';

            console.log(`   Account ${accountIndex.toString().padEnd(4)} ${label}`);
            console.log(`   Path    : ${path}`);
            console.log(`   Address : ${wallet.address}`);

            if (isOurAccount) {
                console.log(`   💰 BSC Balance: 0.001 BNB (~$0.60 USD)`);
            }
            console.log('');
        }
    }

    console.log('═'.repeat(100));
    console.log('');
    console.log('💡 EXPLANATION:');
    console.log('   - MetaMask shows "Account 1", "Account 2", etc. (starting from account 0)');
    console.log('   - Each account uses path: m/44\'/60\'/ACCOUNT_NUMBER\'/0/0');
    console.log('   - Our system uses ACCOUNT 1005 for the hot wallet');
    console.log('   - MetaMask would show this as "Account 1006" if you created 1006 accounts!');
    console.log('');
    console.log('🔍 TO VERIFY IN METAMASK:');
    console.log('   1. Import the mnemonic into MetaMask');
    console.log('   2. You\'ll see Account 1 by default (m/44\'/60\'/0\'/0/0)');
    console.log('   3. Create more accounts until you reach Account 1006');
    console.log('   4. Account 1006 will show: 0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083');
    console.log('');
    console.log('⚠️  EASIER METHOD:');
    console.log('   Use MyEtherWallet.com with custom derivation path: m/44\'/60\'/1005\'/0/0');
    console.log('');
    console.log('═'.repeat(100));
    console.log('');

    // Also show Solana accounts
    console.log('🟣 SOLANA ACCOUNTS (for reference)\n');

    for (const accountIndex of [0, 1, 2, 1005]) {
        const path = `m/44'/501'/${accountIndex}'/0/0`;
        const key = masterKey.derive(path);

        if (key.privateKey) {
            const keypair = Keypair.fromSeed(key.privateKey.slice(0, 32));
            const isOurAccount = accountIndex === 1005;
            const label = isOurAccount ? '🔥 OUR HOT WALLET' : '';

            console.log(`   Account ${accountIndex.toString().padEnd(4)} ${label}`);
            console.log(`   Path    : ${path}`);
            console.log(`   Address : ${keypair.publicKey.toBase58()}`);
            console.log('');
        }
    }

    console.log('═'.repeat(100));
    console.log('');
}

showAllAccounts().catch(console.error);
