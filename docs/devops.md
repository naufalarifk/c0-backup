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
- ghost (blog CMS)

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
