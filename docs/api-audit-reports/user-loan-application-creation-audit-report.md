# API Audit Report: User Loan Application Creation Flow

**Date:** 2025-09-22
**Auditor:** Claude Code
**Source of Truth:** `docs/ui-descriptions/user-loan-application-creation.md`
**API Files Audited:**
- `docs/api-plan/loan-market-openapi.yaml`
- `docs/api-plan/user-openapi.yaml`
- `docs/api-plan/better-auth.yaml`
- `docs/api-plan/finance-openapi.yaml`

## Executive Summary

This audit compares the 5-page user loan application creation UI flow against the corresponding API specifications. Multiple critical discrepancies were identified that would prevent successful implementation of the described user interface. The API specifications lack essential fields, validation constraints, and response structures required by the UI flow.

## Critical Discrepancies Found

### 1. Loan Calculation Endpoint (`/loan-applications/calculate`)

**Location:** `loan-market-openapi.yaml:169-199`

#### Missing Required Fields
- **`loanTerm`**: UI requires loan term selection (7, 14, 30, 60, 90 days) but API schema lacks this field
- **`ltvRatio`**: UI allows LTV selection (40-80%) but API schema doesn't include this parameter
- **`interestRate`**: UI displays interest rates but API response doesn't provide this data

#### Incorrect Field Usage
- **`collateralAmount`**: API treats this as input, but UI specifies it should be auto-calculated based on loan amount and LTV ratio

#### Missing Validation Constraints
```yaml
# Current API schema lacks validation
loanAmount:
  type: number
  format: double

# Should include SRS-mandated constraints:
loanAmount:
  type: number
  format: double
  minimum: 100
  maximum: 10000
  description: "Loan amount in USDT, min $100, max $10,000"
```

### 2. Missing Response Fields in Calculation

**Location:** `loan-market-openapi.yaml:200-220`

#### Critical Missing Fields
- **`totalRepaymentAmount`**: UI Page 2 requires displaying total repayment but API doesn't provide this
- **`originationFee`**: SRS specifies 3% origination fee but not included in API response
- **`effectiveInterestRate`**: UI needs to display calculated interest rate
- **`liquidationThreshold`**: UI should show when collateral might be liquidated

### 3. Loan Application Creation Schema Issues

**Location:** `loan-market-openapi.yaml:243-268`

#### Undefined Schema Reference
```yaml
# Current problematic reference
requestBody:
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/LoanApplicationRequest'  # UNDEFINED SCHEMA
```

#### Missing Implementation
- No definition found for `LoanApplicationRequest` schema
- No clear mapping from calculation response to application creation request
- Missing collateral deposit workflow integration

### 4. Authentication Flow Gaps

**Location:** `better-auth.yaml` vs UI requirements

#### Missing User Type Validation
- UI requires different flows for Individual vs Institution users
- API lacks user type checking before loan application
- Missing KYC status validation integration

### 5. Collateral Management Integration

**Location:** Missing from `loan-market-openapi.yaml`

#### Critical Missing Features
- No collateral deposit confirmation endpoints
- Missing blockchain transaction status tracking
- No collateral valuation update mechanisms
- Missing collateral address generation for deposits

## Detailed Fix Recommendations

### Fix 1: Update Loan Calculation Request Schema

**File:** `loan-market-openapi.yaml`
**Location:** Lines 169-199

```yaml
LoanCalculationRequest:
  type: object
  required:
    - loanAmount
    - collateralType
    - ltvRatio
    - loanTerm
  properties:
    loanAmount:
      type: number
      format: double
      minimum: 100
      maximum: 10000
      description: "Desired loan amount in USDT"
    collateralType:
      type: string
      enum: [BTC, ETH, BNB, SOL]
      description: "Type of cryptocurrency collateral"
    ltvRatio:
      type: number
      format: double
      minimum: 0.4
      maximum: 0.8
      description: "Loan-to-Value ratio (40-80%)"
    loanTerm:
      type: integer
      enum: [7, 14, 30, 60, 90]
      description: "Loan term in days"
```

### Fix 2: Enhance Loan Calculation Response Schema

**File:** `loan-market-openapi.yaml`
**Location:** Lines 200-220

```yaml
LoanCalculationResponse:
  type: object
  properties:
    loanAmount:
      type: number
      format: double
    collateralAmount:
      type: number
      format: double
      description: "Required collateral amount (auto-calculated)"
    collateralType:
      type: string
      enum: [BTC, ETH, BNB, SOL]
    ltvRatio:
      type: number
      format: double
    loanTerm:
      type: integer
    interestRate:
      type: number
      format: double
      description: "Annual interest rate as decimal"
    originationFee:
      type: number
      format: double
      description: "Origination fee amount (3% of loan)"
    totalRepaymentAmount:
      type: number
      format: double
      description: "Total amount to be repaid (loan + interest + fees)"
    liquidationThreshold:
      type: number
      format: double
      description: "Collateral value threshold for liquidation"
    estimatedLiquidationPrice:
      type: number
      format: double
      description: "Estimated collateral price that triggers liquidation"
```

### Fix 3: Define Missing LoanApplicationRequest Schema

**File:** `loan-market-openapi.yaml`
**Location:** Add to components/schemas section

```yaml
LoanApplicationRequest:
  type: object
  required:
    - calculationId
    - acceptedTerms
  properties:
    calculationId:
      type: string
      description: "ID from previous loan calculation"
    acceptedTerms:
      type: boolean
      description: "User acceptance of loan terms"
    notes:
      type: string
      maxLength: 500
      description: "Optional notes from borrower"
```

### Fix 4: Add Collateral Deposit Endpoints

**File:** `loan-market-openapi.yaml`
**Location:** Add new endpoints section

```yaml
/loan-applications/{id}/collateral-address:
  get:
    summary: Get collateral deposit address
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    responses:
      '200':
        description: Collateral deposit address generated
        content:
          application/json:
            schema:
              type: object
              properties:
                depositAddress:
                  type: string
                  description: "Blockchain address for collateral deposit"
                collateralType:
                  type: string
                requiredAmount:
                  type: number
                  format: double
                expiresAt:
                  type: string
                  format: date-time

/loan-applications/{id}/collateral-status:
  get:
    summary: Check collateral deposit status
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    responses:
      '200':
        description: Collateral deposit status
        content:
          application/json:
            schema:
              type: object
              properties:
                status:
                  type: string
                  enum: [pending, confirmed, insufficient, expired]
                receivedAmount:
                  type: number
                  format: double
                confirmations:
                  type: integer
                transactionHash:
                  type: string
```

### Fix 5: Add User Type Validation

**File:** `loan-market-openapi.yaml`
**Location:** Update security requirements

```yaml
# Add to loan calculation and application endpoints
security:
  - bearerAuth: []
  - apiKeyCookie: []
# Add validation logic to check:
# - User type (Individual/Institution)
# - KYC status
# - Account standing
```

## Business Logic Discrepancies

### Interest Rate Calculation
- **SRS Reference:** Section 4.2.3 states interest rates vary by collateral type and LTV
- **Issue:** API lacks interest rate calculation logic
- **Fix:** Implement dynamic interest rate calculation based on SRS formulas

### Fee Structure
- **SRS Reference:** 3% origination fee mandated
- **Issue:** Fee structure not reflected in API responses
- **Fix:** Include all fee breakdowns in calculation responses

### Liquidation Logic
- **SRS Reference:** Section 4.3 defines liquidation thresholds
- **Issue:** API lacks liquidation threshold calculations
- **Fix:** Include liquidation warnings and thresholds in all responses

## Integration Requirements

### Better Auth Integration
- Loan endpoints must validate authentication via Better Auth
- Session management for multi-step loan application process
- User context preservation across loan application pages

### Finance Module Integration
- Currency exchange rate validation for collateral pricing
- Account balance verification before loan disbursement
- Integration with withdrawal system for loan funds

### Blockchain Integration
- Real-time collateral price feeds
- Blockchain transaction monitoring
- Smart contract integration for collateral management

## Testing Recommendations

### API Contract Testing
1. Validate all new schema definitions against UI requirements
2. Test calculation accuracy against SRS business rules
3. Verify integration between calculation and application creation

### End-to-End Testing
1. Complete UI flow testing with updated API
2. Collateral deposit workflow validation
3. Multi-user type scenario testing

### Error Handling
1. Implement proper error responses for all validation failures
2. Add timeout handling for blockchain operations
3. Graceful degradation for external service failures

## Priority Classification

### Critical (Blocking)
- Missing `loanTerm` and `ltvRatio` fields
- Undefined `LoanApplicationRequest` schema
- Missing collateral deposit workflow

### High Priority
- Missing calculation response fields
- Interest rate calculation logic
- User type validation

### Medium Priority
- Enhanced error handling
- Additional validation constraints
- Improved documentation

## Conclusion

The current API specifications are insufficient to support the described UI loan application creation flow. Implementation of the UI as specified would fail due to missing required fields, undefined schemas, and lack of critical business logic. All recommended fixes should be implemented before UI development begins to ensure successful integration.

**Estimated Fix Effort:** 2-3 development cycles
**Risk Level:** High - UI cannot be implemented without API fixes
**Recommendation:** Complete API specification updates before frontend development