# User Market Individual - API Audit Report

**Audit Date**: 2025-09-23
**Scope**: User Market Individual interface functionality
**Source of Truth**: `docs/ui-descriptions/user-market-individual.md`
**API Documentation Reviewed**:
- `docs/api-plan/better-auth.yaml`
- `docs/api-plan/user-openapi.yaml`
- `docs/api-plan/loan-market-openapi.yaml`
- `docs/api-plan/loan-agreement-openapi.yaml`

## Executive Summary

This audit identifies 12 critical discrepancies between the User Market Individual UI requirements and the current API documentation. The discrepancies primarily relate to missing filtering capabilities, incomplete lender/borrower information, missing progress tracking data, and gaps in the loan application workflow.

## Discrepancy Analysis

### D1. Missing Lender Type Filtering in Loan Offers API

**Issue**: The UI shows distinct "All", "Institutions", "Individual" tabs for filtering loan offers by lender type, but the API documentation lacks a `lenderUserType` filter parameter.

**UI Requirements**:
- Users can switch between "All", "Institutions", "Individual" tabs
- Individual loans show "Individual" badges (light blue)
- Institutional loans show "Institutional" badges (light green)
- Each category displays different loan characteristics

**API Gap**:
In `loan-market-openapi.yaml`, the `/loan-offers` GET endpoint (line 138) has filters like `collateralBlockchainKey`, `principalBlockchainKey`, etc., but is missing `lenderUserType` parameter.

**Data Example**:
```
UI shows: "Individual" tab with 5 cards showing "J*** A*****n" lenders
API needs: GET /loan-offers?lenderUserType=Individual
Expected response: Only loans from individual lenders with userType="Individual"
```

**Suggested Fix**: Add `lenderUserType` parameter to `/loan-offers` GET endpoint:
```yaml
- name: lenderUserType
  in: query
  schema:
    type: string
    enum: [All, Individual, Institution]
    description: Filter by lender user type
```

### D2. Missing Funding Progress Data in Loan Offers

**Issue**: The UI displays funding progress bars (33% filled, 43% filled, etc.) with specific funding amounts, but the API response doesn't include progress tracking fields.

**UI Requirements**:
- Progress bar visualization showing completion percentage
- Funding ranges like "2,000 USDT to 25,000 USDT"
- Completion percentages like "33%", "43%", "100%"

**API Gap**:
The `LoanOfferResponse` schema (line 881) includes `totalAmount`, `availableAmount`, and `disbursedAmount` but lacks derived progress fields.

**Data Example**:
```
UI shows: Progress bar 33% with "2,000 USDT" funded out of "25,000 USDT" total
API needs: Additional calculated fields in response:
{
  "fundingProgress": {
    "percentageFunded": 33,
    "fundedAmount": "2000.000000000000000000",
    "targetAmount": "25000.000000000000000000"
  }
}
```

**Suggested Fix**: Add funding progress fields to `LoanOfferResponse` schema.

### D3. Missing User Privacy/Masking Support

**Issue**: The UI consistently shows masked user names like "J*** A*****n" and "R*****n L*****e" for privacy, but the API doesn't specify how user information should be masked.

**UI Requirements**:
- Individual user names are masked in public listings
- Only first and last characters visible with asterisks between
- User avatars are still shown

**API Gap**:
The `LenderInfo` and `BorrowerInfo` schemas show full names without masking options.

**Data Example**:
```
UI shows: "J*** A*****n"
API should provide:
{
  "name": "John Anderson",
  "displayName": "J*** A*****n",
  "isPublicListing": true
}
```

**Suggested Fix**: Add `displayName` field and privacy controls to user info schemas.

### D4. Missing Detailed Loan Application Calculation API

**Issue**: The UI shows a comprehensive calculation form with real-time updates for loan applications, but the API only has a basic calculation endpoint.

**UI Requirements**:
- Real-time calculation updates as user types
- Detailed breakdown: Total, Interest Rate, Provisions, Total Loans, Liquidation Fees, Premium risks, LTV, Collateral amount
- Dynamic form validation and summary updates

**API Gap**:
`/loan-applications/calculate` endpoint exists but the `LoanCalculationResponse` schema doesn't match the detailed UI breakdown.

**Data Example**:
```
UI shows detailed breakdown:
- Principal Amount: 1,000.00 USDT
- Interest Rate (6.8%): 68.00 USDT
- Provisions (3%): 30.00 USDT
- Total Loans: 1,098.00 USDT
- Liquidations Fees (2%): 20.0 USDT
- Premium risks (2%): 20.0 USDT
- LTV: 60%
- Collateral: 1,896.00 BTC
```

**Suggested Fix**: Enhance `LoanCalculationResponse` to include all UI calculation fields.

### D5. Missing Application Status Workflow States

**Issue**: The UI shows specific application status screens (Pending, Success, Rejected, Funding states) with detailed messages, but the API doesn't define these workflow states.

**UI Requirements**:
- "Loan Application still Pending" vs "Loan Funding still Pending"
- Success states with congratulations messages
- Rejection states with reapply options
- Status-specific action buttons

**API Gap**:
Application status tracking is not clearly defined in the API documentation.

**Data Example**:
```
UI shows: "Loan Application still Pending" with orange clock icon
API needs:
{
  "applicationStatus": "ApplicationPending",
  "fundingStatus": "FundingPending",
  "statusMessage": "Your loan application is pending review.",
  "availableActions": ["backToHome"]
}
```

**Suggested Fix**: Define comprehensive application status enums and workflow states.

### D6. Missing Invoice Expiration Timer Support

**Issue**: The UI shows a countdown timer for invoice expiration ("23:59:59"), but the API invoice schema doesn't support real-time countdown functionality.

**UI Requirements**:
- Real-time countdown timer display
- Visual warning about expiration
- Auto-detection of payment status

**API Gap**:
`Invoice` schema has `expiryDate` but lacks countdown calculation support.

**Data Example**:
```
UI shows: "Invoice Expires In: 23:59:59"
API needs:
{
  "expiryDate": "2025-09-24T23:59:59Z",
  "timeRemaining": "23:59:59",
  "isExpiringSoon": false
}
```

**Suggested Fix**: Add time remaining calculation fields to invoice responses.

### D7. Missing Collateral Amount Display in Applications List

**Issue**: The UI shows collateral amounts (like "0.5 BTC") in loan application cards, but the API response schema doesn't include collateral details for list views.

**UI Requirements**:
- Collateral type and amount displayed in application cards
- Collateral information visible in listing views

**API Gap**:
`LoanApplicationListResponse` doesn't include collateral information.

**Data Example**:
```
UI shows: "Collateral: 0.5 BTC" in application card
API needs: Include collateral data in list responses
```

**Suggested Fix**: Add collateral fields to loan application list response schema.

### D8. Missing "Verified User" Badge Data

**Issue**: The UI consistently shows "Verified User" badges with green checkmarks, but the API doesn't provide user verification status.

**UI Requirements**:
- "Verified User" badge display
- Visual verification indicators
- Verification status in user profiles

**API Gap**:
User schemas lack verification status fields for display purposes.

**Data Example**:
```
UI shows: Green "Verified User" badge
API needs:
{
  "isVerified": true,
  "verificationLevel": "verified",
  "verificationBadge": {
    "text": "Verified User",
    "color": "green"
  }
}
```

**Suggested Fix**: Add verification display fields to user schemas.

### D12. Missing About Lender Information

**Issue**: The UI shows expandable "About Lender" sections with "Read More" links, but the API doesn't provide detailed lender descriptions.

**UI Requirements**:
- Expandable lender information
- "About Lender" text content
- "Read More" functionality

**API Gap**:
Lender schemas lack detailed description fields.

**Data Example**:
```
UI shows: "About Lender: Text about PT. Bank Negara Indonesia" with "Read More"
API needs: Detailed lender information fields
```

**Suggested Fix**: Add description and detailed information fields to lender schemas.
