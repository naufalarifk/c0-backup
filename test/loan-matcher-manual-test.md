# Loan Matcher Manual Test Guide

This guide provides step-by-step instructions for manually testing the loan matcher implementation.

## Prerequisites

1. Backend server running (either via `pnpm start:dev` or test server)
2. Admin user account with authentication token
3. API testing tool (curl, Postman, or HTTPie)

## Test Endpoints

### 1. Test Controller (No Auth Required)

**Endpoint:** `POST /api/test/loan-matcher/trigger-matching`

**Purpose:** Test endpoint for E2E testing without authentication

**Request:**
```bash
curl -X POST http://localhost:3000/api/test/loan-matcher/trigger-matching \
  -H "Content-Type: application/json" \
  -d '{
    "matchedDate": "2025-10-16T13:00:00.000Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Loan matching triggered successfully",
  "matchedDate": "2025-10-16T13:00:00.000Z",
  "summary": {
    "processedApplications": 0,
    "processedOffers": 0,
    "matchedPairs": 0,
    "errorCount": 0,
    "hasMore": false
  },
  "matchedLoans": []
}
```

### 2. Admin Trigger (Admin Auth Required)

**Endpoint:** `POST /api/admin/loan-matcher/trigger`

**Purpose:** Manual trigger for admin users

**Request:**
```bash
curl -X POST http://localhost:3000/api/admin/loan-matcher/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "matchedDate": "2025-10-16T13:00:00.000Z"
  }'
```

**Expected Success Response (200):**
```json
{
  "success": true,
  "message": "Loan matching triggered successfully",
  "matchedDate": "2025-10-16T13:00:00.000Z",
  "summary": {
    "processedApplications": 0,
    "processedOffers": 0,
    "matchedPairs": 0,
    "errorCount": 0,
    "hasMore": false
  },
  "matchedLoans": [],
  "triggeredBy": "admin@example.com",
  "triggeredAt": "2025-10-16T13:00:05.123Z"
}
```

**Expected Error Response (401 - No Auth):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Expected Error Response (403 - Non-Admin User):**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

**Expected Error Response (429 - Rate Limit Exceeded):**
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

### 3. Admin Trigger with Criteria (Admin Auth Required)

**Endpoint:** `POST /api/admin/loan-matcher/trigger-with-criteria`

**Purpose:** Manual trigger with specific matching criteria

**Request:**
```bash
curl -X POST http://localhost:3000/api/admin/loan-matcher/trigger-with-criteria \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "asOfDate": "2025-10-16T13:00:00.000Z",
    "borrowerCriteria": {
      "maxInterestRate": 0.08
    },
    "lenderCriteria": {
      "minInterestRate": 0.05,
      "preferInstitutionalLenders": true
    }
  }'
```

**Expected Success Response (200):**
```json
{
  "success": true,
  "message": "Loan matching with criteria triggered successfully",
  "matchedDate": "2025-10-16T13:00:00.000Z",
  "criteria": {
    "borrower": {
      "maxInterestRate": 0.08
    },
    "lender": {
      "minInterestRate": 0.05,
      "preferInstitutionalLenders": true
    }
  },
  "summary": {
    "processedApplications": 0,
    "processedOffers": 0,
    "matchedPairs": 0,
    "errorCount": 0
  },
  "matchedLoans": [],
  "triggeredBy": "admin@example.com",
  "triggeredAt": "2025-10-16T13:00:10.456Z"
}
```

## Test Scenarios

### Scenario 1: Unauthenticated Access

**Test:** Try to access admin endpoints without authentication

**Steps:**
1. Send POST request to `/api/admin/loan-matcher/trigger` without Authorization header
2. Verify response is 401 Unauthorized

**Expected Result:** ✅ 401 Unauthorized

### Scenario 2: Non-Admin User Access

**Test:** Try to access admin endpoints with regular user token

**Steps:**
1. Create a regular (non-admin) user account
2. Get authentication token for regular user
3. Send POST request to `/api/admin/loan-matcher/trigger` with regular user token
4. Verify response is 403 Forbidden

**Expected Result:** ✅ 403 Forbidden

### Scenario 3: Admin User Access

**Test:** Verify admin can trigger matching

**Steps:**
1. Create an admin user account (or use existing admin)
2. Get authentication token for admin user
3. Send POST request to `/api/admin/loan-matcher/trigger` with admin token
4. Verify response is 200 OK with proper structure

**Expected Result:** ✅ 200 OK with matching results

### Scenario 4: Rate Limiting

**Test:** Verify rate limiting works (3 requests per minute)

**Steps:**
1. Send 4 consecutive POST requests to `/api/admin/loan-matcher/trigger` with admin token
2. Verify first 3 succeed with 200 OK
3. Verify 4th request fails with 429 Too Many Requests

**Expected Result:** ✅ First 3 succeed, 4th gets 429

### Scenario 5: Test Endpoint Accessibility

**Test:** Verify test endpoint is accessible without admin role

**Steps:**
1. Send POST request to `/api/test/loan-matcher/trigger-matching` with regular user token (or no auth)
2. Verify response is 200 OK (or 400 if validation fails)

**Expected Result:** ✅ 200 OK (not 401/403)

### Scenario 6: Scheduler Operation

**Test:** Verify cron scheduler runs automatically

**Steps:**
1. Set `LOAN_MATCHER_SCHEDULER_ENABLED=true` in environment
2. Set `LOAN_MATCHER_RUN_ON_INIT=true` for immediate testing
3. Start the server
4. Check logs for "Running initial loan matching on module init"
5. Verify matching executes without errors

**Expected Result:** ✅ Scheduler runs and logs matching results

## Build Verification

```bash
# 1. Verify TypeScript compilation
pnpm build

# Expected: ✅ Successfully compiled: 452+ files with swc

# 2. Verify code formatting
pnpm format

# Expected: ✅ No formatting issues

# 3. Verify linting
pnpm biome check src

# Expected: ✅ No linting errors
```

## Module Structure Verification

```bash
# Verify loan-matcher module structure matches settlement pattern
ls -la src/modules/loan-matcher/services/core/
ls -la src/modules/loan-matcher/services/strategies/
ls -la src/modules/loan-matcher/admin/
ls -la src/modules/loan-matcher/controllers/
ls -la src/modules/loan-matcher/schedulers/

# Expected structure:
# services/
#   core/
#     loan-matcher.service.ts
#     loan-matcher.service.test.ts
#   strategies/
#     loan-matcher-strategy.abstract.ts
#     loan-matcher-strategy.factory.ts
#     enhanced-loan-matcher.strategy.ts
# admin/
#   loan-matcher-admin.module.ts
# controllers/
#   loan-matcher.controller.ts
# schedulers/
#   loan-matcher.scheduler.ts
```

## Consistency Check with Settlement Module

Both modules should follow the same pattern:

```bash
# Compare structures
diff <(ls src/modules/settlement/) <(ls src/modules/loan-matcher/)

# Both should have:
# ✅ admin/ - Admin module with admin-only endpoints
# ✅ controllers/ - Admin controllers
# ✅ schedulers/ - Cron schedulers
# ✅ services/ - Service implementations (core/, strategies/, etc.)
```

## Troubleshooting

### Issue: Redis connection error in tests

**Solution:** Use the test server script or ensure Redis is installed:
```bash
# Windows (via Chocolatey)
choco install redis-64

# Or use the test server script
./scripts/run-test-server.sh pnpm test test/loan-matcher-admin-api.test.ts
```

### Issue: Import errors after reorganization

**Solution:** Verify all import paths are updated:
```bash
# Search for old import patterns
grep -r "from './loan-matcher.service'" src/modules/loan-matcher/
# Should return no results

# Search for new import patterns
grep -r "from './services/core/loan-matcher.service'" src/modules/loan-matcher/
# Should find updated imports
```

### Issue: Build fails with type errors

**Solution:** Run type check and fix errors:
```bash
pnpm build
# Check error messages
# Fix import paths or type definitions
```

## Summary

✅ **Build Status:** Successfully compiled (452+ files)
✅ **Code Quality:** Biome linting passed
✅ **Module Structure:** Matches settlement pattern
✅ **Deprecated Code:** Queue-based code removed
✅ **Admin Endpoints:** Properly authenticated and rate-limited
✅ **Test Endpoints:** Available for E2E testing
✅ **Scheduler:** Configured with cron and manual triggers

The loan matcher implementation is complete and ready for integration testing.
