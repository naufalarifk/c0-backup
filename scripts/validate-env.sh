#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Validating environment configuration...${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo -e "${YELLOW}Run 'cp .env.example .env' to create one${NC}"
    exit 1
fi

# Source the .env file
set -a
source .env
set +a

# Track errors
ERRORS=0
WARNINGS=0

# Function to check required variable
check_required() {
    local var_name=$1
    local var_value=${!var_name}

    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ $var_name is not set${NC}"
        ((ERRORS++))
    else
        echo -e "${GREEN}✅ $var_name is set${NC}"
    fi
}

# Function to check secret strength
check_secret() {
    local var_name=$1
    local var_value=${!var_name}

    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ $var_name is not set${NC}"
        ((ERRORS++))
    elif [ ${#var_value} -lt 32 ]; then
        echo -e "${YELLOW}⚠️  $var_name is too short (${#var_value} chars, min 32)${NC}"
        ((WARNINGS++))
    elif [[ "$var_value" == *"test"* ]] || [[ "$var_value" == *"default"* ]] || [[ "$var_value" == "your-secret"* ]]; then
        echo -e "${YELLOW}⚠️  $var_name appears to use a default value${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ $var_name looks secure (${#var_value} chars)${NC}"
    fi
}

# Function to check URL format
check_url() {
    local var_name=$1
    local var_value=${!var_name}

    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  $var_name is not set${NC}"
        ((WARNINGS++))
    elif [[ "$var_value" =~ ^https?:// ]]; then
        echo -e "${GREEN}✅ $var_name has valid URL format${NC}"
    else
        echo -e "${RED}❌ $var_name has invalid URL format${NC}"
        ((ERRORS++))
    fi
}

# Function to check boolean
check_boolean() {
    local var_name=$1
    local var_value=${!var_name}

    if [[ "$var_value" == "true" ]] || [[ "$var_value" == "false" ]] || [[ "$var_value" == "0" ]] || [[ "$var_value" == "1" ]]; then
        echo -e "${GREEN}✅ $var_name has valid boolean value: $var_value${NC}"
    else
        echo -e "${RED}❌ $var_name has invalid boolean value: $var_value${NC}"
        ((ERRORS++))
    fi
}

echo -e "${BLUE}Checking environment: $NODE_ENV${NC}"
echo ""

# Check core configuration
echo -e "${BLUE}📋 Core Configuration:${NC}"
check_required "NODE_ENV"
check_required "PORT"
check_required "APP_NAME"
echo ""

# Check database
echo -e "${BLUE}🗄️ Database Configuration:${NC}"
check_url "DATABASE_URL"
echo ""

# Check Redis
echo -e "${BLUE}📦 Redis Configuration:${NC}"
check_required "REDIS_HOST"
check_required "REDIS_PORT"
echo ""

# Check authentication
echo -e "${BLUE}🔐 Authentication Configuration:${NC}"
check_secret "BETTER_AUTH_SECRET"
check_url "BETTER_AUTH_URL"
echo ""

# Check encryption
echo -e "${BLUE}🔒 Encryption Configuration:${NC}"
check_required "CRYPTOGRAPHY_ENGINE"
if [ "$CRYPTOGRAPHY_ENGINE" = "local" ]; then
    check_secret "CRYPTOGRAPHY_LOCAL_ENCRYPTION_KEY"
fi
echo ""

# Production-specific checks
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${BLUE}🚀 Production-specific checks:${NC}"

    # Check SSL/TLS settings
    check_boolean "MINIO_USE_SSL"
    check_boolean "MAIL_SECURE"

    # Check required production services
    check_required "TWILIO_ACCOUNT_SID"
    check_required "TWILIO_AUTH_TOKEN"
    check_required "GOOGLE_CLIENT_ID"
    check_required "GOOGLE_CLIENT_SECRET"
    check_required "RESEND_API_KEY"

    echo ""
fi

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Validation Summary:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✨ Perfect! All checks passed.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration valid with $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo -e "${RED}Please fix the errors before running the application.${NC}"
    exit 1
fi
