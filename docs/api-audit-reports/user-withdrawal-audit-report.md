# User Withdrawal API Audit Report

**Document**: API compliance audit for user withdrawal functionality
**Source of Truth**: `docs/ui-descriptions/user-withdrawal.md`
**Date**: 2025-09-22
**Auditor**: Claude Code

## Executive Summary

This audit compares the user withdrawal UI requirements against the existing API documentation to identify discrepancies and gaps. The analysis reveals **8 major discrepancies** that must be addressed for the withdrawal UI to function as specified.

**Critical Findings**: The current API lacks essential endpoints for blockchain selection, email verification, QR code support, and comprehensive 2FA integration required by the UI.

## Scope

**APIs Audited:**
- `docs/api-plan/better-auth.yaml` - Authentication system
- `docs/api-plan/user-openapi.yaml` - User management
- `docs/api-plan/finance-openapi.yaml` - Primary withdrawal API
- `docs/api-plan/loan-market-openapi.yaml` - Market operations
- `docs/api-plan/loan-agreement-openapi.yaml` - Agreement management

**UI Requirements Source:**
- `docs/ui-descriptions/user-withdrawal.md` - 10 UI states/pages
- `docs/SRS-CG-v2.3-EN.md` - Business requirements (RF-022 to RF-025)

## Detailed Findings

### =4 **Critical Discrepancy #1: Missing Blockchain Selection API**

**UI Requirement**: Page 3 - "Select Blockchain Network" with dropdown for Bitcoin, Ethereum, BSC, Solana
**API Status**: L **MISSING**
**Impact**: HIGH - Users cannot select withdrawal blockchain

**Current API**: Finance API only provides currency selection via `/currencies`
**Required Fix**:
```yaml
/blockchains:
  get:
    summary: Get supported blockchain networks
    responses:
      200:
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id: {type: string, example: "bitcoin"}
                  name: {type: string, example: "Bitcoin"}
                  symbol: {type: string, example: "BTC"}
                  network_fee_estimate: {type: number}
```

### =4 **Critical Discrepancy #2: Missing Address Format Examples**

**UI Requirement**: Page 4 - "Address format examples for each blockchain"
**API Status**: L **MISSING**
**Impact**: HIGH - Users receive no guidance on proper address formats

**Current API**: Generic address field in beneficiary creation
**Required Fix**: Enhance `/blockchains/{id}/address-format` endpoint with examples and validation patterns

### =4 **Critical Discrepancy #3: Missing QR Code Scanning Support**

**UI Requirement**: Page 4 - "QR code scanning functionality"
**API Status**: L **MISSING**
**Impact**: MEDIUM - Degrades user experience for mobile users

**Current API**: No QR-related endpoints
**Required Fix**:
```yaml
/utils/parse-qr:
  post:
    summary: Parse QR code content for withdrawal address
    requestBody:
      content:
        application/json:
          schema:
            properties:
              qr_content: {type: string}
```

### =4 **Critical Discrepancy #4: Missing Email Verification Flow**

**UI Requirement**: Page 7 - "Email verification required before proceeding"
**API Status**: L **MISSING**
**Impact**: HIGH - Security requirement cannot be fulfilled

**Current API**: No email verification endpoints in finance API
**Required Fix**:
```yaml
/withdrawals/verify-email:
  post:
    summary: Send email verification for withdrawal
    requestBody:
      content:
        application/json:
          schema:
            properties:
              withdrawal_id: {type: string}
```

### =á **Major Discrepancy #5: Incomplete Currency Selection Logic**

**UI Requirement**: Page 2 - Currency selection with balance display and insufficient funds handling
**API Status**:   **PARTIALLY IMPLEMENTED**
**Impact**: MEDIUM - Missing validation logic

**Current API**: Basic balance check via `/accounts/balances`
**Gap**: No endpoint to validate withdrawal amount against available balance with fees
**Required Fix**: Enhance validation in withdrawal creation endpoint

### =á **Major Discrepancy #6: Incomplete 2FA Integration**

**UI Requirement**: Page 8 - "2FA verification step with TOTP/OTP options"
**API Status**:   **PARTIALLY IMPLEMENTED**
**Impact**: HIGH - Security workflow incomplete

**Current API**: Better Auth has `/two-factor/verify` but not integrated with withdrawal flow
**Gap**: No withdrawal-specific 2FA verification
**Required Fix**: Add 2FA verification step to withdrawal confirmation endpoint

### =á **Major Discrepancy #7: Missing Progress Tracking**

**UI Requirement**: Page 10 - "Real-time withdrawal status updates"
**API Status**:   **BASIC IMPLEMENTATION**
**Impact**: MEDIUM - Poor user experience

**Current API**: Basic status in withdrawal object
**Gap**: No real-time updates or detailed progress tracking
**Required Fix**: WebSocket endpoint or polling endpoint for status updates

### =á **Major Discrepancy #8: Incomplete Beneficiary Management**

**UI Requirement**: Page 1 & 5-6 - Add/edit beneficiary addresses with full management
**API Status**:   **PARTIALLY IMPLEMENTED**
**Impact**: MEDIUM - Limited beneficiary functionality

**Current API**: Basic CRUD via `/beneficiaries`
**Gap**: Missing address validation per blockchain, nickname management
**Required Fix**: Enhance beneficiary endpoints with blockchain-specific validation

## API Completeness Matrix

| UI Feature | Required API | Status | Priority |
|------------|-------------|---------|----------|
| Empty State Display | `/accounts/balances` |  Complete | - |
| Currency Selection | `/currencies` |  Complete | - |
| Blockchain Selection | `/blockchains` | L Missing | P0 |
| Address Examples | `/blockchains/{id}/format` | L Missing | P0 |
| QR Scanning | `/utils/parse-qr` | L Missing | P1 |
| Beneficiary CRUD | `/beneficiaries` |   Partial | P1 |
| Email Verification | `/withdrawals/verify-email` | L Missing | P0 |
| 2FA Integration | `/withdrawals/{id}/verify-2fa` | L Missing | P0 |
| Withdrawal Creation | `/withdrawals` |  Complete | - |
| Status Tracking | `/withdrawals/{id}/status` |   Basic | P1 |

## Priority Recommendations

### **P0 - Critical (Must Fix)**
1. **Implement blockchain selection API** - Core functionality blocker
2. **Add email verification flow** - Security requirement
3. **Integrate 2FA with withdrawal process** - Security compliance
4. **Provide address format examples** - User guidance essential

### **P1 - High (Should Fix)**
5. **Add QR code parsing support** - Mobile user experience
6. **Enhance beneficiary management** - Address validation per blockchain
7. **Implement real-time status tracking** - User experience improvement

### **P2 - Medium (Nice to Have)**
8. **Add withdrawal amount validation** - Better error handling

## Implementation Recommendations

### 1. New Endpoints Required
```yaml
# Add to finance-openapi.yaml
/blockchains:
  get: # List supported blockchains
/blockchains/{id}/address-format:
  get: # Get address format and examples
/withdrawals/verify-email:
  post: # Send verification email
/withdrawals/{id}/verify-2fa:
  post: # Verify 2FA for withdrawal
/utils/parse-qr:
  post: # Parse QR code content
```

### 2. Schema Enhancements
- Add `blockchain_id` to withdrawal and beneficiary objects
- Add `address_format` and `examples` to blockchain schema
- Add `email_verified` and `two_factor_verified` to withdrawal status
- Add `nickname` and `is_verified` to beneficiary schema

### 3. Integration Points
- Connect Better Auth 2FA system with withdrawal flow
- Integrate email service with withdrawal verification
- Add blockchain address validation service

## Next Steps

1. **Update API specifications** with missing endpoints
2. **Implement P0 critical endpoints** in backend
3. **Update withdrawal workflow** to include verification steps
4. **Test end-to-end flow** against UI requirements
5. **Update API documentation** with new endpoints

## Conclusion

The audit reveals significant gaps between UI requirements and current API capabilities. **8 major discrepancies** must be addressed, with 4 critical (P0) items that are blockers for the withdrawal functionality.

The core withdrawal mechanics exist, but essential user experience and security features are missing from the API layer. Implementing the recommended changes will ensure full compliance with the UI specification and provide a complete, secure withdrawal experience.

---
*This audit was generated by comparing UI requirements against API documentation. All recommendations should be validated with the development team and security review.*