import { Spot } from '@binance/connector';

const apiKey = process.env.BINANCE_TEST_API_KEY;
const apiSecret = process.env.BINANCE_TEST_API_SECRET;
const baseURL = 'https://testnet.binance.vision';

if (!apiKey || !apiSecret) {
    console.error('❌ Missing BINANCE_TEST_API_KEY or BINANCE_TEST_API_SECRET');
    process.exit(1);
}

const client = new Spot(apiKey, apiSecret, { baseURL }) as any;

console.log('🧪 Testing Binance Testnet API...');
console.log('API Key:', apiKey.substring(0, 10) + '...');
console.log('Base URL:', baseURL);
console.log();

async function test() {
    try {
        // Test 1: Connectivity
        console.log('1️⃣  Testing connectivity...');
        await client.ping();
        console.log('   ✅ Ping successful\n');

        // Test 2: Account info
        console.log('2️⃣  Getting account info...');
        const accountInfo = await client.account();
        console.log('   ✅ Account info retrieved');
        console.log('   Account Type:', accountInfo.data.accountType);
        console.log('   Can Deposit:', accountInfo.data.canDeposit);
        console.log('   Can Withdraw:', accountInfo.data.canWithdraw);
        console.log();

        // Test 3: Get available coins/networks
        console.log('3️⃣  Checking available coins...');
        try {
            const allCoins = await client.capitalConfigGetall();
            console.log('   ✅ Coins list retrieved');

            // Find SOL
            const solCoin = allCoins.data.find((coin: any) => coin.coin === 'SOL');
            if (solCoin) {
                console.log('   📊 SOL Information:');
                console.log('   Coin:', solCoin.coin);
                console.log('   Name:', solCoin.name);
                console.log('   Networks:', solCoin.networkList?.map((n: any) => n.network).join(', '));
            } else {
                console.log('   ⚠️  SOL not found in available coins');
            }
        } catch (error: any) {
            console.log('   ⚠️  Could not get coins list:', error.response?.data?.msg || error.message);
        }
        console.log();

        // Test 4: Try to get deposit address for SOL
        console.log('4️⃣  Attempting to get SOL deposit address...');
        try {
            const depositAddress = await client.depositAddress('SOL');
            console.log('   ✅ Deposit address retrieved:');
            console.log('   Address:', depositAddress.data.address);
            console.log('   Coin:', depositAddress.data.coin);
            console.log('   Network:', depositAddress.data.network);
            if (depositAddress.data.tag) {
                console.log('   Tag:', depositAddress.data.tag);
            }
            console.log();
            console.log('🎉 SUCCESS! You can use this address for testing:');
            console.log(`   export BINANCE_DEPOSIT_ADDRESS="${depositAddress.data.address}"`);
        } catch (error: any) {
            console.log('   ❌ Failed to get deposit address');
            console.log('   Error code:', error.response?.data?.code);
            console.log('   Error message:', error.response?.data?.msg);
            console.log();
            console.log('ℹ️  This is expected for Binance testnet.');
            console.log('   Testnet deposit addresses are not available via API.');
            console.log();
            console.log('📝 To get a testnet deposit address:');
            console.log('   1. Visit: https://testnet.binance.vision/');
            console.log('   2. Login with your testnet account');
            console.log('   3. Go to: Wallet → Fiat and Spot → Deposit');
            console.log('   4. Select coin: SOL');
            console.log('   5. Copy the deposit address');
            console.log();
            console.log('   Then run:');
            console.log('   export BINANCE_DEPOSIT_ADDRESS="<your-address>"');
            console.log('   SOLANA_USE_DEVNET=true node --import tsx scripts/execute-settlement-transfer.ts 0.1');
        }

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        if (error.response?.data) {
            console.error('API Response:', error.response.data);
        }
    }
}

test();
