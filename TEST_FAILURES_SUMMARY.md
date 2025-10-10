# Test Failures Summary

**Date:** October 10, 2025  
**Total Tests:** 387  
**Passing:** 250  
**Failing:** 24  
**Skipped:** 101  
**Cancelled:** 12  

## Categories of Failures

### 1. Docker/TestContainers Issues (13 failures)

**Files Affected:**
- `dist/modules/indexer/ethereum.listener.test.js`
- `dist/shared/repositories/pg-redis-cryptogadai.repository.test.js`

**Error:**
```
Error: Could not find a working container runtime strategy
```

**Root Cause:** Tests require Docker to run TestContainers for integration testing.

**Solution:** Either:
- Install Docker and ensure it's running
- Skip these tests in CI environments without Docker
- Mock the container dependencies

**Affected Tests:**
- All Ethereum listener tests (7 cancelled + 1 failed)
- Native ETH transaction detection
- ERC20 token detection
- Listener lifecycle
- Repository connection tests (5 tests)

---

### 2. Loan Matcher Tests (9 failures)

**Files Affected:**
- `dist/modules/loan-matcher/loan-matcher.service.test.js`
- `dist/modules/loan-matcher/loan-matcher.integration-simple.test.js`

**Error:**
```
Error: Nest can't resolve dependencies of the LoanMatcherService (CryptogadaiRepository, NotificationQueueService, ?). 
Please make sure that the argument LoanMatcherStrategyFactory at index [2] is available in the RootTestModule context.
```

**Root Cause:** Missing `LoanMatcherStrategyFactory` provider in test module setup.

**Solution:** Add `LoanMatcherStrategyFactory` to the test module providers in both test files.

**Affected Tests:**
- should be defined and instantiable
- should have all required methods
- should handle empty applications and offers gracefully
- should handle repository errors without throwing
- should accept different batch sizes
- should accept lender criteria options
- should accept borrower criteria options
- should accept combined lender and borrower criteria
- should have isInstitutionalLender method available
- All integration tests (6 cancelled)

---

### 3. Indexer Service Tests (3 failures)

**Files Affected:**
- `dist/modules/indexer/btc.service.test.js`
- `dist/modules/indexer/eth.service.test.js`
- `dist/modules/indexer/eth.service.integration.test.js`
- `dist/modules/indexer/sol.service.test.js`

**Error:**
```
'test failed'
```

**Root Cause:** Tests are failing but not providing detailed error messages. Need to investigate each file.

**Solution:** Run individual test files to see detailed error messages.

---

### 4. Invoice Expiration Tests (4 failures)

**Files Affected:**
- `dist/modules/invoice-expiration/invoice-expiration.service.test.js`

**Error:**
```
AssertionError [ERR_ASSERTION]: Should have no errors
2 !== 0
```

**Root Cause:** Service is reporting 2 errors when tests expect 0 errors.

**Affected Tests:**
- should successfully process expired invoices and send notifications
- should handle individual invoice expiration errors (expects 1 error, got 2)
- should handle batch processing correctly
- should handle notification failures gracefully (expects 0 errors, got 1)

**Solution:** Debug the invoice expiration service to understand why extra errors are occurring.

---

### 5. Repository Tests - Loan Application (3 failures)

**Files Affected:**
- `src/shared/repositories/loan-borrower.repository.ts` (line 357)

**Error:**
```
TypeError [Error]: Cannot read properties of undefined (reading '0')
at InMemoryCryptogadaiRepository.borrowerCreatesLoanApplication
```

**Root Cause:** Query returns empty array, but code tries to access `[0]` without checking.

**Location:** `loan-borrower.repository.ts:357`

**Code Issue:**
```typescript
)[0];  // ❌ Accessing [0] without checking if array has elements
```

**Affected Tests:**
- should create loan application with calculated values successfully
- should automatically publish loan application when collateral invoice is paid
- should return loan details for authorized borrower

**Solution:** Add check for empty array or ensure query always returns results:
```typescript
const results = assertArrayMapOf(...);
if (results.length === 0) {
  throw new Error('Loan application creation failed - no data returned');
}
const loanApplication = results[0];
```

---

### 6. Repository Tests - Duplicate Key (1 failure)

**Files Affected:**
- Price feed repository tests

**Error:**
```
error: duplicate key value violates unique constraint "price_feeds_blockchain_key_base_currency_token_id_quote_cur_key"
Key (blockchain_key, base_currency_token_id, quote_currency_token_id, source)=(crosschain, slip44:60, iso4217:usd, binance) already exists.
```

**Affected Tests:**
- should retrieve exchange rates with filters

**Solution:** Clear/reset database state between tests or use unique test data.

---

### 7. Repository Tests - Null Constraint (1 failure)

**Files Affected:**
- Institution application repository tests

**Error:**
```
error: null value in column "ministry_approval_document_path" of relation "institution_applications" violates not-null constraint
```

**Affected Tests:**
- should validate NPWP format on institution application

**Solution:** Provide required field `ministry_approval_document_path` in test data.

---

### 8. Repository Tests - SQL Injection (1 failure)

**Files Affected:**
- Base repository test suite

**Error:**
```
AssertionError [ERR_ASSERTION]: Missing expected rejection: Should throw syntax error due to injection attempt
```

**Affected Tests:**
- should protect against SQL injection in WHERE clauses

**Root Cause:** SQL injection test expects query to fail, but it's not failing (might be properly sanitized already).

**Solution:** Review the SQL injection test - it might be passing for the right reason (queries are protected).

---

## Priority Actions

### High Priority (Blocking Tests)
1. **Fix Repository Array Access** - Affects 3 tests
   - File: `src/shared/repositories/loan-borrower.repository.ts:357`
   - Add array length check before accessing `[0]`

2. **Fix Loan Matcher Dependencies** - Affects 9 tests
   - Add `LoanMatcherStrategyFactory` to test module providers

### Medium Priority (Test Environment)
3. **Invoice Expiration Service** - Affects 4 tests
   - Debug why service reports extra errors

4. **Test Data Issues** - Affects 2 tests
   - Fix duplicate key in price feed tests
   - Add required field in institution application tests

### Low Priority (Environment Specific)
5. **Docker/TestContainers** - Affects 13 tests
   - Document Docker requirement
   - Consider mocking for CI environments

6. **Indexer Service Tests** - Affects 3 tests
   - Run individually to get detailed errors

7. **SQL Injection Test** - Affects 1 test
   - Review if test expectations are correct

---

## Quick Fixes

### 1. Fix Loan Application Array Access

**File:** `src/shared/repositories/loan-borrower.repository.ts`

**Line 357:** Change from:
```typescript
)[0];
```

To:
```typescript
);
if (loanApplication.length === 0) {
  throw new Error('Loan application creation failed - INSERT did not return data');
}
const loanApp = loanApplication[0];
```

### 2. Fix Loan Matcher Test Setup

**Files:** 
- `src/modules/loan-matcher/loan-matcher.service.test.ts`
- `src/modules/loan-matcher/loan-matcher.integration-simple.test.ts`

Add to providers array:
```typescript
{
  provide: LoanMatcherStrategyFactory,
  useValue: {
    createStrategy: () => ({
      // mock implementation
    }),
  },
}
```

---

## Test Execution Recommendation

To work around Docker requirement temporarily:
```bash
# Run tests excluding container-dependent tests
pnpm test --grep -v "Integration Tests|ethereum.listener|pg-redis-cryptogadai"
```

Or run specific test suites:
```bash
# Run only wallet tests
pnpm test src/shared/wallets/wallets/wallets.test.ts

# Run only settlement tests  
pnpm test src/modules/settlement/
```
