# User Loan Module API Audit Report

## Overview
This audit report identifies discrepancies between the UI textual descriptions in `docs/ui-descriptions/user-loan.md` and the API documentation in `docs/api-plan/`. The UI descriptions serve as the source of truth for this audit.

## Executive Summary
The analysis reveals 15 critical discrepancies where the API documentation does not adequately support the UI requirements. Most issues relate to missing data structures, incomplete response schemas, and missing API endpoints required by the loan management interfaces.

## Detailed Discrepancies

### D-001: Missing Loan Application Overview Metrics API
**UI Requirement**: Application Overview Card displays aggregated metrics (Total Applied: 12, Active: 8, Pending: 0, Rejected: 4)
**API Gap**: No dedicated endpoint for loan application overview metrics
**Files**: loan-market-openapi.yaml, loan-agreement-openapi.yaml
**Missing**:
- `/loan-applications/overview` endpoint
- Response schema with aggregated counts by status

**Example Scenario**: When user opens "My Loan Applications" page, the UI needs to display:
```json
{
  "totalApplied": 12,
  "active": 8,
  "pending": 0,
  "rejected": 4,
  "period": "July, 2025"
}
```

### D-002: Missing Loan Offer Overview Metrics API
**UI Requirement**: Loan Offer Overview Card shows financial metrics (Total Funds: 10,000 USDT, Monthly Income: 250 USDT, etc.)
**API Gap**: No endpoint for loan offer financial overview
**Files**: loan-market-openapi.yaml
**Missing**:
- `/loan-offers/overview` endpoint
- Financial metrics aggregation schema

**Example Scenario**: Lender dashboard requires:
```json
{
  "totalFunds": "10000.000000000000000000",
  "monthlyIncome": "250.000000000000000000",
  "totalDisbursement": "5000.000000000000000000",
  "totalAvailable": "5000.000000000000000000",
  "activeLoans": 125
}
```

### D-003: Incomplete Loan Application Card Schema
**UI Requirement**: Application cards show Application ID (#3146), Status Badge, Terms, Interest Rate, Collateral details
**API Gap**: Current `LoanApplicationResponse` missing display formatting fields
**Files**: loan-market-openapi.yaml lines 1111-1174
**Missing**:
- Formatted application ID with hash prefix
- Status badge color coding
- Display-friendly terms formatting

**Example Scenario**: Each card needs:
```json
{
  "displayId": "Loan Application (#3146)",
  "statusBadge": {
    "status": "Published",
    "color": "green"
  },
  "terms": "6 Months",
  "interestRate": "6.8%",
  "collateral": "0.5 BTC"
}
```

### D-004: Missing Progress Indicators for Loan Offers
**UI Requirement**: Offer cards display progress percentages (33%) and progress bars with amount ranges
**API Gap**: No progress tracking fields in `LoanOfferResponse`
**Files**: loan-market-openapi.yaml lines 881-918
**Missing**:
- Progress percentage calculation
- Amount range displays
- Disbursement progress tracking

**Example Scenario**: Offer cards require:
```json
{
  "progressPercentage": 33,
  "amountRange": {
    "min": "2000.000000000000000000",
    "max": "25000.000000000000000000"
  },
  "disbursementProgress": {
    "disbursed": "2000.000000000000000000",
    "total": "25000.000000000000000000"
  }
}
```

### D-006: Missing Collateral Detailed Information API
**UI Requirement**: Collateral section shows Selected Assets, LTV, Collateral Value, Collateral Price, Required amount
**API Gap**: Limited collateral details in current loan responses
**Files**: loan-agreement-openapi.yaml lines 960-1056
**Missing**:
- Current collateral price information
- Detailed LTV breakdown
- Collateral value calculations

**Example Scenario**: Collateral display requires:
```json
{
  "selectedAsset": "ETH",
  "ltvRatio": "70%",
  "collateralValue": "15428.000000000000000000",
  "collateralPrice": "2900.000000000000000000",
  "collateralRequired": "5.32"
}
```

### D-010: Missing Matched Borrowers Details API
**UI Requirement**: Matched Borrowers section with expandable borrower details
**API Gap**: No matched borrowers endpoint with detailed information
**Files**: loan-agreement-openapi.yaml
**Missing**:
- `/loan-offers/{id}/matched-borrowers` endpoint
- Expandable borrower details schema
- Individual borrower loan terms

**Example Scenario**: Matched borrowers need:
```json
{
  "count": 4,
  "borrowers": [
    {
      "id": "B23124",
      "displayName": "Borrower #1",
      "terms": "6 Month",
      "amount": "25000.000000000000000000",
      "collateral": "10 ETH",
      "ltv": "52.8%",
      "dueDate": "2025-02-21T00:00:00Z",
      "status": "Active"
    }
  ]
}
```

### D-011: Missing Balance Information in Repayment
**UI Requirement**: Repayment page shows "Your Balance: 2,000.00 USDT"
**API Gap**: No user balance information in loan repayment context
**Files**: loan-agreement-openapi.yaml, user-openapi.yaml
**Missing**:
- User balance in repayment response
- Balance validation against repayment amount

**Example Scenario**: Repayment display needs:
```json
{
  "totalRepayment": "10600.000000000000000000",
  "userBalance": "2000.000000000000000000",
  "shortfall": "8600.000000000000000000",
  "dueDate": "2025-01-25T00:00:00Z"
}
```

### D-015: Missing Filter and Search Capabilities
**UI Requirement**: Filter modal with status and month selection, search functionality
**API Gap**: Limited filtering parameters in current list endpoints
**Files**: loan-market-openapi.yaml, loan-agreement-openapi.yaml
**Missing**:
- Status filtering for user's own loans
- Month/date range filtering
- Enhanced search capabilities

**Example Scenario**: Filter requirements:
```json
{
  "filters": {
    "status": ["Published", "Active", "Matched"],
    "dateRange": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    },
    "searchTerm": "loan application"
  }
}
```
