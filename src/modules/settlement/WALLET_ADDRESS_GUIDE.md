# Wallet Address Configuration Guide

This document explains how wallet addresses are derived and managed for each blockchain in the settlement system.

## 🔑 Address Derivation Overview

All wallet addresses are **deterministically derived** from a single master seed using the **BIP44 standard**. This ensures:
- Consistent addresses across deployments
- Easy backup and recovery (just save the seed)
- Industry-standard security practices

## 📋 BIP44 Derivation Paths

BIP44 path format: `m/44'/<coin_type>'/<account>'/<change>/<address_index>`

### Hot Wallet Paths

All hot wallets use **account index 1005**:

| Blockchain | Coin Type | Derivation Path | CAIP-2 Key |
|------------|-----------|-----------------|------------|
| **Solana** | 501 | `m/44'/501'/1005'/0/0` | `solana:5eykt4...` |
| **Ethereum** | 60 | `m/44'/60'/1005'/0/0` | `eip155:1` |
| **BSC** | 60 | `m/44'/60'/1005'/0/0` | `eip155:56` |
| **Bitcoin** | 0 | `m/44'/0'/1005'/0/0` | `bip122:000000...` |

### Invoice Wallet Paths

Invoice-specific wallets use **account index 5** with varying address indices:

```
m/44'/<coin_type>'/5'/0/<invoice_id>
```

Example for invoice #12345:
- Solana: `m/44'/501'/5'/0/12345`
- Ethereum: `m/44'/60'/5'/0/12345`
- BSC: `m/44'/60'/5'/0/12345`

## 🌐 Blockchain-Specific Details

### Solana

**Networks Supported:**
- Mainnet Beta (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)
- Testnet (`solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z`)
- Devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)

**Address Format:**
- Base58 encoded
- Example: `DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK`
- Length: 32-44 characters
- Case-sensitive

**Implementation:**
```typescript
// src/shared/wallets/wallets/sol.wallet.ts
async getAddress(): Promise<string> {
  const keypair = Keypair.fromSeed(this.privateKey.slice(0, 32));
  return keypair.publicKey.toBase58();
}
```

**Network Selection:**
```bash
# Environment variables
SOLANA_USE_DEVNET=false
SOLANA_USE_TESTNET=false
# Default: mainnet-beta
```

### Ethereum

**Networks Supported:**
- Mainnet (`eip155:1`)
- Sepolia Testnet (`eip155:11155111`)
- Goerli Testnet (`eip155:5`)

**Address Format:**
- Hex with 0x prefix
- Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
- Length: 42 characters (20 bytes)
- Case-insensitive (checksummed)

**Implementation:**
```typescript
// src/shared/wallets/wallets/eth.wallet.ts
async getAddress(): Promise<string> {
  const privateKeyHex = Buffer.from(this.privateKey).toString('hex');
  const wallet = new ethers.Wallet(privateKeyHex);
  return wallet.address; // Checksummed address
}
```

**Network Selection:**
```bash
# Environment variables
ETH_USE_SEPOLIA=false
ETH_USE_GOERLI=false
# Default: mainnet
```

### Binance Smart Chain (BSC)

**Networks Supported:**
- BSC Mainnet (`eip155:56`)
- BSC Testnet (`eip155:97`)

**Address Format:**
- **Same as Ethereum** (EVM-compatible)
- Hex with 0x prefix
- Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
- **Note:** ETH and BSC share the same addresses!

**Implementation:**
- Uses `EthWallet` class (same as Ethereum)
- Extends `EthMainnetBlockchain` with different RPC URL

**Network Selection:**
```bash
# Environment variables
BSC_USE_TESTNET=false
# Default: mainnet
```

**Important Note:**
> ⚠️ **ETH and BSC addresses are identical** because both use the same derivation path (`m/44'/60'/1005'/0/0`). This is expected behavior for EVM-compatible chains. Security is maintained through different chain IDs:
> - Ethereum Mainnet: Chain ID 1
> - BSC Mainnet: Chain ID 56

## 🔐 Security Considerations

### Shared Addresses (ETH & BSC)

**Why they're the same:**
- BSC is EVM-compatible and uses Ethereum's coin type (60)
- This follows the BIP44 standard for EVM chains
- Many wallets (MetaMask, Trust Wallet) work this way

**How security is maintained:**
- Different **chain IDs** prevent replay attacks
- Transactions signed for one chain won't work on another
- RPC endpoints are network-specific

**Example:**
```typescript
// Same address on both chains
const address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

// But different networks
const ethTx = await ethService.getTransactionStatus(txHash); // Chain ID 1
const bscTx = await bscService.getTransactionStatus(txHash); // Chain ID 56
```

### Master Seed Protection

**Critical Security Measures:**

1. **Environment Variable:** Store in secure vault
   ```bash
   MASTER_SEED="word1 word2 ... word12"
   ```

2. **Never commit to git:**
   ```bash
   # .gitignore already includes:
   .env
   .env.*
   ```

3. **Access Control:**
   - Only production servers should have access
   - Use secrets management (Vault, AWS Secrets Manager)
   - Rotate regularly in case of compromise

4. **Backup Strategy:**
   - Store seed phrase in multiple secure locations
   - Use hardware security modules (HSM) for production
   - Test recovery process regularly

## 📝 Address Verification Checklist

Use this checklist when deploying to new environments:

### ✅ Solana
- [ ] Hot wallet address derived correctly
- [ ] Address format is Base58
- [ ] Address length is 32-44 characters
- [ ] Can query balance on selected network
- [ ] Network matches environment (mainnet/testnet/devnet)

### ✅ Ethereum
- [ ] Hot wallet address derived correctly
- [ ] Address format is 0x + 40 hex chars
- [ ] Address is checksummed
- [ ] Can query balance on selected network
- [ ] Network matches environment (mainnet/sepolia/goerli)

### ✅ BSC
- [ ] Hot wallet address derived correctly
- [ ] Address matches Ethereum address (expected)
- [ ] Can query balance on selected network
- [ ] Network matches environment (mainnet/testnet)
- [ ] Chain ID is correct (56 for mainnet, 97 for testnet)

## 🔧 Testing Address Derivation

### Method 1: Using the Script

```bash
# Run address checker (requires MASTER_SEED in environment)
pnpm tsx scripts/check-wallet-addresses-simple.ts
```

Expected output:
```
📦 Solana Wallets
   Derivation Path: m/44'/501'/1005'/0/0
   Hot Wallet Address: DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK

📦 Ethereum Wallets
   Derivation Path: m/44'/60'/1005'/0/0
   Hot Wallet Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

📦 Binance Smart Chain Wallets
   Derivation Path: m/44'/60'/1005'/0/0
   Hot Wallet Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
   Note: Same address as Ethereum (EVM-compatible)
```

### Method 2: Manual Testing

```typescript
// In your service
async testAddresses() {
  const solAddress = await this.solService.getBalance();
  console.log('Solana hot wallet:', solAddress);
  
  const ethAddress = await this.ethService.getBalance();
  console.log('Ethereum hot wallet:', ethAddress);
  
  const bscAddress = await this.bscService.getBalance();
  console.log('BSC hot wallet:', bscAddress);
}
```

### Method 3: RPC Query

```bash
# Solana
curl https://api.mainnet-beta.solana.com -X POST -H "Content-Type: application/json" -d '
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getBalance",
  "params": ["YOUR_SOLANA_ADDRESS"]
}'

# Ethereum
curl https://cloudflare-eth.com -X POST -H "Content-Type: application/json" -d '
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getBalance",
  "params": ["YOUR_ETH_ADDRESS", "latest"]
}'

# BSC
curl https://bsc-dataseed1.binance.org -X POST -H "Content-Type: application/json" -d '
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getBalance",
  "params": ["YOUR_BSC_ADDRESS", "latest"]
}'
```

## 🐛 Troubleshooting

### Issue: "Address doesn't match expected format"

**Solana:**
- Check if address is Base58 encoded
- Verify it's not hex or other format

**Ethereum/BSC:**
- Ensure address starts with `0x`
- Check if it's 42 characters total (0x + 40 hex)

### Issue: "Cannot derive address from seed"

**Solution:**
1. Check `MASTER_SEED` is set correctly
2. Verify it's a valid BIP39 mnemonic (12-24 words)
3. Ensure words are space-separated
4. Check for typos in seed phrase

### Issue: "ETH and BSC addresses are different"

**This is unexpected!** They should be identical.

**Possible causes:**
1. Using different coin types (should both use 60)
2. Different derivation paths
3. Bug in address derivation

**Solution:**
- Review blockchain configuration files
- Verify both extend/use same wallet class
- Check derivation path in logs

### Issue: "Balance query fails"

**Solution:**
1. Verify RPC endpoint is accessible
2. Check network configuration matches deployment
3. Ensure address format is correct for blockchain
4. Test RPC endpoint directly with curl

## 📚 Additional Resources

- [BIP44 Specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [CAIP-2 Standard](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)
- [Solana Address Format](https://docs.solana.com/developing/clients/jsonrpc-api#base58)
- [Ethereum Address Checksum](https://eips.ethereum.org/EIPS/eip-55)
- [BSC Documentation](https://docs.bnbchain.org/)

## 🎯 Quick Reference

```typescript
// Get hot wallet addresses
const solBlockchain = walletFactory.getBlockchain('solana:5eykt4...');
const solAddress = await (await solBlockchain.getHotWallet()).getAddress();

const ethBlockchain = walletFactory.getBlockchain('eip155:1');
const ethAddress = await (await ethBlockchain.getHotWallet()).getAddress();

const bscBlockchain = walletFactory.getBlockchain('eip155:56');
const bscAddress = await (await bscBlockchain.getHotWallet()).getAddress();

// Note: ethAddress === bscAddress (EVM-compatible)
```

---

**Document Version:** 1.0  
**Last Updated:** October 14, 2025  
**Related Files:**
- `src/shared/wallets/blockchain.abstract.ts`
- `src/shared/wallets/blockchains/*.blockchain.ts`
- `src/shared/wallets/wallets/*.wallet.ts`
- `scripts/check-wallet-addresses-simple.ts`
