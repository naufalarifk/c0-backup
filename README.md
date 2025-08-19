# 🚀 Backend API

> NestJS backend application with Better Auth, Drizzle ORM, and comprehensive development tooling

[![NestJS](https://img.shields.io/badge/NestJS-v11-red?logo=nestjs)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://typescriptlang.org)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-green?logo=drizzle)](https://orm.drizzle.team)
[![Better Auth](https://img.shields.io/badge/Better-Auth-purple)](https://better-auth.com)

## 📖 **Overview**

This is a NestJS backend application with Better Auth, Drizzle ORM, and comprehensive development tooling including automated code quality checks and git hooks.

## 🛠 **Tech Stack**

- **Framework**: NestJS v11
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with SSO support
- **Code Quality**: Biome (formatter + linter)
- **Git Hooks**: Lefthook
- **Package Manager**: pnpm

## 🚀 **Quick Start**

### **Option 1: With Docker (Recommended)**
```bash
# Clone and setup
git clone https://github.com/cryptogadai-projects/cg-backend.git
cd cg-backend
pnpm install  # Auto-installs hooks via postinstall

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start services with Docker
docker compose --env-file .env.docker up -d

# Database setup
pnpm db:push    # Push schema to database

# Start development
pnpm start:dev
```

### **Option 2: Local Database**
```bash
# Clone and setup
git clone https://github.com/cryptogadai-projects/cg-backend.git
cd cg-backend
pnpm install

# Setup environment (with local PostgreSQL/Redis)
cp .env.example .env
# Edit .env with your local database credentials

# Database setup
pnpm db:push

# Start development
pnpm start:dev
```

## 🌱 **Environment Variables**

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# Auth
AUTH_SECRET="your-auth-secret-key"
BETTER_AUTH_URL="http://localhost:3000"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="your-twilio-sid"
TWILIO_AUTH_TOKEN="your-twilio-token"
TWILIO_PHONE_NUMBER="your-twilio-phone"

# SSO (Google OAuth)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Docker Configuration (for docker compose)
POSTGRES_VERSION="16-alpine"
POSTGRES_CONTAINER_NAME="gadain-postgres"
POSTGRES_DB="gadain_db"
POSTGRES_USER="gadain_user"
POSTGRES_PASSWORD="your-postgres-password"
POSTGRES_PORT="5432"

REDIS_VERSION="7-alpine"
REDIS_CONTAINER_NAME="gadain-redis"
REDIS_PASSWORD="your-redis-password"
REDIS_PORT="6379"

# Health Check Settings
HEALTHCHECK_INTERVAL="30s"
HEALTHCHECK_TIMEOUT="10s"
HEALTHCHECK_RETRIES="3"
HEALTHCHECK_START_PERIOD="30s"
```

## 🐳 **Docker Setup**

### **Quick Start with Docker**
```bash
# Start PostgreSQL and Redis services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Reset all data (⚠️ Destructive)
docker compose down -v
```

### **Docker Services**
- **PostgreSQL**: Database server on port 5432
- **Redis**: Cache/session store on port 6379
- **Networks**: Custom `gadain-network` bridge
- **Volumes**: Persistent data storage for both services

### **Health Checks**
Both services include health checks for monitoring:
```bash
# Check service status
docker compose ps

# Check specific service health
docker compose exec postgres pg_isready -U gadain_user -d gadain_db
docker compose exec redis redis-cli ping
```

## 🏃‍♂️ **Running the Application**

```bash
# Development mode (with hot reload)
pnpm start:dev

# Production mode
pnpm build
pnpm start

# Debug mode
pnpm start:debug
```

## 🛠 **Available Scripts**

### **Development**
```bash
pnpm start:dev              # Start in watch mode
pnpm build                  # Build for production
pnpm format                 # Format code with Biome
```

### **Database**
```bash
pnpm db:generate             # Generate migrations
pnpm db:migrate             # Run migrations
pnpm db:push                # Push schema to DB (dev only)
pnpm db:studio              # Open Drizzle Studio
```

### **Testing**
```bash
pnpm test                   # Run tests
pnpm test:watch             # Run tests in watch mode
pnpm test:cov               # Run with coverage
pnpm test:e2e               # Run e2e tests
```

## 🪝 **Git Hooks**

### **📋 Installed Hooks:**
- **pre-commit**: Biome check with auto-fix (JS, TS, JSON files)
- **commit-msg**: Conventional commits validation
- **pre-push**: Build verification

```bash
pnpm hooks:install          # Install git hooks
pnpm hooks:uninstall        # Remove git hooks
```

## ✅ **Commit Message Format**

```bash
# ✅ Valid formats
feat: add new authentication module
fix: resolve database connection issue
docs: update API documentation

# ❌ Invalid formats
"add new feature"           # No type
"Fix Bug"                   # Wrong case
```

## 📁 **Project Structure**

```
src/
├── modules/
│   └── auth/                # Authentication module
│       ├── auth.module.ts
│       ├── auth.service.ts
│       ├── auth-config.service.ts
│       └── types/           # Auth-specific types
├── shared/                  # Shared modules
│   ├── database/           # Database configuration
│   └── modules/            # Shared NestJS modules
├── lib/                    # Utility libraries
│   ├── email/              # Email service
│   ├── otp/                # OTP service
│   └── sso.ts              # SSO configuration
└── main.ts                 # Application entry point
```

## 🚀 **API Documentation**

Once the application is running:

- **API Documentation**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`
- **Database Studio**: Run `pnpm db:studio`

## 🚨 **Troubleshooting**

### **Git Hooks Issues**
```bash
pnpm hooks:install          # Re-install hooks
npx lefthook version        # Check status
```

### **Build/Commit Issues**
```bash
pnpm format                 # Fix formatting
pnpm build                  # Fix build errors
```

### **Database Connection Issues**
```bash
# Check Docker services
docker compose ps
docker compose logs postgres

# Restart services
docker compose restart postgres redis

# Reset database (⚠️ Destructive)
docker compose down -v
docker compose up -d
pnpm db:push
```

### **Port Conflicts**
```bash
# Check what's using ports
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # Application

# Change ports in .env if needed
POSTGRES_PORT="5433"
REDIS_PORT="6380"
```

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/amazing-feature`
3. **Commit** your changes: `git commit -m "feat: add amazing feature"`
4. **Push** to the branch: `git push origin feat/amazing-feature`
5. **Open** a Pull Request

## 📚 **Additional Resources**

- [NestJS Documentation](https://docs.nestjs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Better Auth Documentation](https://www.better-auth.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Happy coding! 🎉**
