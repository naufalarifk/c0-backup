# CryptoGadai Backend

Scope of `cg-backend` repository includes all backend api and workers.

## Overview

- `src/entrypoints/` contains the main application bootstrap and configuration
- `src/modules/` contains feature modules (auth, users, wallets, blockchains)
- `src/shared/repositories/` contains the repository pattern implementations with PostgreSQL and in-memory versions
- `src/shared/repositories/postgres/` contains raw SQL files for database operations
- `src/shared/repositories/README.md` provides detailed guidelines on working with the repository pattern
- `test/` contains end-to-end test suites with TestContainers for isolated testing
- `test/README.md` provides instructions for running and writing e2e tests

## Development

### Development Environment

cg-backend has multiple ways to setup the environment

#### Minimum Setup (Recommended)

- Minimum setup uses script to automatically run the backend server locally with in-memory postgres database.
- Minimum setup uses mock minio server.
- Minimum setup script will assign random ports so you can run multiple instances of the server.
- Minimum setup is similar to E2E test environment.

Required system dependencies:
- Git: provides `git` command
- NodeJS v22+: provides `node` and `pnpm` commands
- Redis Server: provides `redis-server` command
- Mailpit: provides `mailpit` command

Command to run the minimum setup: `./scripts/run-test-server.sh`

#### Manual Setup

- Manual setup uses default `docker-compose.yml` to setup the environment such as postgres, redis, mailpit, and minio.
- Manual setup requires proper `.env` file to run the server.
- Manual setup uses default script `pnpm start` or `pnpm start:dev` to run the server.

#### Testing Deployment Setup

Testing Deployment setup uses `docker-compose.testing.yml` to run complete services:
- Traefik as the main reverse proxy to expose cryptogadai services
- All dependencies such as postgres, redis, mailpit, and minio
- All backend services such as api server and workers
- Telemetry services such as Prometheus, Grafana, and Loki

This is the closest setup to production environment.

### Code Quality

This project forbid the usage of `any` type in TypeScript. Follow the `typeshaper` guidelines.

To maintain code quality, we use Biome for linting and formatting, and Lefthook for git hooks.
- `pnpm format`: auto-formats the codebase using Biome.

## Project

### Specifications

- `docs/SRS-CG-v2.4-EN.md`: Software Requirement Specification document. The main source of truth for the project requirements.
- `docs/api-plan/*-openapi.yaml`: The OpenAPI specifications for the backend to implement.
- `docs/ui-descriptions/*.md`: The UI design transalated to textual descriptions. Useful for understanding UI/UX in text form.