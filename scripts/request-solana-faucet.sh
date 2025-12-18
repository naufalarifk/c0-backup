#!/bin/bash

# Solana Testnet Faucet Helper
# Requests SOL from the Solana testnet faucet

set -e

ADDRESS="815tYsAwUqZSDWPfrpYW5Cc4d8BhAib9YPxcUm3AyXHW"

echo ""
echo "💰 Requesting Solana Testnet Faucet..."
echo ""
echo "Address: $ADDRESS"
echo ""

# Try requesting from faucet via RPC
echo "Requesting 1 SOL from testnet faucet..."
RESPONSE=$(curl -s "https://api.testnet.solana.com" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"requestAirdrop\",\"params\":[\"$ADDRESS\",1000000000]}")

echo "Response: $RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q "result"; then
  echo "✅ Airdrop requested successfully!"
  echo ""
  echo "⏳ Waiting 10 seconds for confirmation..."
  sleep 10
  
  # Check balance
  echo ""
  echo "Checking balance..."
  BALANCE_RESPONSE=$(curl -s "https://api.testnet.solana.com" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$ADDRESS\"]}")
  
  echo "$BALANCE_RESPONSE" | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    const lamports = data.result?.value || 0;
    const sol = lamports / 1000000000;
    console.log('');
    console.log('Current Balance:');
    console.log('  ', sol, 'SOL');
    console.log('  ', lamports, 'lamports');
    console.log('');
  "
  
  echo "🔍 View on explorer:"
  echo "   https://explorer.solana.com/address/$ADDRESS?cluster=testnet"
  echo ""
else
  echo "❌ Airdrop request failed"
  echo ""
  echo "Alternative methods:"
  echo ""
  echo "1. Web Faucet:"
  echo "   https://faucet.solana.com"
  echo ""
  echo "2. Try Devnet instead (more reliable):"
  echo "   curl -s https://api.devnet.solana.com -X POST -H \"Content-Type: application/json\" \\"
  echo "     -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"requestAirdrop\",\"params\":[\"$ADDRESS\",2000000000]}'"
  echo ""
  echo "3. Use Solana CLI:"
  echo "   solana airdrop 1 $ADDRESS --url testnet"
  echo ""
fi
