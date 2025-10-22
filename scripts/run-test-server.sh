#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

# Function to generate random port in range
generate_random_port() {
    local min=$1
    local max=$2
    echo $((RANDOM % (max - min + 1) + min))
}

# Function to check if port is open
check_port() {
    local port=$1
    if nc -z localhost "$port" > /dev/null 2>&1; then
        echo "open"
    else
        echo "closed"
    fi
}

# Function to wait for service readiness
wait_for_service() {
    local name=$1
    local check_command=$2
    local max_attempts=10
    local attempt=1

    echo "Waiting for $name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command"; then
            echo "$name is ready!"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts: $name not ready yet..."
        sleep 2
        ((attempt++))
    done

    echo "Failed to start $name after $max_attempts attempts"
    return 1
}

# Cleanup function
cleanup() {
    echo "Cleaning up processes..."
    if [ ! -z "${REDIS_PID:-}" ]; then
        kill "$REDIS_PID" 2>/dev/null || true
    fi
    if [ ! -z "${MAILPIT_PID:-}" ]; then
        kill "$MAILPIT_PID" 2>/dev/null || true
    fi
    if [ ! -z "${BACKEND_PID:-}" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ ! -z "${EXPO_PID:-}" ]; then
        kill "$EXPO_PID" 2>/dev/null || true
    fi
    echo "Cleanup complete."
    exit 0
}

# Set trap for cleanup on exit
trap cleanup SIGINT SIGTERM

# Generate random ports
REDIS_PORT=$(generate_random_port 20000 24999)
MAILPIT_SMTP_PORT=$(generate_random_port 25000 29999)
MAILPIT_API_PORT=$(generate_random_port 30000 39999)
BACKEND_PORT=$(generate_random_port 20000 29999)
EXPO_WEB_PORT=$(generate_random_port 30000 39999)

MAILPIT_API_ADDR="localhost:$MAILPIT_API_PORT"
BACKEND_ADDR="localhost:$BACKEND_PORT"
EXPO_WEB_ADDR="localhost:$EXPO_WEB_PORT"

echo "Starting Redis on port $REDIS_PORT..."
redis-server --port "$REDIS_PORT" --save "" --appendonly no &
REDIS_PID=$!

wait_for_service "Redis" "test \"$(check_port "$REDIS_PORT")\" = \"open\""

echo "Starting Mailpit (SMTP: $MAILPIT_SMTP_PORT, API: $MAILPIT_API_PORT)..."
mailpit --listen "[::]:$MAILPIT_API_PORT" --smtp "[::]:$MAILPIT_SMTP_PORT" &
MAILPIT_PID=$!

wait_for_service "Mailpit" "curl -s http://$MAILPIT_API_ADDR/api/v1/messages > /dev/null 2>&1"

echo "Redis and Mailpit started successfully"

echo "Starting CryptoGadai Backend on port $BACKEND_PORT..."

mkdir -p "$WORKING_DIR"/.local

cd "$WORKING_DIR"

pnpm build

NODE_ENV=development \
ALLOWED_ORIGINS="http://$EXPO_WEB_ADDR,cryptogadai://*" \
APP_EXPO_URL="exp://$EXPO_WEB_ADDR/--" \
APP_SCHEME="cryptogadai://" \
BETTER_AUTH_COOKIE_PREFIX="cryptogadai" \
BETTER_AUTH_EXPIRATION_TIME="3600" \
BETTER_AUTH_MAXIMUM_SESSIONS="3" \
BETTER_AUTH_SECRET="P1skQoJiT7jnNDHuw06kkbTougc3jvTt" \
BETTER_AUTH_TELEMETRY_DEBUG="1" \
BETTER_AUTH_TELEMETRY="1" \
BETTER_AUTH_URL="http://localhost:$BACKEND_PORT" \
CRYPTOGRAPHY_ENGINE="local" \
DATABASE_URL=":inmemory:" \
GOOGLE_CLIENT_ID="836145162943-d3ooukrbp72q8cvaq9q1blfbm9bqjgoc.apps.googleusercontent.com" \
GOOGLE_CLIENT_SECRET="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" \
MAIL_HOST="localhost" \
MAIL_SMTP_PORT="$MAILPIT_SMTP_PORT" \
MINIO_ENDPOINT="local" \
PORT="$BACKEND_PORT" \
REDIS_HOST="localhost" \
REDIS_PORT="$REDIS_PORT" \
THROTTLER_LIMIT="10" \
THROTTLER_TTL="1m" \
node dist/main.js api notification > "$WORKING_DIR"/.local/backend.log 2>&1 &
BACKEND_PID=$!

wait_for_service "CG Backend" "grep -q 'application successfully started' $WORKING_DIR/.local/backend.log 2>/dev/null"

echo "CryptoGadai Backend and Expo Web started successfully"
echo ""
echo "Service URLs:"
echo "Mailpit UI: http://$MAILPIT_API_ADDR"
echo "Backend API: http://$BACKEND_ADDR"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for processes
wait
