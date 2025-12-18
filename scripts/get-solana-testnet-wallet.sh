#!/bin/bash

# Quick script to get Solana testnet hot wallet address
# This starts the actual backend server briefly to query the address

set -e

echo ""
echo "🚀 Getting Solana Testnet Hot Wallet Address..."
echo ""

# Set testnet mode
export SOLANA_USE_TESTNET=true

# Start the dev server in background
echo "⏳ Starting backend server..."
pnpm start:dev > /tmp/solana-dev-server.log 2>&1 &
SERVER_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
    sleep 1
    kill -9 $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to start (check log for startup message)
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
    if grep -q "Nest application successfully started" /tmp/solana-dev-server.log 2>/dev/null; then
        echo "✅ Server started!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Server failed to start in time"
        echo "Last 20 lines of log:"
        tail -20 /tmp/solana-dev-server.log
        exit 1
    fi
    sleep 1
done

# Extract port from log
PORT=$(grep -o "localhost:[0-9]*" /tmp/solana-dev-server.log | head -1 | cut -d: -f2)
if [ -z "$PORT" ]; then
    PORT=3000  # Default port
fi

echo "📡 Server running on port $PORT"
echo ""

# Wait a bit more for endpoints to be ready
sleep 2

# Query the Solana balance endpoint
echo "📡 Fetching Solana testnet hot wallet info..."
RESPONSE=$(curl -s "http://localhost:${PORT}/api/test/settlement/solana-balance" || echo "")

if [ -z "$RESPONSE" ]; then
    echo "❌ Failed to get response from server"
    echo ""
    echo "Server log:"
    tail -30 /tmp/solana-dev-server.log
    exit 1
fi

# Parse and display the response
echo "$RESPONSE" | python3 -c "
import json
import sys

try:
    data = json.load(sys.stdin)
    
    if not data.get('success'):
        print('❌ API returned error:')
        print(json.dumps(data, indent=2))
        sys.exit(1)
    
    address = data.get('address', 'N/A')
    blockchain = data.get('blockchain', 'N/A')
    network = data.get('network', 'N/A')
    balance = data.get('balanceInSOL', 0)
    
    print('')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('✅ SOLANA TESTNET HOT WALLET ADDRESS:')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('')
    print(f'  {address}')
    print('')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('')
    print(f'📋 Blockchain: {blockchain}')
    print(f'🌐 Network: {network}')
    print(f'💰 Current Balance: {balance} SOL')
    print('')
    print('💰 Next Steps:')
    print('   1. Visit: https://faucet.solana.com')
    print(f'   2. Paste: {address}')
    print('   3. Request 1-2 SOL')
    print('   4. Wait ~10 seconds')
    print('')
    print('🔍 Check balance on explorer:')
    print(f'   https://explorer.solana.com/address/{address}?cluster=testnet')
    print('')
    
except json.JSONDecodeError:
    print('❌ Failed to parse JSON response')
    print('Raw response:')
    print(sys.stdin.read())
    sys.exit(1)
except Exception as e:
    print(f'❌ Error: {e}')
    sys.exit(1)
"

# Cleanup will happen automatically via trap
