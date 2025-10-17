#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

# Check for required commands
for cmd in initdb postgres pg_isready redis-server redis-cli; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: $cmd is not installed or not in PATH."
        exit 1
    fi
done

env -C $WORKING_DIR pnpm build

POSTGRES_PORT=$((10000 + RANDOM % 10001))
DATABASE_URL="postgresql://postgres:postgres@localhost:$POSTGRES_PORT/postgres"

# Create temporary directory for PostgreSQL data
POSTGRES_DATA_DIR=$(mktemp -d)

# Initialize PostgreSQL database with 'postgres' as superuser
initdb -D $POSTGRES_DATA_DIR -U postgres

# Configure PostgreSQL to use trust authentication for localhost connections
echo "host    all             all             127.0.0.1/32            trust" >> $POSTGRES_DATA_DIR/pg_hba.conf
echo "host    all             all             ::1/128                 trust" >> $POSTGRES_DATA_DIR/pg_hba.conf

# Start PostgreSQL server in the background
postgres -D $POSTGRES_DATA_DIR -p $POSTGRES_PORT -k /tmp &
POSTGRES_PID=$!

# echo "PostgreSQL server started on port $POSTGRES_PORT (PID: $POSTGRES_PID) with data dir $POSTGRES_DATA_DIR"

# Give PostgreSQL a moment to start
sleep 2

# Check if PostgreSQL process is still running
if ! kill -0 $POSTGRES_PID 2>/dev/null; then
    # echo "PostgreSQL process died immediately. Check logs or permissions."
    exit 1
fi

# Wait for PostgreSQL to be ready
timeout=30
count=0
# echo "Waiting for PostgreSQL to be ready on port $POSTGRES_PORT..."
while ! pg_isready -h localhost -p $POSTGRES_PORT >/dev/null 2>&1; do
    # echo "  Attempt $count/$timeout: PostgreSQL not ready yet..."
    sleep 1
    count=$((count + 1))
    if [ $count -gt $timeout ]; then
        # echo "PostgreSQL did not become ready within $timeout seconds"
        pg_isready -h localhost -p $POSTGRES_PORT
        exit 1
    fi
done

REDIS_PORT=$((10000 + RANDOM % 10001))

# Start Redis in-memory only (no persistence) in the background
redis-server --port $REDIS_PORT --save "" --appendonly no &
REDIS_PID=$!

echo "Redis server started on port $REDIS_PORT (PID: $REDIS_PID)"

# Wait for Redis to be ready
echo "Waiting for Redis to be ready on port $REDIS_PORT..."
redis_count=0
while ! redis-cli -p $REDIS_PORT ping >/dev/null 2>&1; do
    echo "  Attempt $redis_count: Redis not ready yet..."
    sleep 1
    redis_count=$((redis_count + 1))
    if [ $redis_count -gt 30 ]; then
        echo "Redis did not become ready within 30 seconds"
        exit 1
    fi
done
echo "Redis is ready"

# Function to kill servers on script exit
cleanup() {
    echo "Stopping PostgreSQL server (PID: $POSTGRES_PID)"
    kill $POSTGRES_PID 2>/dev/null || true
    echo "Stopping Redis server (PID: $REDIS_PID)"
    kill $REDIS_PID 2>/dev/null || true
    echo "Removing temporary PostgreSQL data directory $POSTGRES_DATA_DIR"
    rm -rf $POSTGRES_DATA_DIR
}

# Trap signals to ensure cleanup
trap cleanup EXIT INT TERM

# Set environment variables for the application
export PORT=$((10000 + RANDOM % 10001))
export DATABASE_URL=$DATABASE_URL
export REDIS_HOST=localhost
export REDIS_PORT=$REDIS_PORT
export USE_SMTP=false
export MINIO_ENDPOINT=local

node $WORKING_DIR/dist/main.js api migration
