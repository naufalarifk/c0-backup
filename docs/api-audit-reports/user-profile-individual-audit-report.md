# User Profile Individual - API Audit Report

## Overview
This audit report identifies discrepancies between the UI textual description in `user-profile-individual.md` and the API documentation. The UI description serves as the source of truth for required functionality.

## Audit Summary
- **Total Discrepancies Found**: 8
- **Critical Issues**: 3
- **Missing Endpoints**: 2
- **Schema Mismatches**: 3
---

## Discrepancy #3: Profile Schema Missing Phone Verification Status
**Severity**: High
**Category**: Schema Mismatch

### Issue Description
The profile page (Page 15) shows phone verification status as "Verify" with blue link styling, but the UserProfile schema doesn't include phone verification status fields.

### UI Requirements
- Phone number display: "+6208-8819-7291"
- Phone verification status: "Verify" (indicating unverified)
- Clickable action to trigger verification

### Current API Schema
```yaml
UserProfile:
  properties:
    phoneNumber: string (from Better Auth)
    phoneNumberVerified: boolean (from Better Auth, but readOnly)
```

### Required Schema Enhancement
```yaml
UserProfile:
  properties:
    phoneNumber: string
    phoneNumberVerified: boolean
    phoneVerificationStatus:
      type: string
      enum: [verified, unverified, pending]
    canVerifyPhone: boolean
```

### Data Example Scenario
```json
{
  "user": {
    "phoneNumber": "+6208-8819-7291",
    "phoneNumberVerified": false,
    "phoneVerificationStatus": "unverified",
    "canVerifyPhone": true
  }
}
```

---

## Discrepancy #4: Google Account Link Status Mismatch
**Severity**: Medium
**Category**: Schema Mismatch

### Issue Description
Page 15 shows Google Account as "Unlinked" with green dot indicator, while Page 14 shows "No Google account linked" with warning icon. The API schema doesn't provide sufficient status information.

### UI Requirements
- Clear Google account linking status
- Visual indicators (green dot vs warning icon)
- Distinction between "unlinked" and "no account available"

### Current API Schema
```yaml
UserProfile:
  properties:
    googleId: string (nullable)
```

### Required Schema Enhancement
```yaml
UserProfile:
  properties:
    googleId: string (nullable)
    googleAccountStatus:
      type: string
      enum: [linked, unlinked, available]
    googleAccountInfo:
      type: object
      nullable: true
      properties:
        email: string
        name: string
        linkedDate: string
```

### Data Example Scenario
```json
{
  "user": {
    "googleId": null,
    "googleAccountStatus": "unlinked",
    "googleAccountInfo": null
  }
}
```

