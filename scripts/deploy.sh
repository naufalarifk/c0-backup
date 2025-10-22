#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

cd $WORKING_DIR

rsync -avz --delete --exclude-from=.gitignore --exclude .git/ --exclude node_modules/ --exclude .env* --exclude *.log --exclude .vscode/ --exclude .local/ -e "ssh -i $HOME/.ssh/id_ed25519 -p 22 -o StrictHostKeyChecking=yes -o ConnectTimeout=30 -o ServerAliveInterval=60" ./ root@174.138.16.211:/opt/cg-backend/

ssh root@174.138.16.211 'env -C /opt/cg-backend pnpm install --frozen-lockfile --ignore-scripts'
ssh root@174.138.16.211 'env -C /opt/cg-backend pnpm run build'
ssh root@174.138.16.211 'systemctl restart cg-backend'
