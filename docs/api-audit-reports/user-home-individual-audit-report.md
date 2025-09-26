# User Home Individual - API Audit Report

**Audit Date**: 2025-09-23
**Scope**: Individual user home interface UI vs API documentation alignment
**Source of Truth**: `docs/ui-descriptions/user-home-individual.md`
**API Documentation Reviewed**:
- `docs/api-plan/better-auth.yaml`
- `docs/api-plan/user-openapi.yaml`
- `docs/api-plan/finance-openapi.yaml`
- `docs/api-plan/loan-market-openapi.yaml`
- `docs/api-plan/loan-agreement-openapi.yaml`

## Executive Summary

This audit identifies **15 critical discrepancies** between the individual user home interface requirements and the current API documentation. The main gaps involve portfolio analytics, payment alerts, loan tracking, news management, and comprehensive notification systems.

## Discrepancies Found

### D01: Portfolio Analytics and Financial Overview Missing

**Severity**: HIGH
**Description**: The UI displays comprehensive portfolio analytics that are not supported by any API endpoint.

**UI Requirements**:
- Portfolio total value: "127,856.43 USDT" with lock icon
- Interest growth: "+17.98% USDT" in green
- Active loans count: "125"
- Date-specific portfolio data: "July 2025"

**API Gap**: No portfolio analytics endpoint exists to provide:
- Total portfolio valuation across all assets
- Portfolio performance metrics (interest/gains)
- Active loan count aggregation
- Historical portfolio data by date

**Example Scenario**:
```
UI displays: "My Portfolio - July 2025: 127,856.43 USDT, +17.98% USDT, 125 Active Loans"
API Reality: No endpoint to calculate or retrieve this aggregated portfolio data
```

**Required API Addition**:
- `GET /portfolio/analytics` endpoint with portfolio breakdown, performance metrics, and loan summaries

### D02: Payment Due Alerts System Missing

**Severity**: CRITICAL
**Description**: The UI shows urgent payment alerts that require specific loan payment tracking not available in APIs.

**UI Requirements**:
- "Payment due in 3 days" alert
- Specific payment amount: "10,000 USDT"
- Collateral at risk: "5 ETH Collateral"
- Automatic liquidation warning
- "Repay Now" action button

**API Gap**: Current loan APIs don't provide:
- Payment due date calculations
- Payment amount breakdowns
- Liquidation risk warnings
- Payment alert generation

**Example Scenario**:
```
UI Alert: "Payment due in 3 days - Pay 10,000 USDT to avoid automatic liquidation of your 5 ETH Collateral"
API Reality: /loans/{id} doesn't include payment due dates, liquidation warnings, or payment breakdown
```

**Required API Addition**:
- Enhanced loan response with `paymentDueDate`, `paymentAmount`, `liquidationRisk` fields
- `GET /loans/payment-alerts` endpoint for upcoming payment warnings

### D03: Verification Status Alerts Missing

**Severity**: HIGH
**Description**: The UI displays multiple verification prompts that require verification status checking not fully supported.

**UI Requirements**:
- General verification status card: "Complete your verification to unlock features"
- Phone verification card: "Complete your verification to unlock features"
- "Verify Now" action buttons

**API Gap**: User profile API lacks:
- Granular verification status breakdown
- Feature unlock status based on verification level
- Phone verification status separate from KYC

**Example Scenario**:
```
UI Display: Two separate verification cards - one general, one phone-specific
API Reality: User profile only shows kycStatus, no phone verification or feature unlock mapping
```

**Required API Enhancement**:
- Add `phoneNumberVerified`, `featureUnlockStatus`, `requiredVerifications` to user profile response

### D05: Comprehensive Notification System Incomplete

**Severity**: HIGH
**Description**: The UI shows detailed notification categorization and management beyond current API scope.

**UI Requirements**:
- Notification filtering by: All, Loans, Security, Payments
- Detailed notification types:
  - Loan application matching
  - Payment confirmations
  - Security/login alerts
  - KYC completion
  - Withdrawal processing
- "Mark All Read" functionality
- Notification archiving and deletion
- Detailed notification views with loan terms

**API Gap**: Current notification API limitations:
- Missing notification management actions (archive, delete)
- Limited notification detail responses
- No bulk operations (mark all read)
- Missing notification-specific data (loan terms, lender info)

**Example Scenario**:
```
UI Notification: "Loan application matched - Your BTC collateral loan request has been matched with an institutional lender at 7.2% APR"
With details: "$15,000 USDT, 0.5 BTC, 7.2% APR, 12 months, CryptoBank Institutional, 4.8  Rating"
API Reality: Notification content is basic text without structured loan/lender data
```

**Required API Enhancement**:
- Add notification management endpoints (archive, delete, mark all read)
- Enhance notification responses with structured data for different types

### D08: Detailed Loan Information in Notifications Missing

**Severity**: HIGH
**Description**: Notification details show comprehensive loan and lender information not available in current APIs.

**UI Requirements**:
- Loan details within notifications: amount, collateral, interest rate, terms
- Lender information: name, verification status, rating
- Time-sensitive offers: "24 hours to accept"
- Action buttons: "View Full Terms"

**API Gap**: Notification detail responses lack:
- Embedded loan offer details
- Lender profile information
- Offer expiration handling
- Action links for loan acceptance

**Example Scenario**:
```
UI Notification Detail: Shows loan ($15,000 USDT, 0.5 BTC, 7.2% APR, 12 months) + lender (CryptoBank Institutional, Verified, 4.8) + "24 hours to accept"
API Reality: Basic notification text without structured loan/lender data
```

**Required API Enhancement**:
- Enhance notification detail responses with embedded loan and lender data

### D09: Error State Context Missing

**Severity**: MEDIUM
**Description**: The UI shows contextual error states that require additional API error handling.

**UI Requirements**:
- Camera permission requests for KYC
- Connection failed with retry mechanisms
- Maintenance mode with progress updates
- Error codes for support: "#500-SERVER"

**API Gap**: APIs lack:
- Permission requirement endpoints
- Maintenance status API
- Detailed error codes in responses
- Support contact integration

**Example Scenario**:
```
UI Error: "Under Maintenance - Expected Terms: 2 hours, Started at 02:00 UTC, Latest Update: 15:30 UTC: Database optimization in progress"
API Reality: No maintenance status or progress update endpoints
```

**Required API Addition**:
- `GET /system/status` for maintenance and system status
- Enhanced error responses with support-friendly error codes

### D11: User Profile Enhancement for UI Context

**Severity**: MEDIUM
**Description**: The UI header and context require additional user profile information.

**UI Requirements**:
- User profile picture display
- Verification badge/status indicators
- User type context for interface customization

**API Gap**: User profile response may lack:
- Profile picture URLs
- Display-ready verification status
- UI customization flags

**Example Scenario**:
```
UI Header: Shows user avatar, verification badges, personalized interface
API Reality: Basic user profile without UI-specific formatting or display preferences
```

**Required API Enhancement**:
- Add UI-specific fields to user profile response
