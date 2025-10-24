# List Wallets Command

The `list-wallets` command displays all active wallet addresses in the system.

## Purpose

This command lists:
1. **Root Addresses (Hot Wallets)** - One for each supported blockchain
2. **Active Invoice Addresses** - Wallet addresses for all active invoices

## Usage

### Using pnpm (Development)

```bash
pnpm start list-wallets
```

### Using Node (Production)

```bash
node dist/main.js list-wallets
```

### Using Docker

```bash
docker exec cg-backend node dist/main.js list-wallets
```

## Output Format

The command outputs wallet information to stdout with the following structure:

### Root Addresses Section
```
🔐 ROOT ADDRESSES (Hot Wallets)
────────────────────────────────────────────────────────────────────────────────

blockchainKey: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
address: FR7VaPGTSKFD94QFHwj5tRFekLBPyhmQ2yXjs4VUNbq7
derivationPath: m/44'/501'/0'/0/0

blockchainKey: eip155:1
address: 0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3
derivationPath: m/44'/60'/0'/0/0

...
```

### Active Invoice Addresses Section
```
📫 ACTIVE INVOICE ADDRESSES
────────────────────────────────────────────────────────────────────────────────

Blockchain: eip155:1
  - Invoice #12345
    blockchainKey: eip155:1
    address: 0x1234567890abcdef1234567890abcdef12345678
    derivationPath: m/44'/60'/5'/0/12345

...
```

## Properties Displayed

For each wallet address, the following properties are shown:

- **blockchainKey**: CAIP-2 format blockchain identifier (e.g., `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`, `eip155:1`)
- **address**: The actual wallet address on the blockchain
- **derivationPath**: BIP44 derivation path used to generate the wallet (for hot wallets only)

## Technical Details

### Hot Wallet Derivation

Hot wallets use the standard BIP44 derivation path:
```
m/44'/<coin_type>'/0'/0/0
```

Where `coin_type` depends on the blockchain:
- Solana: 501
- Ethereum/BSC: 60
- Bitcoin: 0
- Bitcoin Testnet: 1

### Invoice Wallet Derivation

Invoice wallets use a custom derivation path:
```
m/44'/<coin_type>'/5'/0/<invoice_id>
```

The account index is set to 5 to separate invoice wallets from hot wallets.

## Environment Requirements

The command requires the following environment variables to be set:

- `DATABASE_URL`: Database connection string
- `MASTER_SEED` or `WALLET_MNEMONIC`: BIP39 mnemonic for wallet derivation
- `CRYPTOGRAPHY_ENGINE`: Set to `local` for mnemonic-based derivation or `vault` for Vault-based encryption

## Exit Codes

- `0`: Success
- `1`: Error (e.g., database connection failure, invalid configuration)

## Examples

### List all wallets in development environment

```bash
pnpm start list-wallets
```

### List wallets with custom database

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb" pnpm start list-wallets
```

### List wallets in production

```bash
# Using systemd service
systemctl start cg-backend@list-wallets

# Using Docker Compose
docker-compose exec api node dist/main.js list-wallets
```

## Use Cases

1. **Monitoring**: Verify all active wallet addresses are properly configured
2. **Debugging**: Troubleshoot wallet derivation issues
3. **Auditing**: Generate a snapshot of all active addresses for compliance
4. **Integration Testing**: Verify wallet addresses match expected values
5. **Operations**: Get addresses for manual transaction verification

## Related Commands

- `migration`: Initialize or update database schema
- `platform-wallet-init`: Initialize platform wallet seed (Vault-based only)

## Notes

- The command exits immediately after displaying the wallet addresses
- No modifications are made to the database
- Requires read access to the `invoices` table for active invoice addresses
- Hot wallet addresses are deterministically derived from the master seed
