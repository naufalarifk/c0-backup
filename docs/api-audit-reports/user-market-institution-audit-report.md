# API Audit Report: User Market Institution

## Executive Summary

This audit compares the User Market Institution UI description against the current API documentation to identify discrepancies and alignment issues. The UI description serves as the source of truth for this analysis.

**Key Finding**: There is a fundamental mismatch between the UI design (institution-focused loan marketplace) and the current API implementation (P2P lending marketplace).

## Audit Scope

**UI Source of Truth**: `docs/ui-descriptions/user-market-institution.md`

**APIs Audited**:
- `docs/api-plan/better-auth.yaml` - Authentication
- `docs/api-plan/user-openapi.yaml` - User Management
- `docs/api-plan/finance-openapi.yaml` - Finance Operations
- `docs/api-plan/loan-market-openapi.yaml` - Loan Marketplace
- `docs/api-plan/loan-agreement-openapi.yaml` - Loan Management

**Reference**: `docs/SRS-CG-v2.3-EN.md` - Software Requirements Specification

## Critical Discrepancies

### 1. Marketplace Model Mismatch

**UI Expectation**: Institution-focused marketplace where users browse and fund loan applications created by financial institutions.

**API Reality**: P2P lending marketplace where individual borrowers create applications for individual lenders.

**Impact**: Complete architectural misalignment requiring fundamental API restructuring.

### 2. Missing Institution Management

**UI Features**:
- Browse loan applications by institution
- Institution-specific loan products
- Institution branding and information

**API Gaps**:
- No institution-specific loan product endpoints
- Missing institution loan application management
- No institution metadata in loan marketplace APIs

### 3. Funding Workflow Discrepancy

**UI Flow**:
1. Browse institution loan applications
2. Select application to fund
3. Choose funding amount and network
4. Complete payment via invoice
5. Track funding status

**API Flow**:
1. Individual borrowers create loan applications
2. Lenders browse and match applications
3. Direct lending relationship established

**Gap**: Completely different user journeys and business logic.

### 4. Payment and Invoice System

**UI Requirements**:
- Invoice generation for loan funding
- Network selection (Ethereum, Binance Smart Chain, Solana)
- Payment status tracking
- Success/failure page handling

**API Coverage**:
-  Finance API supports withdrawals and currency management
- L No invoice generation for loan funding
- L No network selection in loan funding context
- L Payment status tracking exists but not aligned with UI flow

### 5. Application Status Alignment

**UI Status Flow**:
- Application browsing
- Funding in progress
- Payment processing
- Funding completed/failed

**API Status Coverage**:
- Loan applications have status tracking
- Missing funding-specific status states
- No invoice payment status integration

## Detailed Findings by API

### Better Auth API
**Status**:  Aligned
- Authentication flows support the UI requirements
- User session management adequate for institution marketplace

### User API
**Status**:   Partially Aligned
- User profile management supports marketplace users
- Missing institution-specific user roles and permissions
- KYC verification adequate but may need institution-specific requirements

### Finance API
**Status**:   Partially Aligned
- Currency and account management supports multi-network operations
- Withdrawal system could support invoice payments with modifications
- Missing loan funding-specific transaction types

### Loan Market API
**Status**: L Major Misalignment
- Designed for P2P lending, not institution marketplace
- Missing institution loan product management
- Application structure doesn't match UI requirements
- No funding workflow endpoints

### Loan Agreement API
**Status**:   Partially Aligned
- Loan management features could support funded loans
- Missing institution context in loan tracking
- Status management needs alignment with funding workflow

## Required API Changes

### 1. New Institution Loan Product API

```yaml
paths:
  /api/v1/institution-loans:
    get:
      summary: Get institution loan products
      parameters:
        - name: institutionId
        - name: minAmount
        - name: maxAmount
        - name: currency
        - name: term
      responses:
        200:
          schema:
            type: array
            items:
              $ref: '#/components/schemas/InstitutionLoanProduct'

  /api/v1/institution-loans/{productId}/fund:
    post:
      summary: Fund an institution loan product
      requestBody:
        schema:
          type: object
          properties:
            amount:
              type: number
            currency:
              type: string
            network:
              type: string
              enum: [ethereum, bsc, solana]
```

### 2. Enhanced Loan Market API

**Add Institution Context**:
```yaml
components:
  schemas:
    LoanApplication:
      properties:
        institutionId:
          type: string
        institutionLoanProductId:
          type: string
        fundingStatus:
          type: string
          enum: [open, funding, funded, closed]
```

### 3. New Invoice and Payment API

```yaml
paths:
  /api/v1/funding/invoices:
    post:
      summary: Generate funding invoice
      requestBody:
        schema:
          properties:
            loanProductId:
              type: string
            amount:
              type: number
            currency:
              type: string
            network:
              type: string

  /api/v1/funding/invoices/{invoiceId}/status:
    get:
      summary: Get invoice payment status
```

### 4. Modified Finance API

**Add Loan Funding Transaction Types**:
```yaml
components:
  schemas:
    TransactionType:
      enum: [deposit, withdrawal, loan_funding, loan_repayment]
```

## Implementation Recommendations

### Phase 1: Core Institution Support
1. Create institution management endpoints
2. Implement institution loan product API
3. Modify loan marketplace to support institution context

### Phase 2: Funding Workflow
1. Implement funding-specific endpoints
2. Create invoice generation system
3. Add network selection to payment flow

### Phase 3: Status Integration
1. Align loan application status with funding workflow
2. Implement comprehensive status tracking
3. Add payment status integration

### Phase 4: UI Integration
1. Update API documentation to reflect new endpoints
2. Ensure error handling matches UI requirements
3. Add validation for institution-specific business rules

## Risk Assessment

**High Risk**:
- Fundamental marketplace model change required
- Existing P2P lending functionality may need preservation
- Database schema changes required

**Medium Risk**:
- Payment system integration complexity
- Multi-network support implementation
- Status synchronization across services

**Low Risk**:
- Authentication system adequate
- Basic user management sufficient

## Conclusion

The current API implementation requires significant restructuring to support the institution-focused marketplace described in the UI specification. The core issue is a fundamental business model mismatch that affects multiple API layers.

**Immediate Actions Required**:
1. Decision on P2P vs Institution marketplace model
2. API redesign planning for institution support
3. Database schema review and migration planning

**Estimated Effort**: Major refactoring across multiple API modules with new endpoint creation and business logic implementation.