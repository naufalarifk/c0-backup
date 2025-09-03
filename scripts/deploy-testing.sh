#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

SSH_HOST=${SSH_HOST:-"128.199.191.2"}
SSH_PORT=${SSH_PORT:-22}
SSH_USER=${SSH_USER:-"root"}

if [ -f "$HOME/.ssh/id_rsa" ]; then
  SSH_KEY="$HOME/.ssh/id_rsa"
elif [ -f "$HOME/.ssh/id_ed25519" ]; then
  SSH_KEY="$HOME/.ssh/id_ed25519"
else
  echo "No SSH key found."
  exit 1
fi

echo "Using SSH key: $SSH_KEY"
echo "Deploying to $SSH_USER@$SSH_HOST:$SSH_PORT"

# Ensure host key is present in known_hosts
if ! ssh-keygen -F "$SSH_HOST" > /dev/null; then
  echo "Adding $SSH_HOST to known_hosts..."
  ssh-keyscan -p "$SSH_PORT" "$SSH_HOST" >> "$HOME/.ssh/known_hosts"
fi

ssh -i "$SSH_KEY" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" << 'EOF'
  mkdir -p /root/cg
EOF

rsync -avz -e "ssh -i $SSH_KEY -p $SSH_PORT" \
  --exclude-from="$WORKING_DIR/.gitignore" \
  --exclude '.git/' \
  "$WORKING_DIR/" "$SSH_USER@$SSH_HOST:/root/cg/"

ssh -i "$SSH_KEY" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" << 'EOF'
  cd /root/cg
  docker compose --file docker-compose.testing.yml up --build --force-recreate --detach
EOF
