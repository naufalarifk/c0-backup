#!/bin/bash

# Simple script to get Solana hot wallet address
# Works by building and running a minimal NestJS bootstrap

set -e

echo ""
echo "🔐 Getting Solana Hot Wallet Address..."
echo ""

# Check if we need to build
if [ ! -d "dist" ] || [ ! -f "dist/main.js" ]; then
  echo "📦 Building project..."
  pnpm build
fi

# Set network
if [ "$SOLANA_USE_TESTNET" = "true" ]; then
  export SOLANA_USE_TESTNET=true
  NETWORK="TESTNET"
  BLOCKCHAIN_KEY="solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z"
else
  NETWORK="MAINNET"  
  BLOCKCHAIN_KEY="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
fi

echo "🌐 Network: $NETWORK"
echo "📋 Blockchain Key: $BLOCKCHAIN_KEY"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TO GET YOUR SOLANA HOT WALLET ADDRESS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The hot wallet address is deterministically derived from:"
echo "  • WALLET_MNEMONIC environment variable"
echo "  • Or random seed (changes each restart)"
echo ""
echo "📝 Recommended: Set a fixed mnemonic in .env:"
echo "   WALLET_MNEMONIC=\"your 12 or 24 word mnemonic here\""
echo ""
echo "Then run the E2E tests to see the address:"
echo "   $NETWORK node --import tsx --test test/settlement-e2e.test.ts"
echo ""
echo "Or check the logs when starting the dev server:"
echo "   SOLANA_USE_TESTNET=$SOLANA_USE_TESTNET pnpm start:dev"
echo ""
echo "💰 Once you have the address:"
echo "   • For testnet: https://faucet.solana.com"
echo "   • Request 1-2 SOL for testing"
echo ""
