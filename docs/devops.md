You are system administrator. Your responsibility is to maintain server of the CryptoGadai project. You are given access to server via SSH:

```
$ ssh root@174.138.16.211 'cat /etc/os-release'
PRETTY_NAME="Ubuntu 22.04.4 LTS"
NAME="Ubuntu"
VERSION_ID="22.04"
VERSION="22.04.4 LTS (Jammy Jellyfish)"
VERSION_CODENAME=jammy
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
UBUNTU_CODENAME=jammy
```

You are responsible for managing bellow services running on the server via systemd units:
- postgresql (database)
- redis (caching and message broker)
- minio (object storage service)
- cg-backend (main backend service)
- traefik (reverse proxy and SSL termination)
- nginx (web server for static files)
- ghost (blog CMS)
- vault (secrets management)

## cg-backend

The `cg-backend` deployment flow is as bellow:
- the deployment code are based on current local code base
- sync the local code base to server at `/opt/cg-backend` via `rsync`. Complete command: `rsync -avz --delete --exclude-from=.gitignore --exclude .git/ --exclude node_modules/ --exclude .env* --exclude *.log --exclude .vscode/ --exclude .local/ -e "ssh -i $HOME/.ssh/id_ed25519 -p 22 -o StrictHostKeyChecking=yes -o ConnectTimeout=30 -o ServerAliveInterval=60" ./ root@174.138.16.211:/opt/cg-backend/`
- make sure the app dependecy on server is up to date by running: `ssh root@174.138.16.211 'env -C /opt/cg-backend pnpm install --frozen-lockfile --ignore-scripts'`
- rebuild the app `ssh root@174.138.16.211 'env -C /opt/cg-backend pnpm run build'`
- (optionally) make sure the environment variables are set properly in `/etc/systemd/system/cg-backend.service`
- (optionally) reload systemd daemon after updating cg-backend systemd unit via `ssh root@174.138.16.211 'systemctl daemon-reload'`
- restart the service `ssh root@174.138.16.211 'systemctl restart cg-backend'`

## ghost

The `ghost` deployment is a blog CMS running on the server.

- The ghost instance is installed at `/opt/ghost/site`
- Uses SQLite database at `/opt/ghost/site/content/data/ghost.db`
- Runs as systemd unit `ghost-cg-blog.service`
- Served via Traefik at `https://cg-blog.kairospro.io`

To manage the ghost service:
- `systemctl status ghost-cg-blog`
- `systemctl restart ghost-cg-blog`

To update ghost:
- Update via `ghost update` in the site directory, or manage via web interface.

## cg-admin

The `cg-admin` deployment is a Vue.js frontend application served as static files.

- The application code is deployed to `/opt/cg-admin`
- Uses npm for package management
- Served via nginx on port 8081
- Routed through Traefik at `https://cg-admin.kairospro.io`

The `cg-admin` deployment flow is as below:
- the deployment code is based on current local code base
- sync the local code base to server at `/opt/cg-admin` via `rsync`. Complete command: `env -C $CG_ADMIN_DIR rsync -avz --delete --exclude-from=.gitignore --exclude .git/ --exclude node_modules/ --exclude *.log --exclude .vscode/ --exclude .local/ -e "ssh -i $HOME/.ssh/id_ed25519 -p 22 -o StrictHostKeyChecking=yes -o ConnectTimeout=30 -o ServerAliveInterval=60" ./ root@174.138.16.211:/opt/cg-admin/`
- make sure the app dependencies on server are up to date by running: `ssh root@174.138.16.211 'env -C /opt/cg-admin npm install'`
- rebuild the app `ssh root@174.138.16.211 'env -C /opt/cg-admin npm run build'`
- reload nginx `ssh root@174.138.16.211 'systemctl reload nginx'`

To manage the nginx service:
- `systemctl status nginx`
- `systemctl reload nginx`

## vault

The `vault` service is HashiCorp Vault for managing secrets and sensitive data.

- Installed via official HashiCorp APT repository
- Configuration at `/etc/vault.d/vault.hcl`
- Uses file-based storage at `/opt/vault/data`
- TLS certificates at `/opt/vault/tls/`
- Runs as systemd unit `vault.service`
- Served on HTTPS port 8200
- Initialized and unsealed with Shamir seal (5 keys, threshold 3)

To manage the vault service:
- `systemctl status vault`
- `systemctl restart vault`

To interact with Vault CLI:
- Set environment: `export VAULT_ADDR=https://127.0.0.1:8200 VAULT_SKIP_VERIFY=true`
- Check status: `vault status`
- If sealed, unseal with: `vault operator unseal` (provide at least 3 unseal keys)

## Vault Configuration for cg-backend

The `cg-backend` service uses HashiCorp Vault for cryptographic operations and secrets management.

### Vault Setup for cg-backend

- **Secrets Engine**: KV v2 at `secret/` path
- **Transit Engine**: For encryption/decryption operations
- **Authentication**: AppRole authentication
- **Policy**: `cg-backend` policy with access to wallet secrets and transit operations

### Required Secrets

- `secret/data/wallet/platform-seed`: Contains `encrypted_seed` field with the encrypted platform wallet master seed
- Transit key `platform-wallet`: AES256-GCM96 key for encrypting/decrypting wallet seeds

### Environment Variables

The following environment variables are configured in `/etc/systemd/system/cg-backend.service`:

```
CRYPTOGRAPHY_ENGINE=vault
CRYPTOGRAPHY_VAULT_ADDRESS=https://127.0.0.1:8200
CRYPTOGRAPHY_VAULT_ROLE_ID=<role_id>
CRYPTOGRAPHY_VAULT_SECRET_ID=<secret_id>
```

### AppRole Configuration

- **Role**: `cg-backend`
- **Policy**: `cg-backend`
- **Token TTL**: 1 hour
- **Token Max TTL**: 24 hours

To rotate credentials:
1. Generate new secret_id: `vault write -f auth/approle/role/cg-backend/secret-id`
2. Update the `CRYPTOGRAPHY_VAULT_SECRET_ID` in the systemd service
3. Reload systemd: `systemctl daemon-reload`
4. Restart cg-backend: `systemctl restart cg-backend`
