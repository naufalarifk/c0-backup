#!/bin/bash

# Settlement Balance Checker Script
# Checks hot wallet addresses, balances, and Binance connectivity

echo "🔍 Settlement Balance & Address Checker"
echo "========================================"
echo ""

SERVER="http://localhost:3000"

# Check if server is running
if ! curl -s "$SERVER/api/health" > /dev/null; then
    echo "❌ Error: Server is not running on $SERVER"
    echo "   Please start the server with: pnpm start:dev"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Check hot wallet addresses and balances
echo "🔑 Hot Wallet Addresses & Balances:"
echo "-----------------------------------"

# BSC Mainnet
echo ""
echo "📍 BSC Mainnet (eip155:56):"
BSC_WALLET=$(curl -s "$SERVER/api/test/settlement/hot-wallet/eip155:56")
echo "   Address: $(echo $BSC_WALLET | jq -r '.address')"

BSC_BALANCE=$(curl -s "$SERVER/api/test/settlement/hot-wallet-balance/eip155:56")
BSC_BAL=$(echo $BSC_BALANCE | jq -r '.balance')
echo "   Balance: $BSC_BAL BNB"

# Ethereum Mainnet
echo ""
echo "📍 Ethereum Mainnet (eip155:1):"
ETH_WALLET=$(curl -s "$SERVER/api/test/settlement/hot-wallet/eip155:1")
echo "   Address: $(echo $ETH_WALLET | jq -r '.address')"

ETH_BALANCE=$(curl -s "$SERVER/api/test/settlement/hot-wallet-balance/eip155:1")
ETH_BAL=$(echo $ETH_BALANCE | jq -r '.balance')
echo "   Balance: $ETH_BAL ETH"

# Solana Mainnet
echo ""
echo "📍 Solana Mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp):"
SOL_WALLET=$(curl -s "$SERVER/api/test/settlement/hot-wallet/solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
echo "   Address: $(echo $SOL_WALLET | jq -r '.address')"

SOL_BALANCE=$(curl -s "$SERVER/api/test/settlement/hot-wallet-balance/solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
SOL_BAL=$(echo $SOL_BALANCE | jq -r '.balance')
echo "   Balance: $SOL_BAL SOL"

# Database balances
echo ""
echo ""
echo "💾 Database Hot Wallet Balances:"
echo "--------------------------------"
echo "(These are the balances that settlement uses)"
echo ""

DB_BALANCES=$(curl -s -X POST "$SERVER/api/test/settlement/hot-wallet-balances" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$DB_BALANCES" | jq '.'

# Settlement calculation preview
echo ""
echo ""
echo "📊 Settlement Calculation Preview:"
echo "----------------------------------"
echo ""

CALC=$(curl -s -X POST "$SERVER/api/test/settlement/full-calculation" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$CALC" | jq '.'

# Summary
echo ""
echo ""
echo "📋 Summary:"
echo "----------"

if [ "$BSC_BAL" != "0" ] || [ "$ETH_BAL" != "0" ] || [ "$SOL_BAL" != "0" ]; then
    echo "✅ Found blockchain balances:"
    [ "$BSC_BAL" != "0" ] && echo "   • BSC: $BSC_BAL BNB"
    [ "$ETH_BAL" != "0" ] && echo "   • ETH: $ETH_BAL ETH"
    [ "$SOL_BAL" != "0" ] && echo "   • SOL: $SOL_BAL SOL"
else
    echo "⚠️  No blockchain balances found"
fi

echo ""
echo "💡 To execute settlement:"
echo "   curl -X POST $SERVER/api/test/settlement/execute-settlement"
echo ""
echo "✅ Check complete!"
