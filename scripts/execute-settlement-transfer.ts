/**
 * Execute Solana to Binance Settlement Transfer
 * 
 * This script performs an actual blockchain transfer from Solana devnet to Binance testnet.
 * Use with caution - this executes real blockchain transactions!
 * 
 * Usage:
 *   SOLANA_USE_DEVNET=true node --import tsx scripts/execute-settlement-transfer.ts <amount>
 * 
 * Example:
 *   SOLANA_USE_DEVNET=true node --import tsx scripts/execute-settlement-transfer.ts 0.1
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import { mnemonicToSeedSync } from '@scure/bip39';

// Configuration
const MNEMONIC = 'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';
const DERIVATION_PATH = "m/44'/501'/0'/0'";
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

// Get amount from command line
const transferAmountSOL = process.argv[2] ? Number.parseFloat(process.argv[2]) : 0.1;

if (transferAmountSOL <= 0) {
    console.error('❌ Invalid amount. Please provide a positive number.');
    console.error('Usage: node --import tsx scripts/execute-settlement-transfer.ts <amount>');
    process.exit(1);
}

async function executeTransfer() {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 SOLANA TO BINANCE SETTLEMENT TRANSFER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    try {
        // 1. Derive keypair from mnemonic
        console.log('🔐 Step 1: Deriving hot wallet from mnemonic...');
        const seed = mnemonicToSeedSync(MNEMONIC);
        const seedHex = Buffer.from(seed).toString('hex');
        const derivedSeed = derivePath(DERIVATION_PATH, seedHex).key;
        const keypair = Keypair.fromSeed(derivedSeed);
        const fromAddress = keypair.publicKey.toBase58();
        console.log('   Address:', fromAddress);
        console.log('✅ Keypair derived');
        console.log('');

        // 2. Connect to Solana
        console.log('🌐 Step 2: Connecting to Solana devnet...');
        console.log('   RPC URL:', SOLANA_RPC_URL);
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        console.log('✅ Connected');
        console.log('');

        // 3. Check balance
        console.log('📊 Step 3: Checking balance...');
        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
        console.log('   Balance:', balanceSOL, 'SOL');
        console.log('   Balance:', balanceLamports, 'lamports');
        console.log('');

        if (balanceSOL < transferAmountSOL) {
            console.error('❌ Insufficient balance!');
            console.error(`   Have: ${balanceSOL} SOL`);
            console.error(`   Need: ${transferAmountSOL} SOL`);
            process.exit(1);
        }
        console.log('✅ Balance sufficient');
        console.log('');

        // 4. Get Binance deposit address
        console.log('🏦 Step 4: Getting Binance deposit address...');
        console.log('');
        console.log('⚠️  NOTE: This script needs a Binance deposit address.');
        console.log('');
        console.log('To get your Binance testnet SOL deposit address:');
        console.log('1. Visit: https://testnet.binance.vision/');
        console.log('2. Login with your Binance testnet account');
        console.log('3. Go to Wallet > Deposit');
        console.log('4. Select SOL (Solana)');
        console.log('5. Copy the deposit address');
        console.log('');
        console.log('Then run this script with the address:');
        console.log(`   BINANCE_DEPOSIT_ADDRESS="<address>" node --import tsx scripts/execute-settlement-transfer.ts ${transferAmountSOL}`);
        console.log('');

        const binanceDepositAddress = process.env.BINANCE_DEPOSIT_ADDRESS;

        if (!binanceDepositAddress) {
            console.log('⏭️  Skipping transfer - BINANCE_DEPOSIT_ADDRESS not provided');
            console.log('');
            console.log('Example:');
            console.log('   export BINANCE_DEPOSIT_ADDRESS="YourBinanceDepositAddressHere"');
            console.log(`   SOLANA_USE_DEVNET=true node --import tsx scripts/execute-settlement-transfer.ts ${transferAmountSOL}`);
            console.log('');
            process.exit(0);
        }

        console.log('   Binance Address:', binanceDepositAddress);
        console.log('✅ Address obtained');
        console.log('');

        // 5. Validate destination address
        console.log('🔍 Step 5: Validating destination address...');
        let toPubkey: PublicKey;
        try {
            toPubkey = new PublicKey(binanceDepositAddress);
            console.log('✅ Valid Solana address');
            console.log('');
        } catch (error) {
            console.error('❌ Invalid Solana address:', binanceDepositAddress);
            console.error('   Error:', error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }

        // 6. Execute transfer
        console.log('💸 Step 6: Executing transfer...');
        console.log('');
        console.log('   Transfer Details:');
        console.log('   ----------------');
        console.log('   From:', fromAddress);
        console.log('   To:', binanceDepositAddress);
        console.log('   Amount:', transferAmountSOL, 'SOL');
        console.log('   Network: Devnet');
        console.log('');
        console.log('⏳ Preparing transaction...');

        const amountLamports = Math.floor(transferAmountSOL * LAMPORTS_PER_SOL);

        // Build transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey,
                lamports: amountLamports,
            }),
        );

        transaction.feePayer = keypair.publicKey;

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        console.log('✅ Transaction prepared');
        console.log('');
        console.log('⏳ Signing transaction...');

        // Sign transaction
        transaction.sign(keypair);

        console.log('✅ Transaction signed');
        console.log('');
        console.log('⏳ Sending transaction...');

        const startTime = Date.now();

        // Send transaction
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        console.log('✅ Transaction sent');
        console.log('   Signature:', signature);
        console.log('');
        console.log('⏳ Waiting for confirmation...');

        // Wait for confirmation
        await connection.confirmTransaction({
            signature,
            ...(await connection.getLatestBlockhash()),
        });

        const duration = Date.now() - startTime;

        console.log('✅ Transaction confirmed!');
        console.log('');

        // 7. Check new balance
        console.log('📊 Step 7: Checking new balance...');
        const newBalanceLamports = await connection.getBalance(keypair.publicKey);
        const newBalanceSOL = newBalanceLamports / LAMPORTS_PER_SOL;
        const transferredSOL = balanceSOL - newBalanceSOL;

        console.log('   Before:', balanceSOL, 'SOL');
        console.log('   After:', newBalanceSOL, 'SOL');
        console.log('   Transferred:', transferredSOL, 'SOL');
        console.log('');

        // 8. Summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ TRANSFER SUCCESSFUL!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('Transaction Details:');
        console.log('  Signature:', signature);
        console.log('  Duration:', `${duration}ms`);
        console.log('  From:', fromAddress);
        console.log('  To:', binanceDepositAddress);
        console.log('  Amount:', transferAmountSOL, 'SOL');
        console.log('  Transferred (with fee):', transferredSOL, 'SOL');
        console.log('  Fee:', (transferredSOL - transferAmountSOL).toFixed(9), 'SOL');
        console.log('');
        console.log('Explorer Links:');
        console.log('  Transaction:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log('  From Address:', `https://explorer.solana.com/address/${fromAddress}?cluster=devnet`);
        console.log('  To Address:', `https://explorer.solana.com/address/${binanceDepositAddress}?cluster=devnet`);
        console.log('');
        console.log('Next Steps:');
        console.log('  1. Check Binance testnet wallet for received SOL');
        console.log('  2. Monitor transaction on Solana explorer');
        console.log('  3. Verify balance updates on both chains');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ TRANSFER FAILED');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        if (error instanceof Error && error.stack) {
            console.error('');
            console.error('Stack trace:');
            console.error(error.stack);
        }
        console.error('');
        process.exit(1);
    }
}

executeTransfer();
