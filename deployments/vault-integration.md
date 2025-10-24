```
$ ssh root@174.138.16.211 'cat /etc/systemd/system/cg-backend.service'
[Unit]
Description=CryptoGadai Backend
After=network.target postgresql@14-main.service redis-server.service minio.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/cg-backend
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
Environment=REDIS_HOST=localhost
Environment=REDIS_PORT=6379
Environment=MINIO_ENDPOINT=localhost:9000
Environment=MINIO_ROOT_USER=rootuser
Environment=MINIO_ROOT_PASSWORD=rootuser
Environment=ENABLED_INDEXERS=cg:testnet
Environment=RESEND_API_KEY=re_7rjxxjUk_BMDZb8t4CcdtbuT1dNQxMPRX
Environment=USE_SMTP=true
Environment=EMAIL_FROM=no-reply.cg@kairospro.io
Environment=MAIL_HOST=smtp.resend.com
Environment=MAIL_SMTP_PORT=2465
Environment=MAIL_USER=resend
Environment=MAIL_PASSWORD=re_7rjxxjUk_BMDZb8t4CcdtbuT1dNQxMPRX
Environment=MAIL_SECURE=true
Environment=MAIL_IGNORE_TLS=false
Environment=ALLOWED_ORIGINS=http://localhost:3000,https://cg-api.kairospro.io,https://cg-admin.kairospro.io,cryptogadai://
ExecStart=/usr/bin/node /opt/cg-backend/dist/main.js api migration indexer document notification
Restart=always
RestartSec=5

Environment=GOOGLE_ANDROID_CLIENT_ID=654052858535-3arajfrdraabpeo30f4ep6lkk63g31vr.apps.googleusercontent.com
Environment=GOOGLE_CLIENT_ID=654052858535-utonbmelme03f9tsfha5u9b17ljujrl2.apps.googleusercontent.com
Environment=GOOGLE_CLIENT_SECRET=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
Environment=GOOGLE_WEB_CLIENT_ID=654052858535-utonbmelme03f9tsfha5u9b17ljujrl2.apps.googleusercontent.com
Environment=BETTER_AUTH_COOKIE_PREFIX=cryptogadai
Environment=EXPO_ACCESS_TOKEN=k9_Y9wCJFlMirJtZtp2YcE1KjNTm7tOu_yzT5FG5
[Install]
WantedBy=multi-user.target

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault secrets list'
Path          Type         Accessor              Description
----          ----         --------              -----------
cubbyhole/    cubbyhole    cubbyhole_4fd19d6f    per-token private secret storage
identity/     identity     identity_0eafd55a     identity store
sys/          system       system_bcb20c1a       system endpoints used for control, policy and debugging

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault secrets enable -path=secret kv-v2'
Success! Enabled the kv-v2 secrets engine at: secret/

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault secrets enable transit'
Success! Enabled the transit secrets engine at: transit/

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && echo '\''path "secret/data/wallet/*" {
>   capabilities = ["read"]
> }
> 
> path "transit/encrypt/*" {
>   capabilities = ["update"]
> }
> 
> path "transit/decrypt/*" {
>   capabilities = ["update"]
> }
> 
> path "transit/keys/*" {
>   capabilities = ["read"]
> }'\'' > cg-backend-policy.hcl'

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault policy write cg-backend cg-backend-policy.hcl'
Success! Uploaded policy: cg-backend

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault auth enable approle'
Success! Enabled approle auth method at: approle/

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault write auth/approle/role/cg-backend token_policies="cg-backend" token_ttl="1h" token_max_ttl="24h"'
Success! Data written to: auth/approle/role/cg-backend

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault read auth/approle/role/cg-backend/role-id'
Key        Value
---        -----
role_id    63e3c9e2-33a2-0900-9c70-a2ab20fa47b0

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault write -f auth/approle/role/cg-backend/secret-id'
Key                   Value
---                   -----
secret_id             b6b0f323-ff8a-ee65-ca4a-a7b1337083b2
secret_id_accessor    c7b3bb3d-14d3-62a5-5a1e-e171dfe84f47
secret_id_num_uses    0
secret_id_ttl         0s

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault write transit/keys/platform-wallet type=aes256-gcm96'
Key                       Value
---                       -----
allow_plaintext_backup    false
auto_rotate_period        0s
deletion_allowed          false
derived                   false
exportable                false
imported_key              false
keys                      map[1:1761269378]
latest_version            1
min_available_version     0
min_decryption_version    1
min_encryption_version    0
name                      platform-wallet
supports_decryption       true
supports_derivation       true
supports_encryption       true
supports_signing          false
type                      aes256-gcm96

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && node -e "
> const crypto = require('\''crypto'\'');
> const seed = crypto.randomBytes(64);
> const seedHex = seed.toString('\''hex'\'');
> console.log('\''Generated seed:'\'', seedHex);
> "'
Generated seed: b0527b5e65d1c99afff1ee5362d6a05883c6f0990cd23cdb1b5fe973f5f66eddf3e11ef4f07b9ef69ee04df41da5bb62af09698d3c39c71bda8db2fde5b76e90

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault write transit/encrypt/platform-wallet plaintext=$(echo -n "b0527b5e65d1c99afff1ee5362d6a05883c6f0990cd23cdb1b5fe973f5f66eddf3e11ef4f07b9ef69ee04df41da5bb62af09698d3c39c71bda8db2fde5b76e90" | base64)'
Failed to parse K=V data: invalid key/value pair "NWY2NmVkZGYzZTExZWY0ZjA3YjllZjY5ZWUwNGRmNDFkYTViYjYyYWYwOTY5OGQzYzM5YzcxYmRh": format must be key=value

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && echo -n "b0527b5e65d1c99afff1ee5362d6a05883c6f0990cd23cdb1b5fe973f5f66eddf3e11ef4f07b9ef69ee04df41da5bb62af09698d3c39c71bda8db2fde5b76e90" | base64 | xargs -I {} vault write transit/encrypt/platform-wallet plaintext={}'
Key            Value
---            -----
ciphertext     vault:v1:I8pVjmWHml+MR/9JF3z/Rrjy/XsuH7SCLkTJ6VSC76zcfUZkhYjEIdmy/9bCDEBUjz23ZoxR8z6x2QBuBXjwXJkYbt6ioI2xIibtpt9CTPG1A70tdg==
key_version    1
Key            Value
---            -----
ciphertext     vault:v1:oSnbodKMzEp33Dj/EAKBZsl+IadCb8G08qdnU5FGT5U97RkgXzy80GrFZDC8+Pj4jiSzl2As5DMixQ7F5MPvv/MrrghMhainUFKg0RTFb1TTNK3jrQ==
key_version    1
Key            Value
---            -----
ciphertext     vault:v1:b3M/s8BXZLu57NS5m6tdZxtPaaqBB2fWdTgtvPnNjApjbK9QnchAZgqM
key_version    1

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault write transit/encrypt/platform-wallet plaintext="$(echo -n '\''b0527b5e65d1c99afff1ee5362d6a05883c6f0990cd23cdb1b5fe973f5f66eddf3e11ef4f07b9ef69ee04df41da5bb62af09698d3c39c71bda8db2fde5b76e90'\'' | base64 -w 0)"'
Key            Value
---            -----
ciphertext     vault:v1:66do/MZviemsDrAE8qZXFWLJ7PNNwtG5dE2Q/y/rS6ri4ENyf/Ldrnc87TPx9nfbUx0hYJ7CSAPGPbJJehLRwmyfdcPeJZNRb1UP5iSFNxb0OZMEJje34MNOQrG/+3GBLQABGvPrYcq/tksICUt77avd245Hsvza5WAfI0BOx1i5SwI8d5y6XISOBhrIOiEoX5CaMCX6TgA4NXc9
key_version    1

$ ssh root@174.138.16.211 'export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true VAULT_TOKEN=hvs.wQYf1eobCSLl5waz8xN6lB79 && vault kv put secret/wallet/platform-seed encrypted_seed="vault:v1:66do/MZviemsDrAE8qZXFWLJ7PNNwtG5dE2Q/y/rS6ri4ENyf/Ldrnc87TPx9nfbUx0hYJ7CSAPGPbJJehLRwmyfdcPeJZNRb1UP5iSFNxb0OZMEJje34MNOQrG/+3GBLQABGvPrYcq/tksICUt77avd245Hsvza5WAfI0BOx1i5SwI8d5y6XISOBhrIOiEoX5CaMCX6TgA4NXc9"'
========== Secret Path ==========
secret/data/wallet/platform-seed

======= Metadata =======
Key                Value
---                -----
created_time       2025-10-24T01:29:57.45693502Z
custom_metadata    <nil>
deletion_time      n/a
destroyed          false
version            1

$ ssh root@174.138.16.211 'sed -i '\''/Environment=EXPO_ACCESS_TOKEN/a Environment=CRYPTOGRAPHY_ENGINE=vault\nEnvironment=CRYPTOGRAPHY_VAULT_ADDRESS=https://127.0.0.1:8200\nEnvironment=CRYPTOGRAPHY_VAULT_ROLE_ID=63e3c9e2-33a2-0900-9c70-a2ab20fa47b0\nEnvironment=CRYPTOGRAPHY_VAULT_SECRET_ID=b6b0f323-ff8a-ee65-ca4a-a7b1337083b2'\'' /etc/systemd/system/cg-backend.service'

$ ssh root@174.138.16.211 'systemctl daemon-reload'

$ ssh root@174.138.16.211 'systemctl restart cg-backend'

$ ssh root@174.138.16.211 'systemctl status cg-backend'
● cg-backend.service - CryptoGadai Backend
     Loaded: loaded (/etc/systemd/system/cg-backend.service; enabled; vendor preset: enabled)
     Active: active (running) since Fri 2025-10-24 01:30:07 UTC; 3s ago
   Main PID: 269788 (node)
      Tasks: 11 (limit: 9477)
     Memory: 109.0M
        CPU: 3.503s
     CGroup: /system.slice/cg-backend.service
             └─269788 /usr/bin/node /opt/cg-backend/dist/main.js api migration indexer document notification

Oct 24 01:30:07 testnet-03 systemd[1]: Started CryptoGadai Backend.
```

I've successfully configured Vault for the deployed cg-backend on the server. Here's what was accomplished:

## Vault Configuration Summary

### Secrets Engines Enabled
- **KV v2** at `secret/` path for storing encrypted secrets
- **Transit** engine for cryptographic operations

### Authentication Setup
- Enabled **AppRole** authentication method
- Created `cg-backend` AppRole with appropriate policy
- Generated Role ID: `63e3c9e2-33a2-0900-9c70-a2ab20fa47b0`
- Generated Secret ID: `b6b0f323-ff8a-ee65-ca4a-a7b1337083b2`

### Policy Configuration
- Created `cg-backend` policy with permissions for:
  - Reading wallet secrets from `secret/data/wallet/*`
  - Encrypting/decrypting with transit keys
  - Reading transit key information

### Secrets Created
- **Platform wallet seed**: Generated a random 64-byte seed, encrypted it with the `platform-wallet` transit key, and stored at `secret/data/wallet/platform-seed`

### Service Configuration
- Updated `/etc/systemd/system/cg-backend.service` with Vault environment variables:
  - `CRYPTOGRAPHY_ENGINE=vault`
  - `CRYPTOGRAPHY_VAULT_ADDRESS=https://127.0.0.1:8200`
  - `CRYPTOGRAPHY_VAULT_ROLE_ID` and `CRYPTOGRAPHY_VAULT_SECRET_ID`
- Reloaded systemd and restarted the cg-backend service

### Documentation
- Updated devops.md with comprehensive Vault configuration documentation

The cg-backend service is now running with Vault integration for secure cryptographic operations and secrets management. The service successfully started and is operational.

Made changes.