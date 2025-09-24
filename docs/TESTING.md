# CG Backend Testing Documentation

This document provides comprehensive information about testing in the CG Backend project, including all test commands, configurations, and expected behaviors.

## Table of Contents

- [Test Structure Overview](#test-structure-overview)
- [Test Types](#test-types)
- [Environment Setup](#environment-setup)
- [Running Tests](#running-tests)
- [Module-Specific Testing](#module-specific-testing)
- [Test Configuration](#test-configuration)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

## Test Structure Overview

```
cg-backend/
├── src/                                 # Source code with unit tests
│   └── modules/
│       ├── pricefeed/
│       │   └── pricefeed.spec.ts       # Unit tests
│       ├── auth/
│       ├── loans/
│       └── notifications/
├── test/                               # Test utilities and e2e tests
│   ├── __mocks__/                      # Jest mocks
│   │   ├── uuid.js                     # UUID v7 compatibility
│   │   ├── parse-duration.js
│   │   └── @scure/                     # Cryptography mocks
│   ├── e2e/                           # End-to-end tests
│   │   ├── pricefeed/
│   │   │   ├── pricefeed.e2e-spec.ts  # Price feed e2e tests
│   │   │   ├── jest-e2e.config.ts     # E2E Jest config
│   │   │   └── README.md              # Module-specific docs
│   │   ├── notifications/              # Notification e2e tests
│   │   └── better-auth.e2e-spec.ts    # Auth e2e tests
│   ├── setup/                          # Test environment setup
│   │   ├── jest-global-setup.ts
│   │   ├── jest-global-teardown.ts
│   │   ├── test-containers.ts          # Docker containers
│   │   └── mail-container.ts
│   ├── utils/                          # Test utilities
│   │   ├── mailpit.helper.ts
│   │   ├── notification-test.helper.ts
│   │   └── test-user.factory.ts
│   └── jest-e2e.ts                     # Main e2e config
├── package.json                        # Test scripts
├── jest.config.js                      # Jest configuration
└── biome.json                          # Code formatting
```

## Test Types

### 1. Unit Tests
- **Location**: Alongside source files (`*.spec.ts`)
- **Purpose**: Test individual components in isolation
- **Scope**: Functions, classes, services
- **Dependencies**: Mocked

### 2. Integration Tests
- **Location**: `src/modules/*/` (some spec files)
- **Purpose**: Test module interactions
- **Scope**: Service-to-service communication
- **Dependencies**: Limited real dependencies

### 3. End-to-End (E2E) Tests
- **Location**: `test/e2e/`
- **Purpose**: Test complete user workflows
- **Scope**: Full application stack
- **Dependencies**: Real services, APIs, databases

## Environment Setup

### Prerequisites

1. **Node.js** (v18+)
2. **pnpm** package manager
3. **Docker** (for containerized tests)
4. **Environment variables** properly configured

### Required Environment Variables

```bash
# .env file
DATABASE_URL=postgresql://user:pass@localhost:5432/testdb
REDIS_URL=redis://localhost:6379
PRICEFEED_API_KEY=your-coinmarketcap-api-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
FCM_SERVER_KEY=your-fcm-key
APNS_KEY_ID=your-apns-key
# ... other required env vars
```

### Test Database Setup

```bash
# Start test containers
docker-compose -f docker-compose.testing.yml up -d

# Push database schema
pnpm db:push

# Verify setup
pnpm test:setup-check
```

## Running Tests

### Quick Commands

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Run tests in watch mode
pnpm test:watch

# Run e2e tests only
pnpm test:e2e

# Debug tests
pnpm test:debug
```

### Detailed Test Commands

#### 1. Unit Tests

```bash
# All unit tests
npx jest --testPathPattern="src/.*\.spec\.ts$"

# Specific module
npx jest src/modules/pricefeed/pricefeed.spec.ts

# With coverage
npx jest --coverage --testPathPattern="src/.*\.spec\.ts$"

# Watch mode
npx jest --watch --testPathPattern="src/.*\.spec\.ts$"
```

**Expected Behavior:**
- Fast execution (< 10 seconds)
- No external dependencies
- Mocked services and APIs
- High code coverage (>80%)

#### 2. E2E Tests

```bash
# All e2e tests
npx jest --config ./test/jest-e2e.ts --runInBand

# Specific e2e test
npx jest --config test/e2e/pricefeed/jest-e2e.config.ts test/e2e/pricefeed/pricefeed.e2e-spec.ts --verbose --forceExit

# With specific pattern
npx jest --config ./test/jest-e2e.ts --testNamePattern="PriceFeed" --runInBand
```

**Expected Behavior:**
- Slower execution (30-120 seconds)
- Real API calls and database operations
- Container startup/teardown
- Network-dependent results

#### 3. Code Quality

```bash
# Format code
pnpm format

# Lint and fix
pnpm biome check --write src

# Check code quality
pnpm biome check src
```

**Expected Behavior:**
- Consistent code formatting
- No linting errors
- TypeScript compilation success

## Module-Specific Testing

### PriceFeed Module

**Unit Tests Location:** `src/modules/pricefeed/pricefeed.spec.ts`
**E2E Tests Location:** `test/e2e/pricefeed/pricefeed.e2e-spec.ts`

```bash
# Unit tests (limited due to dependencies)
npx jest src/modules/pricefeed/pricefeed.spec.ts

# E2E tests (recommended)
npx jest --config test/e2e/pricefeed/jest-e2e.config.ts test/e2e/pricefeed/pricefeed.e2e-spec.ts --verbose --forceExit
```

**Expected Results:**
```
✅ CoinMarketCap API available: true
✅ Bitcoin Exchange Rate: {
  bidPrice: '$117,307',
  askPrice: '$117,424',
  rank: 1,
  marketCap: '$2338.3B'
}
✅ 8/8 tests passed
```

**Test Coverage:**
- API authentication
- Live price fetching (BTC, ETH, ADA)
- Error handling
- Rate limiting
- Real-time data validation

### Notifications Module

**E2E Tests Location:** `test/e2e/notifications/`

```bash
# Email notifications
npx jest test/e2e/notifications/email-notifications.e2e-spec.ts --runInBand

# Push notifications
npx jest test/e2e/notifications/push-notifications.e2e-spec.ts --runInBand

# SMS notifications
npx jest test/e2e/notifications/sms-notifications.e2e-spec.ts --runInBand

# Full notification flow
npx jest test/e2e/notifications/notification-flow.e2e-spec.ts --runInBand
```

**Expected Behavior:**
- Mail container setup/teardown
- Real email delivery testing
- Push notification validation
- SMS sending verification
- Queue processing validation

### Authentication Module

**E2E Tests Location:** `test/e2e/better-auth.e2e-spec.ts`

```bash
# Auth e2e tests
npx jest test/e2e/better-auth.e2e-spec.ts --runInBand
```

**Expected Behavior:**
- User registration flow
- Login/logout functionality
- Session management
- JWT token validation
- Role-based access control

### Loan Applications Module

**E2E Tests Location:** `test/e2e/loan-applications.e2e-spec.ts`

```bash
# Loan e2e tests
npx jest test/e2e/loan-applications.e2e-spec.ts --runInBand
```

**Expected Behavior:**
- Loan application creation
- Approval workflow
- Collateral management
- Payment processing
- Status updates

## Test Configuration

### Main Jest Configuration

**File:** `package.json` (jest section)

```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",
    "moduleNameMapper": {
      "^parse-duration$": "<rootDir>/../test/__mocks__/parse-duration.js",
      "^@scure/bip32$": "<rootDir>/../test/__mocks__/@scure/bip32.js",
      "^@scure/bip39$": "<rootDir>/../test/__mocks__/@scure/bip39.js",
      "^uuid$": "<rootDir>/../test/__mocks__/uuid.js"
    }
  }
}
```

### E2E Jest Configuration

**File:** `test/jest-e2e.ts`

```typescript
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  globalSetup: '<rootDir>/setup/jest-global-setup.ts',
  globalTeardown: '<rootDir>/setup/jest-global-teardown.ts',
  testTimeout: 120000, // 2 minutes
};
```

### Module-Specific Configurations

**PriceFeed E2E Config:** `test/e2e/pricefeed/jest-e2e.config.ts`

```typescript
export default {
  testEnvironment: 'node',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  testTimeout: 60000, // 1 minute for API calls
  moduleNameMapper: {
    '^uuid$': '<rootDir>/test/__mocks__/uuid.js'
  }
};
```

## Troubleshooting

### Common Issues and Solutions

#### 1. UUID v7 Import Errors

**Error:**
```
SyntaxError: Cannot use import statement outside a module
```

**Solution:**
Ensure UUID mock is configured:
```javascript
// test/__mocks__/uuid.js
const { v4: uuidv4 } = require('uuid');
function v7() { return uuidv4(); }
module.exports = { v4: uuidv4, v7 };
```

#### 2. Database Connection Issues

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Start test database
docker-compose -f docker-compose.testing.yml up -d

# Check connection
pnpm db:studio
```

#### 3. API Key Missing

**Error:**
```
Error: PRICEFEED_API_KEY not configured
```

**Solution:**
```bash
# Add to .env file
echo "PRICEFEED_API_KEY=your-api-key-here" >> .env
```

#### 4. Memory Issues with E2E Tests

**Error:**
```
JavaScript heap out of memory
```

**Solution:**
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Run tests with limited concurrency
npx jest --runInBand --forceExit
```

#### 5. Port Conflicts

**Error:**
```
Error: listen EADDRINUSE :::3000
```

**Solution:**
```bash
# Kill processes on port
lsof -ti:3000 | xargs kill -9

# Use different ports in test config
```

### Debug Mode

```bash
# Debug specific test
node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand test/e2e/pricefeed/pricefeed.e2e-spec.ts

# Debug with VS Code
# Add to launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "test/e2e/pricefeed/pricefeed.e2e-spec.ts"],
  "console": "integratedTerminal"
}
```

## Performance Expectations

### Unit Tests
- **Execution Time:** < 10 seconds
- **Memory Usage:** < 200MB
- **CPU Usage:** Low
- **Network:** None (mocked)

### Integration Tests
- **Execution Time:** 10-30 seconds
- **Memory Usage:** 200-500MB
- **CPU Usage:** Medium
- **Network:** Limited (some real calls)

### E2E Tests
- **Execution Time:** 30-120 seconds
- **Memory Usage:** 500MB-1GB
- **CPU Usage:** High
- **Network:** Heavy (real APIs, databases)

### Module-Specific Performance

| Module | Test Type | Duration | Dependencies |
|--------|-----------|----------|-------------|
| PriceFeed | E2E | 10-15s | CoinMarketCap API |
| Notifications | E2E | 30-60s | Mail/SMS services |
| Auth | E2E | 15-30s | Database |
| Loans | E2E | 45-90s | Database, Blockchain |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run unit tests
        run: pnpm test
        
      - name: Run e2e tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
          PRICEFEED_API_KEY: ${{ secrets.PRICEFEED_API_KEY }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

**File:** `lefthook.yml`

```yaml
pre-commit:
  commands:
    format:
      run: pnpm format
    lint:
      run: pnpm biome check --write src
    test:
      run: pnpm test --passWithNoTests
```

## Best Practices

### 1. Test Organization
- Keep unit tests close to source code
- Group e2e tests by feature/module
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Test Data Management
- Use factories for test data creation
- Clean up after each test
- Use transactions for database tests
- Isolate test environments

### 3. Mocking Strategy
- Mock external services in unit tests
- Use real services in e2e tests
- Create reusable mock factories
- Keep mocks simple and focused

### 4. Performance Optimization
- Run unit tests in parallel
- Run e2e tests sequentially (`--runInBand`)
- Use `--forceExit` for hanging processes
- Set appropriate timeouts

### 5. Error Handling
- Test both success and failure cases
- Validate error messages and types
- Test edge cases and boundary conditions
- Use proper TypeScript error typing

## Monitoring and Reporting

### Coverage Reports

```bash
# Generate coverage report
pnpm test:cov

# View HTML report
open coverage/lcov-report/index.html

# Coverage thresholds (jest config)
"coverageThreshold": {
  "global": {
    "branches": 80,
    "functions": 80,
    "lines": 80,
    "statements": 80
  }
}
```

### Test Reports

```bash
# JUnit XML report
npx jest --reporters=default --reporters=jest-junit

# JSON report
npx jest --json --outputFile=test-results.json

# Custom reporters
npx jest --reporters=./custom-reporter.js
```

This comprehensive testing documentation ensures that all team members can effectively run, debug, and maintain the test suite for the CG Backend project.