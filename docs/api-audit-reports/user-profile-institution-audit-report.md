# User Profile Institution API Audit Report

## Overview
This audit report compares the UI textual description for institution user profile screens against the available API documentation. The UI description serves as the source of truth, and this report identifies gaps where the API documentation does not support the required UI functionality.

## Summary of Findings
- **Total Discrepancies Found**: 8
- **Critical API Gaps**: 4 (missing core endpoints)
- **Data Model Misalignments**: 2
- **Minor Inconsistencies**: 2


## Discrepancy 3: Company Information Management
**Severity**: High
**API Gap**: Missing institution details endpoint

### UI Requirements
Page 11 shows comprehensive company information:
- Company name with verification badge
- Industry classification
- Registration numbers (NIB/TDP and NPWP)
- Contact information (email, telephone, address)
- Banking information (bank name, account number)

### API Documentation Analysis
**user-openapi.yaml** provides:
- `/institutions/{id}` - Basic institution details
- `/institutions` - Institution registration

### Missing API Support
1. **Complete Institution Profile**: Current endpoints lack detailed contact and banking info
2. **Verification Badge Logic**: No clear indication of verification status display rules
3. **Industry Classification**: Not included in current institution schema

### Data Example Scenario
```javascript
// Required by UI Page 11
GET /institutions/{id}/details
{
  "success": true,
  "data": {
    "institution": {
      "id": 98765,
      "name": "PT. Bank Central Indonesia",
      "industry": "Financial Services",
      "verification": {
        "status": "Verified",
        "verifiedDate": "2024-01-20T10:00:00Z",
        "badge": true
      },
      "businessInfo": {
        "registrationNumber": "123456789012",
        "npwpNumber": "123456789012345",
        "description": "Financial Services"
      },
      "contactInfo": {
        "email": "pt.bca@company.id",
        "telephone": "+62 21 1234 5678",
        "address": "Jakarta Selatan, DKI Jakarta"
      },
      "bankingInfo": {
        "bankName": "Bank BCA",
        "accountNumber": "1234567890"
      }
    }
  }
}
```

---

## Discrepancy 4: Institution Role Context in Profile
**Severity**: Medium
**API Gap**: Missing institution role display in user profile

### UI Requirements
Page 16 shows: "Institution Role: Owner - PT. Bank Central Indonesia"

### API Documentation Analysis
**user-openapi.yaml** UserProfile schema includes:
- `institutionId`: integer
- `institutionRole`: enum [Owner, Finance]

But doesn't include institution name for display context.

### Missing API Support
1. **Institution Name in Profile**: Profile endpoint should include institution name for role display
2. **Role Display Format**: No guidance on how to format role with institution name

### Data Example Scenario
```javascript
// Current vs Required
// Current API response:
{
  "user": {
    "institutionId": 98765,
    "institutionRole": "Owner"
  }
}

// Required for UI:
{
  "user": {
    "institutionId": 98765,
    "institutionRole": "Owner",
    "institutionName": "PT. Bank Central Indonesia",
    "institutionRoleDisplay": "Owner - PT. Bank Central Indonesia"
  }
}
```
