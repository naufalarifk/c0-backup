# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Commands

### Development
```bash
pnpm start:dev              # Start development server with hot reload
pnpm build                  # Build for production  
pnpm format                 # Format code with Biome
pnpm test                   # Run unit tests
pnpm test:watch             # Run tests in watch mode
pnpm test:cov               # Run tests with coverage
pnpm test:e2e               # Run end-to-end tests
pnpm test:repo              # Run repository-specific tests with tsx
```

### Database Operations (Deprecated, we use Repository Module)
```bash
pnpm db:generate            # Generate Drizzle migrations
pnpm db:migrate             # Run migrations
pnpm db:push                # Push schema to database (development only)
pnpm db:studio              # Open Drizzle Studio GUI
```

### Code Quality
```bash
pnpm format                 # Auto-format with Biome
pnpm hooks:install          # Install git hooks
```

## Architecture Overview

### Framework & Core Technologies
- **Framework**: NestJS v11 with TypeScript 5.7
- **Database**: PostgreSQL with Drizzle ORM (snake_case convention) (Deprecated, we use Repository Module)
- **Authentication**: Better Auth with SSO support (Google OAuth)
- **Queue System**: BullMQ with Redis
- **API Documentation**: Swagger UI + Scalar API Reference
- **Code Quality**: Biome (linting/formatting), Lefthook (git hooks)

### Module Structure
```
src/
├── modules/                 # Feature modules
│   ├── auth/               # Better Auth integration
│   ├── blockchains/        # Blockchain operations
│   ├── users/              # User management + KYC
│   └── wallets/            # HD wallet management
├── shared/                 # Shared infrastructure
│   ├── database/           # Drizzle schema & migrations (Deprecated, we use Repository Module)
│   ├── repositories/       # Data access layer with test suites
│   ├── services/           # Cross-cutting services
│   ├── filters/            # Global exception handling
│   └── interceptors/       # Global interceptors
└── main.ts                 # Application bootstrap
```

### Repository Pattern
The codebase uses a sophisticated repository pattern with:
- **Base repositories** with comprehensive test suites
- **Domain-specific repositories** (user, finance, cryptogadai)
- **PostgreSQL implementations** with SQL files in `postgres/` directories
- **In-memory implementations** for testing

### Key Architectural Patterns
- **Modular design**: Feature modules with clear boundaries
- **Dependency injection**: Heavy use of NestJS DI container
- **Configuration**: Environment-based with AppConfigService
- **Security**: Helmet, CORS, throttling, and authentication guards
- **Error handling**: Global exception filters
- **Validation**: Class-validator with custom validation options

### Database Schema Organization
- **Auth schema**: Better Auth tables (accounts, sessions, users, etc.)
- **Business schema**: Application-specific entities
- **Migration strategy**: Drizzle Kit with strict mode enabled (Deprecated, we use Repository Module auto migrate)
- **SQL organization**: Raw SQL files in `repositories/postgres/`

### Testing Strategy
- **Unit tests**: `.spec.ts` files with Jest
- **Repository tests**: Dedicated test suites with shared patterns
- **E2E tests**: TestContainers for PostgreSQL/Redis
- **Test environment**: Isolated with mocked dependencies

### Development Workflow
1. **Code formatting**: Biome handles linting and formatting
2. **Git hooks**: Pre-commit (format/lint), commit-msg (conventional commits), pre-push (build)
3. **Development server**: SWC compilation for fast rebuilds
4. **Database workflow**: Schema-first with Drizzle migrations (Deprecated, we use Repository Module)

### Security Considerations
- **Authentication**: Better Auth with session management
- **Authorization**: NestJS guards and decorators
- **Rate limiting**: Global throttling configuration
- **Input validation**: Class-validator with transformation
- **Security headers**: Helmet configuration with CSP

### Documentation
- **API docs**: Available at `/docs/swagger` (Swagger UI) and `/docs/auth` (Scalar)
- **Health check**: Available at `/health`
- **Database UI**: Drizzle Studio via `pnpm db:studio` (Deprecated, we use Repository Module)

### Configuration Management
- Environment files: `.env` and `.env.docker`
- Configuration service: Centralized with AppConfigService
- Validation: Runtime validation of environment variables