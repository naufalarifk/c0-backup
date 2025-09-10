#!/bin/bash

# Zero Downtime Deployment Script
# This script performs a rolling deployment with health checks

set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-"docker-compose.testing.yml"}
SERVICE_NAME="api"
HEALTH_CHECK_URL="http://localhost:3100/api/auth/ok"
MAX_WAIT_TIME=120
CHECK_INTERVAL=5

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

check_service_availability() {
    local url=$1
    local max_attempts=10
    local attempt=1
    
    log "Checking service availability at $url"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
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
    
    # Build new image first
    log "Building new image..."
    eval "$(build_compose_cmd) build \"$SERVICE_NAME\"" || error "Failed to build new image"
    
    # Get current container IDs
    log "Getting current container information..."
    local current_containers
    current_containers=$(eval "$(build_compose_cmd) ps --quiet \"$SERVICE_NAME\"" 2>/dev/null || true)
    
    if [ -z "$current_containers" ]; then
        log "No existing containers found, performing initial deployment..."
        eval "$(build_compose_cmd) up --detach \"$SERVICE_NAME\""
        return 0
    fi
    
    # Convert to array
    local containers_array=($current_containers)
    local container_count=${#containers_array[@]}
    
    log "Found $container_count existing containers"
    
    # Rolling update: replace containers one by one
    for i in "${!containers_array[@]}"; do
        local container_id="${containers_array[$i]}"
        local container_name=$(docker inspect "$container_id" --format='{{.Name}}' | sed 's/^\///')
        
        log "Updating container $((i + 1))/$container_count: $container_name ($container_id)"
        
        # Start new container with temporary name
        local temp_name="${container_name}_new_$$"
        log "Starting new container: $temp_name"
        
        # Create new container
        docker run \
            --detach \
            --name "$temp_name" \
            --network "$(docker inspect "$container_id" --format='{{range .NetworkSettings.Networks}}{{.NetworkID}}{{end}}' | head -1)" \
            --label "deployment.strategy=zero-downtime" \
            --label "deployment.version=${GITHUB_SHA:-$(date +%s)}" \
            $(docker inspect "$container_id" --format='{{.Config.Image}}') \
            $(docker inspect "$container_id" --format='{{join .Config.Cmd " "}}') \
            || error "Failed to start new container"
        
        # Wait for new container to be healthy
        wait_for_healthy "$temp_name" $MAX_WAIT_TIME
        
        # Check if service is still available
        check_service_availability "$HEALTH_CHECK_URL"
        
        # Stop old container gracefully
        log "Stopping old container: $container_name"
        docker stop "$container_id" --time 30 || log "Warning: Failed to stop container gracefully"
        
        # Remove old container
        docker rm "$container_id" || log "Warning: Failed to remove old container"
        
        # Rename new container to original name
        docker rename "$temp_name" "$container_name"
        
        log "Successfully updated container $((i + 1))/$container_count"
        
        # Brief pause between container updates
        if [ $((i + 1)) -lt $container_count ]; then
            log "Waiting before updating next container..."
            sleep 10
        fi
    done
    
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