#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

docker compose \
  --env-file "$WORKING_DIR/.env.testing" \
  --file "$WORKING_DIR/docker-compose.testing.yml" \
  up \
  --build \
  --force-recreate \
  --detach \
  --remove-orphans \
  --wait
