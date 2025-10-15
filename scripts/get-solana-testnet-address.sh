#!/bin/bash

# Get Solana Testnet Hot Wallet Address
# This script starts the test server with Solana testnet enabled and retrieves the hot wallet address

set -e

echo "🚀 Starting test server with Solana testnet enabled..."
echo ""

# Export environment variable to use testnet
export SOLANA_USE_TESTNET=true

# Start the test server in background
./scripts/run-test-server.sh &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Get the server URL from the output
SERVER_URL="http://localhost:3000"

# Try to find the actual port
if [ -f "/tmp/cg-test-server-*.port" ]; then
  PORT=$(cat /tmp/cg-test-server-*.port 2>/dev/null | head -1)
  if [ ! -z "$PORT" ]; then
    SERVER_URL="http://localhost:$PORT"
  fi
fi

echo "📡 Fetching Solana testnet hot wallet address..."
echo ""

# Make API call to get Solana balance (which includes address)
curl -s "${SERVER_URL}/api/test/settlement/solana-balance" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
console.log('✅ Solana Testnet Hot Wallet Address:');
console.log('');
console.log('  Address:', data.address);
console.log('  Blockchain:', data.blockchain);
console.log('  Network:', data.network);
console.log('  Balance:', data.balanceInSOL, 'SOL');
console.log('  RPC URL:', data.rpcUrl);
console.log('');
console.log('💰 Get testnet SOL from faucet:');
console.log('  https://faucet.solana.com');
console.log('');
console.log('📋 Copy this address to request faucet:');
console.log('  ' + data.address);
"

# Cleanup
echo ""
echo "🛑 Stopping test server..."
kill $SERVER_PID 2>/dev/null || true

echo "✅ Done!"
