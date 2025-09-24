# User Loan Application Creation - API Alignment Audit Report

## Executive Summary

This audit report examines the alignment between the UI textual description for the user loan application creation flow and the existing API documentation. The audit focuses on identifying discrepancies where the UI requirements are not adequately supported by the current API specifications.

## Audit Scope

**UI Source of Truth**: `docs/ui-descriptions/user-loan-application-creation.md`

**API Documentation Audited**:
- `docs/api-plan/better-auth.yaml`
- `docs/api-plan/user-openapi.yaml`
- `docs/api-plan/loan-market-openapi.yaml`
- `docs/api-plan/loan-agreement-openapi.yaml`

## Identified Discrepancies

### D01: Missing Loan Application Calculation Endpoint with Fee Breakdown

**Issue**: The UI shows detailed fee breakdown including "Provisions (3%)", "Liquidations Fees (2%)", "Premium risks (2%)", and "LTV" calculations, but the API only provides basic collateral calculation.

**UI Requirement**: Page 3 shows:
- Principal Amount: 10,000 USDT
- Interest Rate: 7.5%
- Provisions (3%): 30.00 USDT
- Terms: 3 month
- Total Loans: 12,550.00 USDT
- Liquidations Fees (2%): 200.0 USDT
- Premium risks (2%): 200.0 USDT
- LTV: 70%
- Collateral: 0.44 BTC

**API Gap**: The `/loan-applications/calculate` endpoint in `loan-market-openapi.yaml` only returns basic collateral requirements but lacks:
- Detailed fee breakdown (provisions, liquidation fees, premium risks)
- Total loan amount calculation
- LTV ratio calculation
- Complete loan terms preview

**Example Scenario**: When a user enters 10,000 USDT loan amount with 7.5% interest for 3 months, the UI needs to display all fee components, but the current API cannot provide this comprehensive breakdown.

**Suggested Fix**: Enhance the `/loan-applications/calculate` endpoint response to include:
```yaml
calculationDetails:
  fees:
    provisionsFee: "300.000000000000000000"  # 3% of principal
    liquidationFees: "200.000000000000000000"  # 2% fee
    premiumRisks: "200.000000000000000000"    # 2% risk premium
  totalLoanAmount: "12550.000000000000000000"
  ltvRatio: 70.0
  breakdown:
    principalAmount: "10000.000000000000000000"
    interestAmount: "750.000000000000000000"   # 7.5% for 3 months
    totalFees: "700.000000000000000000"
```

### D05: Inconsistent Invoice Data Structure

**Issue**: The UI shows specific invoice fields that don't match the API invoice schema structure.

**UI Requirement**: Page 4 shows:
- Invoice ID: COL-2847-9163
- Currency: Bitcoin (BTC) with network info
- Due Date: 15-07-2025-23:59:59
- Payment Amount: "Send Exactly 0.44 BTC"
- Specific warning about exact amount

**API Gap**: The `Invoice` schema in loan-market-openapi.yaml lacks:
- Specific invoice ID format (COL-prefix)
- Network information display
- Exact amount warnings
- Due date vs expiry date terminology inconsistency

**Example Scenario**: UI needs to display "COL-2847-9163" as invoice ID and "Bitcoin Network" as network info, but API only provides generic invoice structure.

**Suggested Fix**: Enhance Invoice schema to include:
```yaml
Invoice:
  properties:
    id:
      type: string
      pattern: '^COL-[0-9]{4}-[0-9]{4}$'
      example: "COL-2847-9163"
    blockchain:
      type: object
      properties:
        key:
          type: string
          example: "Bitcoin Network"
        name:
          type: string
          example: "Bitcoin Network"
        imageUrl:
          type: string
          example: "https://example.com/bitcoin.png"
    exactAmountRequired:
      type: boolean
      description: Whether exact amount is required
      example: true
    warningMessage:
      type: string
      example: "Sending wrong amount may delay processing"
```
