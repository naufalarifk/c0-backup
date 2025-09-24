# User Loan Offer Creation - API Audit Report

**Audit Date**: 2025-09-23
**Scope**: User Loan Offer Creation UI Flow
**Source of Truth**: `docs/ui-descriptions/user-loan-offer-creation.md`
**API Documentation Reviewed**:
- `docs/api-plan/better-auth.yaml`
- `docs/api-plan/user-openapi.yaml`
- `docs/api-plan/finance-openapi.yaml`
- `docs/api-plan/loan-market-openapi.yaml`
- `docs/api-plan/loan-agreement-openapi.yaml`

## Executive Summary

This audit identifies critical discrepancies between the UI textual description for loan offer creation and the current API documentation. The UI flow requires multiple selection capabilities, document management features, and specific field configurations that are not adequately supported by the current API specifications.

## Discrepancies Found

### D001: Multiple Term Length Selection Support

**Severity**: High
**Location**: loan-market-openapi.yaml - CreateLoanOfferRequest schema

**Issue**: The UI description shows that users can select multiple term lengths (e.g., "1 month, 3 month, 6 month" all selected with green checkmarks), but the API schema only supports an array of term options without proper multi-selection validation.

**UI Requirement**:
- Page 2 shows: "Term Length: All three options selected (1 month, 3 month, 6 month) with green checkmarks"
- Page 3 Review shows: "Term Length: 1, 3, 6 months"

**Current API Schema**:
```yaml
termOptions:
  type: array
  items:
    type: integer
    enum: [1, 3, 6, 12]
  minItems: 1
  description: Available loan term options in months
  example: [3, 6]
```

**Data Example Scenario**:
- User selects 1, 3, and 6 months on UI
- API should accept: `"termOptions": [1, 3, 6]`
- Review page should display: "Term Length: 1, 3, 6 months"

**Recommended Fix**: The current API schema is actually correct, but the example should demonstrate multiple selections: `example: [1, 3, 6]`

### D003: Missing Loan Offer Success Response Data

**Severity**: Medium
**Location**: loan-market-openapi.yaml - LoanOfferResponse schema

**Issue**: The UI Success page displays specific formatted data that is not provided in the API response schema.

**UI Requirement**:
- Page 5 shows: "Invoice ID: COL-2847-9163"
- Page 5 shows: "Submitted: Jan 15, 2025 14:30"
- Page 5 shows formatted display of all loan parameters

**Current API Response** (from loan-market-openapi.yaml):
```yaml
LoanOfferResponse:
  properties:
    id: string
    createdDate: string (date-time)
    publishedDate: string (date-time)
    fundingInvoice: Invoice
```

**Missing Fields**:
- User-friendly invoice display ID format
- Formatted submission timestamp
- Complete summary for confirmation display

**Data Example Scenario**:
- User completes loan offer creation
- UI Success page needs: "Invoice ID: COL-2847-9163"
- Current API returns: `"id": "inv_12345"` (not user-friendly)
- UI needs formatted date: "Jan 15, 2025 14:30"
- Current API returns: `"createdDate": "2025-01-15T14:30:00Z"`

**Recommended Fix**: Enhance LoanOfferResponse schema:
```yaml
LoanOfferResponse:
  properties:
    id: string
    displayId: string  # User-friendly ID like "COL-2847-9163"
    submittedDate: string  # Formatted display date
    formattedSummary:
      type: object
      properties:
        totalAmount: string
        interestRate: string
        termLength: string
        acceptedCollateral: array
```

### D004: Incomplete Invoice Expiration Countdown Data

**Severity**: Medium
**Location**: loan-market-openapi.yaml - Invoice schema

**Issue**: The UI Fund page shows a countdown timer "23:59:59" but the API doesn't provide the real-time countdown data needed.

**UI Requirement**:
- Page 4 shows: "Invoice Expires In: 23:59:59 (hours:minutes:seconds)"
- Dynamic countdown timer functionality

**Current API Schema**:
```yaml
Invoice:
  properties:
    expiryDate:
      type: string
      format: date-time
```

**Missing Data**:
- Remaining time in seconds for countdown
- Real-time expiration status

**Data Example Scenario**:
- User reaches Fund page at 10:00:00
- Invoice expires at 10:24:00 (24 hours from creation)
- UI needs to show: "23:59:59" and count down
- Current API only provides: `"expiryDate": "2025-09-24T10:00:00Z"`

**Recommended Fix**: Enhance Invoice response:
```yaml
Invoice:
  properties:
    expiryDate: string (date-time)
    remainingSeconds: integer  # For countdown timer
    isExpired: boolean
```

