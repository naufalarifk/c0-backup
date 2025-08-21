# 🚀 Gadain Backend API

> NestJS backend application with Better Auth, Drizzle ORM, and comprehensive development tooling

[![NestJS](https://img.shields.io/badge/NestJS-v11-red?logo=nestjs)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://typescriptlang.org)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-green?logo=drizzle)](https://orm.drizzle.team)
[![Better Auth](https://img.shields.io/badge/Better-Auth-purple)](https://better-auth.com)

## � **Table of Contents**

- [📖 Overview](#-overview)
- [🛠 Tech Stack](#-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [🌱 Environment Setup](#-environment-setup)
- [🐳 Docker Configuration](#-docker-configuration)
- [🏃‍♂️ Development](#️-development)
- [🛠 VSCode Setup](#-vscode-setup)
- [🚀 API Documentation](#-api-documentation)
- [📁 Project Structure](#-project-structure)
- [🪝 Git Hooks & Code Quality](#-git-hooks--code-quality)
- [🚨 Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📚 Additional Resources](#-additional-resources)

## 📖 **Overview**

A comprehensive NestJS backend application featuring:
- **Authentication**: Better Auth with SSO support (Google OAuth)
- **Database**: PostgreSQL with Drizzle ORM
- **Code Quality**: Automated formatting, linting, and git hooks
- **Documentation**: Swagger UI and Scalar API Reference
- **Development**: Docker containerization and VSCode workspace

## 🛠 **Tech Stack**

| Category | Technology |
|----------|------------|
| **Framework** | NestJS v11 |
| **Language** | TypeScript 5.7 |
| **Database** | PostgreSQL + Drizzle ORM |
| **Authentication** | Better Auth |
| **Code Quality** | Biome (formatter + linter) |
| **Git Hooks** | Lefthook |
| **Package Manager** | pnpm |
| **Containerization** | Docker + Docker Compose |

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

## 🛠 **VSCode Setup**

### **Recommended Extensions**
When you open the project in VSCode, you'll be prompted to install recommended extensions:

- **Biome** (`biomejs.biome`) - Code formatting and linting
- **TypeScript** (`ms-vscode.vscode-typescript-next`) - Enhanced TypeScript support
- **Path Intellisense** (`christian-kohler.path-intellisense`) - File path autocomplete

### **Without Biome Extension**
If you don't have the Biome extension installed:

#### **Manual Formatting**
```bash
# Format all code
pnpm format
```

#### **VSCode Tasks**
Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux) and run:
- **"Tasks: Run Task"** → **"Format Code (Biome)"**
- **"Tasks: Run Task"** → **"Lint & Fix (Biome)"**

Or use the keyboard shortcuts listed below ⬇️

#### **Keyboard Shortcuts**
The workspace includes pre-configured shortcuts:
```json
Cmd+Alt+F → Format Code (Biome)
Cmd+Alt+L → Lint & Fix (Biome)
Cmd+Alt+T → Run Tests
Cmd+Alt+D → Start Dev Server
```

Or manually add to your VSCode `keybindings.json`:
```json
[
  {
    "key": "cmd+alt+f",
    "command": "workbench.action.tasks.runTask",
    "args": "Format Code (Biome)"
  }
]
```

### **Pre-commit Hooks**
Even without the extension, code will be auto-formatted on commit via git hooks.

## 🌱 **Environment Setup**

### **Environment Variables**

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

## 🐳 **Docker Configuration**

### **Docker Services & Management**

```bash
# Start all services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Check service status
docker compose ps

# Reset all data (⚠️ Destructive)
docker compose down -v
```

**Available Services:**
- **PostgreSQL**: Database server on port 5432
- **Redis**: Cache/session store on port 6379
- **Networks**: Custom `gadain-network` bridge
- **Volumes**: Persistent data storage for both services

### **Health Checks**

Both services include health monitoring:
```bash
# Check specific service health
docker compose exec postgres pg_isready -U gadain_user -d gadain_db
docker compose exec redis redis-cli ping
```

## 🏃‍♂️ **Development**

### **Running the Application**

```bash
# Development mode (with hot reload)
pnpm start:dev

# Production mode
pnpm build
pnpm start

# Debug mode
pnpm start:debug
```

### **Available Scripts**

#### **Core Development**
```bash
pnpm start:dev              # Start in watch mode
pnpm build                  # Build for production
pnpm format                 # Format code with Biome
pnpm test                   # Run tests
pnpm test:watch             # Run tests in watch mode
pnpm test:cov               # Run with coverage
pnpm test:e2e               # Run e2e tests
```

#### **Database Management**
```bash
pnpm db:generate             # Generate migrations
pnpm db:migrate             # Run migrations
pnpm db:push                # Push schema to DB (dev only)
pnpm db:studio              # Open Drizzle Studio
```

#### **Git Hooks**
```bash
pnpm hooks:install          # Install git hooks
pnpm hooks:uninstall        # Remove git hooks
```

## 🪝 **Git Hooks & Code Quality**

### **Automated Git Hooks**

Pre-configured hooks for code quality:
- **pre-commit**: Biome check with auto-fix (JS, TS, JSON files)
- **commit-msg**: Conventional commits validation
- **pre-push**: Build verification

### **Commit Message Format**

Use conventional commits for consistency:

```bash
# ✅ Valid formats
feat: add new authentication module
fix: resolve database connection issue
docs: update API documentation
chore: update dependencies

# ❌ Invalid formats
"add new feature"           # No type
"Fix Bug"                   # Wrong case
"WIP"                       # Non-descriptive
```

**Commit Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

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

The application provides comprehensive API documentation with multiple interfaces:

### **📚 Available Documentation Endpoints**

#### **1. 🔵 Swagger UI - Main API**
- **URL**: `http://localhost:3000/docs/swagger`
- **Purpose**: Complete API documentation for the loan management platform
- **Features**: Interactive API testing, request/response examples
- **Title**: "Gadain Financial API"
- **Description**: "Comprehensive loan management platform"

#### **2. 🔐 Scalar API Reference - Auth System**
- **URL**: `http://localhost:3000/docs/auth`
- **Purpose**: Better Auth system documentation
- **Features**: Beautiful UI with "bluePlanet" theme
- **Content**: Auto-generated from Better Auth OpenAPI schema

#### **3. 🏥 Health Check**
- **URL**: `http://localhost:3000/health`
- **Purpose**: Application health monitoring

#### **4. 🗄️ Database Studio**
- **Command**: `pnpm db:studio`
- **Purpose**: Visual database management interface

### **🛠 Documentation Setup**

The documentation is automatically configured via `src/lib/docs.ts`:

```typescript
// Swagger for main API
SwaggerModule.setup('docs/swagger', app, document);

// Scalar for auth documentation
app.use('/docs/auth', apiReference({
  content: documentAuth,
  theme: 'bluePlanet',
}));
```

### **📖 Documentation Structure**

| Documentation | Technology | Use Case |
|---------------|------------|----------|
| **Swagger UI** | `@nestjs/swagger` | Main API endpoints |
| **Scalar Reference** | `@scalar/nestjs-api-reference` | Authentication system |
| **OpenAPI Schema** | Better Auth | Auto-generated auth docs |

### **🔧 Customization**

To modify documentation:

1. **Main API**: Update `DocumentBuilder` configuration in `docs.ts`
2. **Auth Docs**: Better Auth auto-generates from your auth configuration
3. **Theme**: Change Scalar theme in `apiReference()` options

### **📱 Access URLs**

Once `pnpm start:dev` is running, visit:
- **Main API Docs**: http://localhost:3000/docs/swagger
- **Auth API Docs**: http://localhost:3000/docs/auth
- **Health Check**: http://localhost:3000/health

## 🚨 **Troubleshooting**

### **Common Issues & Solutions**

#### **Git Hooks Issues**
```bash
pnpm hooks:install          # Re-install hooks
npx lefthook version        # Check status
```

#### **Build/Format Issues**
```bash
pnpm format                 # Fix formatting
pnpm build                  # Check build errors
```

#### **Database Connection Issues**
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

#### **Port Conflicts**
```bash
# Check what's using ports
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # Application

# Change ports in .env if needed
POSTGRES_PORT="5433"
REDIS_PORT="6380"
```

#### **Permission Issues (macOS/Linux)**
```bash
# Fix node_modules permissions
chmod -R 755 node_modules

# Fix git hooks permissions
chmod +x .lefthook/pre-commit/*
```

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/amazing-feature`
3. **Make** your changes following the code style guidelines
4. **Commit** using conventional format: `git commit -m "feat: add amazing feature"`
5. **Push** to the branch: `git push origin feat/amazing-feature`
6. **Open** a Pull Request with detailed description

### **Development Guidelines**

- Follow TypeScript and NestJS best practices
- Write tests for new features
- Update documentation when needed
- Use conventional commit messages
- Ensure all hooks pass before pushing

## 📚 **Additional Resources**

### **Framework Documentation**
- [NestJS Documentation](https://docs.nestjs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Better Auth Documentation](https://www.better-auth.com/)

### **Development Tools**
- [Biome Formatter](https://biomejs.dev/)
- [Lefthook Git Hooks](https://evilmartians.com/chronicles/lefthook-knock-your-teams-code-back-into-shape)
- [Conventional Commits](https://www.conventionalcommits.org/)

### **VSCode Extensions**
- [Biome Extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
- [TypeScript Hero](https://marketplace.visualstudio.com/items?itemName=rbbit.typescript-hero)
- [Thunder Client](https://marketplace.visualstudio.com/items?itemName=rangav.vscode-thunder-client)

---

**Made with ❤️ by the Gadain Team • Happy coding! 🎉**
