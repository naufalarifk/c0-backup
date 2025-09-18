#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Generating secure secrets for CryptoGadai...${NC}"
echo ""

# Function to generate secret
generate_secret() {
    openssl rand -base64 32
}

# Function to generate hex key
generate_hex() {
    openssl rand -hex 32
}

# Check if .env exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file already exists!${NC}"
    read -p "Do you want to backup existing .env? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo -e "${GREEN}✅ Backup created${NC}"
    fi
fi

# Generate secrets
BETTER_AUTH_SECRET=$(generate_secret)
CRYPTOGRAPHY_KEY=$(generate_secret)
SESSION_SECRET=$(generate_secret)
DB_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -base64 16)
MINIO_SECRET=$(generate_hex)

# Create output
cat << EOF

${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${GREEN}📝 Add these to your .env file:${NC}
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

# 🔒 Authentication Secret (Generated with openssl rand -base64 32)
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}

# 🔐 Encryption Key (Generated with openssl rand -base64 32)
CRYPTOGRAPHY_LOCAL_ENCRYPTION_KEY=${CRYPTOGRAPHY_KEY}

# 🔑 Session Secret (Generated with openssl rand -base64 32)
SESSION_SECRET=${SESSION_SECRET}

# 🗄️ Database Password (Generated with openssl rand -base64 24)
DATABASE_PASSWORD=${DB_PASSWORD}

# 📦 Redis Password (Generated with openssl rand -base64 16)
REDIS_PASSWORD=${REDIS_PASSWORD}

# 🗂️ MinIO Secret Key (Generated with openssl rand -hex 32)
MINIO_SECRET_KEY=${MINIO_SECRET}

${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

EOF

echo -e "${GREEN}✅ Secrets generated successfully!${NC}"
echo -e "${YELLOW}⚠️  Remember:${NC}"
echo -e "   • Never commit these secrets to Git"
echo -e "   • Use different secrets for each environment"
echo -e "   • Rotate secrets regularly (every 90 days recommended)"
echo -e "   • Store production secrets in a secure vault"
echo ""

# Ask if user wants to save to file
read -p "Save to .env.secrets file? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cat > .env.secrets << EOF
# Generated on $(date)
# NEVER COMMIT THIS FILE TO GIT

BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
CRYPTOGRAPHY_LOCAL_ENCRYPTION_KEY=${CRYPTOGRAPHY_KEY}
SESSION_SECRET=${SESSION_SECRET}
DATABASE_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
MINIO_SECRET_KEY=${MINIO_SECRET}
EOF

    chmod 600 .env.secrets
    echo -e "${GREEN}✅ Saved to .env.secrets (permissions set to 600)${NC}"
    echo -e "${YELLOW}📋 Copy values from .env.secrets to your .env file${NC}"
fi
