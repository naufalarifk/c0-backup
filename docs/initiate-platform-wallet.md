# Initiate Platform Wallet - Technical Guide

This guide provides step-by-step instructions for generating and configuring the platform HD wallet root seed for CryptoGadai backend in production environments using HashiCorp Vault.

## Overview

The platform wallet is the master HD wallet used to derive all platform-controlled cryptocurrency addresses. The root seed is cryptographically secured using HashiCorp Vault's transit engine and stored in Vault's KV store.

**Security Note**: This is a critical security operation that should only be performed by authorized system administrators. The platform seed provides access to all platform funds.

## Prerequisites

### System Access
- SSH access to the production server (`root@174.138.16.211`)
- Vault CLI installed and configured
- Node.js installed on the server for seed generation

### Vault Configuration
Ensure Vault is properly configured as described in `docs/devops.md`:
- Vault service is running and unsealed
- KV v2 secrets engine enabled at `secret/` path
- Transit secrets engine enabled
- `platform-wallet` transit key created (AES256-GCM96)
- AppRole authentication configured for `cg-backend`
- `cg-backend` policy with appropriate permissions

### Required Permissions
```hcl
path "secret/data/wallet/*" {
  capabilities = ["read"]
}

path "transit/encrypt/*" {
  capabilities = ["update"]
}

path "transit/decrypt/*" {
  capabilities = ["update"]
}

path "transit/keys/*" {
  capabilities = ["read"]
}
```

## Step-by-Step Instructions

### 1. Access the Server

Connect to the production server via SSH:

```bash
ssh root@174.138.16.211
```

### 2. Set Vault Environment Variables

Configure Vault CLI environment:

```bash
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_SKIP_VERIFY=true
export VAULT_TOKEN=<your_vault_token>
```

**Note**: Use the root token or an appropriately privileged token for initial setup.

### 3. Verify Vault Status

Ensure Vault is initialized, unsealed, and accessible:

```bash
vault status
```

Expected output should show:
- Initialized: true
- Sealed: false
- Version information

### 4. Verify Transit Key Exists

Ensure the `platform-wallet` transit key exists:

```bash
vault read transit/keys/platform-wallet
```

If the key doesn't exist, create it:

```bash
vault write transit/keys/platform-wallet type=aes256-gcm96
```

### 5. Generate Random Seed

Generate a cryptographically secure 64-byte (512-bit) random seed:

```bash
node -e "
const crypto = require('crypto');
const seed = crypto.randomBytes(64);
const seedHex = seed.toString('hex');
console.log('Generated seed:', seedHex);
console.log('Seed length (bytes):', seed.length);
"
```

**Important**: Save the generated seed securely. This is your platform's master seed - it cannot be recovered if lost.

### 6. Encrypt the Seed

Encrypt the seed using Vault's transit engine:

```bash
SEED_HEX="<paste_generated_seed_hex_here>"
vault write transit/encrypt/platform-wallet plaintext="$(echo -n "$SEED_HEX" | base64 -w 0)"
```

**Example**:
```bash
vault write transit/encrypt/platform-wallet plaintext="$(echo -n "b0527b5e65d1c99afff1ee5362d6a05883c6f0990cd23cdb1b5fe973f5f66eddf3e11ef4f07b9ef69ee04df41da5bb62af09698d3c39c71bda8db2fde5b76e90" | base64 -w 0)"
```

**Expected Output**:
```
Key            Value
---            -----
ciphertext     vault:v1:66do/MZviemsDrAE8qZXFWLJ7PNNwtG5dE2Q/y/rS6ri4ENyf/Ldrnc87TPx9nfbUx0hYJ7CSAPGPbJJehLRwmyfdcPeJZNRb1UP5iSFNxb0OZMEJje34MNOQrG/+3GBLQABGvPrYcq/tksICUt77avd245Hsvza5WAfI0BOx1i5SwI8d5y6XISOBhrIOiEoX5CaMCX6TgA4NXc9
key_version    1
```

### 7. Store Encrypted Seed in Vault

Store the encrypted seed in Vault's KV store:

```bash
ENCRYPTED_CIPHERTEXT="<paste_ciphertext_from_step_6>"
vault kv put secret/data/wallet/platform-seed encrypted_seed="$ENCRYPTED_CIPHERTEXT"
```

**Example**:
```bash
vault kv put secret/data/wallet/platform-seed encrypted_seed="vault:v1:66do/MZviemsDrAE8qZXFWLJ7PNNwtG5dE2Q/y/rS6ri4ENyf/Ldrnc87TPx9nfbUx0hYJ7CSAPGPbJJehLRwmyfdcPeJZNRb1UP5iSFNxb0OZMEJje34MNOQrG/+3GBLQABGvPrYcq/tksICUt77avd245Hsvza5WAfI0BOx1i5SwI8d5y6XISOBhrIOiEoX5CaMCX6TgA4NXc9"
```

### 8. Verify Storage

Verify the seed was stored correctly:

```bash
vault kv get secret/data/wallet/platform-seed
```

**Expected Output**:
```
====== Secret Path ======
secret/data/wallet/platform-seed

======= Metadata =======
Key                Value
---                -----
created_time       2025-10-24T01:29:57.45693502Z
custom_metadata    <nil>
deletion_time      n/a
destroyed          false
version            1

====== Data ======
Key              Value
---              -----
encrypted_seed   vault:v1:66do/MZviemsDrAE8qZXFWLJ7PNNwtG5dE2Q/y/rS6ri4ENyf/Ldrnc87TPx9nfbUx0hYJ7CSAPGPbJJehLRwmyfdcPeJZNRb1UP5iSFNxb0OZMEJje34MNOQrG/+3GBLQABGvPrYcq/tksICUt77avd245Hsvza5WAfI0BOx1i5SwI8d5y6XISOBhrIOiEoX5CaMCX6TgA4NXc9
```

### 9. Test Decryption (Optional Verification)

Test that the seed can be decrypted correctly:

```bash
vault write transit/decrypt/platform-wallet ciphertext="$ENCRYPTED_CIPHERTEXT"
```

Verify the decrypted plaintext matches the original seed hex.

### 10. Update Application Configuration

Ensure the cg-backend service has the correct Vault configuration in `/etc/systemd/system/cg-backend.service`:

```bash
# Required environment variables
CRYPTOGRAPHY_ENGINE=vault
CRYPTOGRAPHY_VAULT_ADDRESS=https://127.0.0.1:8200
CRYPTOGRAPHY_VAULT_ROLE_ID=<role_id>
CRYPTOGRAPHY_VAULT_SECRET_ID=<secret_id>
```

Reload systemd and restart the service:

```bash
systemctl daemon-reload
systemctl restart cg-backend
```

### 11. Verify Application Startup

Check that the application starts successfully:

```bash
systemctl status cg-backend
journalctl -u cg-backend -f --since "1 minute ago"
```

The application should start without errors related to missing platform wallet seed.

## Security Considerations

### Key Management
- **Never log or display the plaintext seed**
- **Store the plaintext seed securely offline** (encrypted USB drive, hardware security module)
- **Use different seeds for different environments** (development, staging, production)
- **Rotate seeds periodically** according to your security policy

### Access Control
- **Limit Vault token privileges** to only necessary operations
- **Use AppRole authentication** instead of direct token access in production
- **Rotate AppRole credentials** regularly
- **Monitor Vault audit logs** for unauthorized access attempts

### Backup and Recovery
- **Backup Vault data** regularly
- **Test recovery procedures** in non-production environments
- **Document recovery procedures** and store securely
- **Maintain multiple unseal key shares** with proper distribution

### Audit Trail
- **Enable Vault audit logging**
- **Monitor access to wallet secrets**
- **Log all seed generation and rotation activities**

## Troubleshooting

### Application Fails to Start
**Error**: "Platform wallet seed not found in Vault secret at wallet/platform-seed"

**Solution**:
1. Verify the secret exists: `vault kv get secret/data/wallet/platform-seed`
2. Check the secret contains `encrypted_seed` field
3. Verify Vault connectivity and authentication

### Decryption Fails
**Error**: "Failed to decrypt data with key: platform-wallet"

**Solution**:
1. Verify the transit key exists: `vault read transit/keys/platform-wallet`
2. Check the ciphertext format (should start with `vault:v1:`)
3. Ensure the correct key name is used

### Vault Connection Issues
**Error**: "Vault service not initialized"

**Solution**:
1. Check Vault status: `vault status`
2. Verify Vault is unsealed
3. Check network connectivity to Vault
4. Verify TLS certificates if applicable

## Related Documentation

- `docs/devops.md` - General server operations and Vault configuration
- `deployments/vault-integration.md` - Detailed Vault setup procedures
- `src/shared/wallets/wallet.config.ts` - Application wallet configuration code
- `src/shared/cryptography/vault-cryptography.service.ts` - Vault cryptography implementation

## Emergency Procedures

If the platform seed is compromised:

1. **Immediately stop all services** that use the platform wallet
2. **Generate a new seed** following this guide
3. **Migrate funds** to new addresses derived from the new seed
4. **Update all systems** to use the new seed
5. **Audit all access logs** for signs of compromise
6. **Rotate all credentials** and keys

**Contact**: System administrators and security team immediately for any suspected compromise.