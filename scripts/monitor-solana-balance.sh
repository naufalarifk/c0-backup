#!/bin/bash

# Monitor Solana Devnet Balance
# Checks balance every 10 seconds and alerts when SOL arrives

ADDRESS="815tYsAwUqZSDWPfrpYW5Cc4d8BhAib9YPxcUm3AyXHW"
INTERVAL=10
MAX_CHECKS=60  # Stop after 10 minutes (60 checks * 10 seconds)

echo ""
echo "👀 Monitoring Solana Devnet Balance..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Address: $ADDRESS"
echo "Network: Devnet"
echo "Checking every: ${INTERVAL}s"
echo ""
echo "Press Ctrl+C to stop"
echo ""

CHECK_COUNT=0

while [ $CHECK_COUNT -lt $MAX_CHECKS ]; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  
  # Get current time
  TIMESTAMP=$(date +"%H:%M:%S")
  
  # Check balance
  RESPONSE=$(curl -s "https://api.devnet.solana.com" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$ADDRESS\"]}")
  
  # Parse balance
  LAMPORTS=$(echo "$RESPONSE" | node -e "
    try {
      const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
      console.log(data.result?.value || 0);
    } catch (e) {
      console.log(0);
    }
  ")
  
  SOL=$(echo "scale=9; $LAMPORTS / 1000000000" | bc)
  
  # Display status
  if [ "$LAMPORTS" -gt 0 ]; then
    echo "[$TIMESTAMP] 🎉 SUCCESS! Balance: $SOL SOL ($LAMPORTS lamports)"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ SOL RECEIVED!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Balance: $SOL SOL"
    echo ""
    echo "🔍 View on explorer:"
    echo "   https://explorer.solana.com/address/$ADDRESS?cluster=devnet"
    echo ""
    echo "🚀 Next step - Run settlement test:"
    echo "   SOLANA_USE_TESTNET=true node --import tsx --test test/solana-to-binance-settlement.test.ts"
    echo ""
    exit 0
  else
    echo "[$TIMESTAMP] Check $CHECK_COUNT/$MAX_CHECKS - Balance: 0 SOL (waiting...)"
  fi
  
  # Wait before next check
  sleep $INTERVAL
done

echo ""
echo "⏱️  Timeout reached after $MAX_CHECKS checks"
echo ""
echo "Balance is still 0 SOL"
echo ""
echo "💡 Suggestions:"
echo "   1. Try the web faucet: https://faucet.solana.com"
echo "   2. Check if testnet is operational"
echo "   3. Try requesting again with the script: ./scripts/request-solana-faucet.sh"
echo ""
