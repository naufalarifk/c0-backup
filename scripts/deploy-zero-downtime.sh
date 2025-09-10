#!/bin/bash

# Zero Downtime Deployment Script
# This script performs a rolling deployment with health checks

set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-"docker-compose.testing.yml"}
SERVICE_NAME="api"
HEALTH_CHECK_URL="http://api:3100/api/auth/ok"
MAX_WAIT_TIME=120
CHECK_INTERVAL=5
PROJECT_NAME=${PROJECT_NAME:-"cg-backend"}

# Helper function to build docker compose command with optional env file
build_compose_cmd() {
    local cmd="docker compose --file \"$COMPOSE_FILE\""
    if [ -n "${ENV_FILE:-}" ] && [ -f "${ENV_FILE}" ]; then
        cmd="$cmd --env-file \"$ENV_FILE\""
    fi
    echo "$cmd"
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

wait_for_healthy() {
    local container_id=$1
    local timeout=$2
    local elapsed=0
    
    log "Waiting for container $container_id to become healthy..."
    
    while [ $elapsed -lt $timeout ]; do
        if docker inspect "$container_id" --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
            log "Container $container_id is healthy"
            return 0
        fi
        
        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
        log "Health check attempt $((elapsed / CHECK_INTERVAL))/$((timeout / CHECK_INTERVAL))"
    done
    
    error "Container $container_id failed to become healthy within ${timeout}s"
}

# Ensure any external networks declared in the compose file exist locally
ensure_external_networks_exist() {
    log "Checking for external networks declared in compose file..."

    local config
    if ! config=$(eval "$(build_compose_cmd) config" 2>/dev/null); then
        log "Could not generate compose config, skipping external network checks"
        return 0
    fi

    # Extract network names that have external: true
    local external_networks
    external_networks=$(printf "%s\n" "$config" | awk '
        /^networks:/ {in_networks=1; next}
        in_networks && /^  [a-zA-Z0-9_.-]+:/ { 
            name=$1; 
            sub(/:$/, "", name); 
            current_network=name; 
            next 
        }
        in_networks && /^    external: true/ { 
            print current_network
            next 
        }
        in_networks && /^[a-z]/ { 
            in_networks=0 
        }
    ')

    if [ -z "${external_networks:-}" ]; then
        log "No external networks declared in compose file"
        return 0
    fi

    log "Found external networks to check: $external_networks"

    # Create any missing external networks
    while IFS= read -r net; do
        [ -z "$net" ] && continue
        net=$(echo "$net" | sed 's/^\s*//; s/\s*$//')
        if docker network ls --format '{{.Name}}' | grep -xq "$net"; then
            log "External network '$net' already exists"
        else
            log "Creating external network '$net'"
            docker network create "$net" || error "Failed to create external network '$net'"
        fi
    done <<< "$external_networks"
}

check_service_availability() {
    local url=$1
    local max_attempts=10
    local attempt=1
    
    log "Checking service availability at $url"
    
    while [ $attempt -le $max_attempts ]; do
        # Check if we can access the service via docker network
        if docker run --rm --network ${PROJECT_NAME}_cg-private-network curlimages/curl:8.11.1 -sf "$url" >/dev/null 2>&1; then
            log "Service is responding correctly"
            return 0
        fi
        
        log "Service check attempt $attempt/$max_attempts failed, retrying..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error "Service failed to respond after $max_attempts attempts"
}

perform_rolling_deployment() {
    log "Starting zero downtime deployment..."
    # Ensure external networks exist before any compose operations
    ensure_external_networks_exist

    # Build new image first
    log "Building new image..."
    eval "$(build_compose_cmd) build \"$SERVICE_NAME\"" || error "Failed to build new image"
    
    # Get current container information
    log "Getting current container information..."
    local current_containers
    current_containers=$(eval "$(build_compose_cmd) ps --quiet \"$SERVICE_NAME\"" 2>/dev/null || true)
    
    if [ -z "$current_containers" ]; then
        log "No existing containers found, performing initial deployment..."
        eval "$(build_compose_cmd) up --detach \"$SERVICE_NAME\""
        
        # Wait for services to be ready
        log "Waiting for services to become healthy..."
        sleep 30
        
        return 0
    fi
    
    log "Found existing containers, performing rolling update..."
    
    # Use docker-compose's built-in rolling update
    # This will gracefully replace containers one by one
    eval "$(build_compose_cmd) up --detach --force-recreate --no-deps \"$SERVICE_NAME\"" || error "Failed to perform rolling update"
    
    # Wait for all containers to be healthy
    log "Waiting for new containers to become healthy..."
    local max_wait=120
    local elapsed=0
    
    while [ $elapsed -lt $max_wait ]; do
        local unhealthy_count
        unhealthy_count=$(eval "$(build_compose_cmd) ps \"$SERVICE_NAME\"" | grep -v "healthy\|Up" | wc -l)
        
        if [ "$unhealthy_count" -eq 1 ]; then  # 1 line is the header
            log "All containers are healthy"
            break
        fi
        
        sleep 5
        elapsed=$((elapsed + 5))
        log "Waiting for containers to become healthy... ${elapsed}s/${max_wait}s"
    done
    
    if [ $elapsed -ge $max_wait ]; then
        error "Containers failed to become healthy within ${max_wait}s"
    fi
    
    log "Rolling deployment completed successfully"
}

# Rollback function
rollback_deployment() {
    log "Rolling back deployment..."
    
    # Stop any containers with new deployment labels
    local new_containers
    new_containers=$(docker ps --quiet --filter "label=deployment.strategy=zero-downtime" --filter "label=deployment.version=${GITHUB_SHA:-latest}" 2>/dev/null || true)
    
    if [ -n "$new_containers" ]; then
        log "Stopping new containers..."
        echo "$new_containers" | xargs -r docker stop --time 30
        echo "$new_containers" | xargs -r docker rm
    fi
    
    # Restart from previous image
    log "Restarting from previous version..."
    ensure_external_networks_exist
    eval "$(build_compose_cmd) up -d \"$SERVICE_NAME\""
    
    log "Rollback completed"
}

# Trap to handle failures
trap 'log "Deployment failed, initiating rollback..."; rollback_deployment' ERR

# Main execution
main() {
    log "Zero downtime deployment starting..."
    log "Compose file: $COMPOSE_FILE"
    log "Environment file: ${ENV_FILE:-"(none)"}"
    log "Service: $SERVICE_NAME"
    log "Health check URL: $HEALTH_CHECK_URL"
    
    perform_rolling_deployment
    
    # Final health check
    log "Performing final health verification..."
    check_service_availability "$HEALTH_CHECK_URL"
    
    log "Zero downtime deployment completed successfully!"
}

# Run main function
main "$@"