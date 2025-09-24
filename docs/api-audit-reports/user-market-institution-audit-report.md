# User Market Institution - API Audit Report

## Executive Summary

This audit report identifies discrepancies between the UI textual description for the User Market Institution interface and the existing API documentation. The UI describes a comprehensive loan marketplace where institutions can browse, search, filter, and fund loan applications from borrowers. Several critical API endpoints and data structures are missing or incomplete in the current API specifications.

## Audit Scope

- **UI Source Document**: `docs/ui-descriptions/user-market-institution.md`
- **API Documents Audited**:
  - `docs/api-plan/better-auth.yaml`
  - `docs/api-plan/user-openapi.yaml`
  - `docs/api-plan/finance-openapi.yaml`
  - `docs/api-plan/loan-market-openapi.yaml`
  - `docs/api-plan/loan-agreement-openapi.yaml`

## Discrepancies Found

### D-001: Missing Institution-Specific Loan Application Browse Endpoint

**Issue**: The UI describes a main market view showing loan applications specifically for institutional lenders, but the API lacks an institution-specific browsing endpoint.

**UI Requirement**:
- Page titled "Loan Applications" showing loan application cards
- Each card displays: masked username, "Verified User" badge, requested amount, terms, interest rate, and collateral
- Example: "J*** A*****n", "Verified User", "15,000 USDT", "6 Months", "6.8%", "0.5 BTC"

**Current API Gap**:
- `loan-market-openapi.yaml` has `/loan-applications` endpoint but lacks institution-specific filtering
- Missing ability to fetch applications specifically formatted for institutional lenders
- No masked username format in response schemas

**Data Example Scenario**:
```json
GET /loan-applications?lenderUserType=Institution
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "app_78901",
        "borrower": {
          "maskedUsername": "J*** A*****n",
          "isVerified": true,
          "verificationBadge": "Verified User"
        },
        "requestedAmount": "15000.000000000000000000",
        "termMonths": 6,
        "maxInterestRate": 6.8,
        "collateral": {
          "amount": "0.5",
          "currency": "BTC",
          "displayText": "0.5 BTC"
        }
      }
    ]
  }
}
```

### D-002: Missing Institution Search Functionality

**Issue**: The UI describes searching for specific institutions (e.g., "PT. Bank Central Indonesia"), but the API lacks institution search capabilities.

**UI Requirement**:
- Search input field with institution name queries
- Search results showing institution cards with: bank icon, institution name, "Institutional" badge, available supply, interest rate, and terms
- Example search: "PT. Bank Central Indonesia" returning multiple matches

**Current API Gap**:
- No search endpoint for institutions in any API specification
- Missing institution profile data structure
- No institutional badge or verification status

**Data Example Scenario**:
```json
GET /institutions/search?q=PT.+Bank+Central+Indonesia
{
  "success": true,
  "data": {
    "institutions": [
      {
        "id": "inst_12345",
        "name": "PT. Bank Central Indonesia",
        "type": "Institutional",
        "verificationBadge": "Institutional",
        "availableSupply": "25000.000000000000000000",
        "currency": "USDT",
        "interestRate": 6.8,
        "termOptions": "3-6 Months",
        "icon": "bank_building_symbol"
      }
    ]
  }
}
```

### D-003: Missing Advanced Filtering Modal API

**Issue**: The UI shows a comprehensive filter modal with requested amount range, interest rate range, and terms dropdown, but the API lacks these specific filtering capabilities.

**UI Requirement**:
- Filter by requested amount (min/max range)
- Filter by interest rate percentage (min/max range)
- Filter by terms (dropdown selection)
- Submit and reset filter functionality

**Current API Gap**:
- `loan-market-openapi.yaml` has basic query parameters but missing range filtering
- No structured filter request/response for the modal interface
- Missing terms dropdown options endpoint

**Data Example Scenario**:
```
GET /loan-applications?minRequestedAmount=5000&maxRequestedAmount=20000&minInterestRate=5.0&maxInterestRate=10.0&terms=3,6

Response:
{
  "success": true,
  "data": {
    "applications": [...],
    "appliedFilters": {
      "requestedAmount": {"min": "5000", "max": "20000"},
      "interestRate": {"min": 5.0, "max": 10.0},
      "terms": ["3 Months", "6 Months"]
    }
  }
}
```

### D-004: Missing Loan Application Detail Endpoint for Institutional Funding

**Issue**: The UI describes a detailed "Fund Loan" page with specific data structure, but the API lacks an institution-focused application detail endpoint.

**UI Requirement**:
- Application ID in format "#FUND-8A4B2C"
- Calculated total interest display ("1,020.00 USDT")
- Collateral explanation text with security details
- Network selection for funding
- Estimated collateral value display

**Current API Gap**:
- Missing institution-specific loan application detail endpoint
- No calculated interest display in response
- Missing collateral security explanation text
- No network selection options

**Data Example Scenario**:
```json
GET /loan-applications/app_78901/funding-details
{
  "success": true,
  "data": {
    "applicationId": "#FUND-8A4B2C",
    "borrower": {
      "maskedUsername": "J*** A*****n",
      "isVerified": true
    },
    "summary": {
      "requestedAmount": "15000.000000000000000000",
      "termMonths": 6,
      "interestRatePerMonth": 6.8,
      "calculatedTotalInterest": "1020.000000000000000000"
    },
    "collateral": {
      "amount": "0.5",
      "currency": "BTC",
      "displayText": "0.5 BTC (Bitcoin)",
      "estimatedValue": "17500.000000000000000000",
      "securityExplanation": "The collateral is valued at 70% of the loan amount and is securely held by an independent third-party custodian."
    },
    "networkOptions": [
      {"name": "Bitcoin Network", "validated": true},
      {"name": "Ethereum Network", "validated": true}
    ]
  }
}
```
