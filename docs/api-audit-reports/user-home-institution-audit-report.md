# User Home Institution UI vs API Audit Report

## Overview
This audit report identifies discrepancies between the User Home Institution UI textual description and the API documentation. The UI textual description serves as the source of truth for required functionality.

**Audit Scope**: User Home Institution flow as described in `docs/ui-descriptions/user-home-institution.md`

**API Files Audited**:
- `docs/api-plan/better-auth.yaml`
- `docs/api-plan/user-openapi.yaml`
- `docs/api-plan/loan-market-openapi.yaml`
- `docs/api-plan/loan-agreement-openapi.yaml`

## Discrepancies Found

### D001: Missing Institution Dashboard Home Data Aggregation

**UI Requirement**: The dashboard displays aggregated loan portfolio data including:
- Total portfolio value: "127,856.43 USDT"
- Income amount: "127,856.43 USDT"
- Active loans count: "126"
- Monthly/period indicator: "July 2025"

**API Gap**: No endpoint exists to retrieve aggregated institution loan portfolio data for dashboard display.

**Missing API**:
```
GET /users/dashboard/institution-summary
Response should include:
{
  "portfolioValue": "127856.430000000000000000",
  "incomeAmount": "127856.430000000000000000",
  "activeLoanCount": 126,
  "reportingPeriod": "July 2025"
}
```

**Use Case Scenario**: When John Smith (Institution Owner) opens the dashboard, the system needs to aggregate all institution loan data to display the portfolio card with current values, but no API endpoint provides this consolidated view.

### D002: Missing Institution Member Management Endpoints

**UI Requirement**: Institution owners can manage members through:
- View current members with roles, verification status, join dates
- View pending invitations with expiration dates and actions
- Remove members (except owners)
- Resend invitations
- Cancel pending invitations

**API Gap**: The user-openapi.yaml contains invitation endpoints but lacks comprehensive member management operations:
- No endpoint to remove institution members
- No endpoint to resend invitations
- No endpoint to cancel pending invitations
- No endpoint to list current members with full details

**Missing APIs**:
```
DELETE /institutions/{id}/members/{userId}
POST /institutions/invitations/{id}/resend
DELETE /institutions/invitations/{id}
GET /institutions/{id}/members (enhanced with join dates, verification status)
```

**Use Case Scenario**: John Smith wants to remove "Mike Chen" from his institution. He taps the red "Remove" button, but there's no API endpoint to process this deletion request.

### D003: Missing Detailed Institution Information for Invitations

**UI Requirement**: Invitation details page shows comprehensive institution information:
- Registration number: "FSL-2024-001"
- Industry type: "Financial Services"
- Founding date: "Since Jan 2024"
- Contact information (address, email, phone)
- Detailed business description

**API Gap**: Institution schema in user-openapi.yaml lacks detailed fields required for invitation display.

**Missing Schema Fields**:
```yaml
Institution:
  properties:
    registrationNumber:
      type: string
      example: "FSL-2024-001"
    industry:
      type: string
      example: "Financial Services"
    foundingDate:
      type: string
      format: date-time
    contactAddress:
      type: string
    contactEmail:
      type: string
    contactPhone:
      type: string
    detailedDescription:
      type: string
```

**Use Case Scenario**: Sarah Johnson receives an invitation and taps "Details" to review PT. Bank Central Indonesia information, but the API cannot provide the registration number, industry, or contact details shown in the UI.

### D005: Missing Invitation Expiration and Status Management

**UI Requirement**: Pending invitations show:
- Specific expiration countdown: "Invitation expires in 5 days"
- Sent date: "Sent: Invited: Feb 10, 2025"
- Resend and Cancel actions with success confirmations

**API Gap**: While basic invitation schema exists, it lacks:
- Precise expiration tracking
- Sent date tracking
- Status update operations for resend/cancel

**Missing API Enhancements**:
```yaml
InstitutionInvitationDetails:
  properties:
    sentDate:
      type: string
      format: date-time
      description: "When invitation was originally sent"
    daysUntilExpiration:
      type: integer
      description: "Remaining days before expiration"
    canResend:
      type: boolean
      description: "Whether invitation can be resent"
    canCancel:
      type: boolean
      description: "Whether invitation can be cancelled"
```

**Use Case Scenario**: Institution owner views pending invitations and sees "Alex Wilson - Invitation expires in 5 days" but the API cannot calculate or provide this countdown information.

### D007: Missing Member Verification Status Tracking

**UI Requirement**: Member cards display verification status:
- Blue "Verified User" badges for all members
- Verification status affects member capabilities

**API Gap**: Institution member schema doesn't include detailed verification status information.

**Missing Schema Enhancement**:
```yaml
InstitutionMember:
  properties:
    verificationStatus:
      type: string
      enum: [Verified, Pending, Unverified]
      description: "Member verification status"
    verifiedDate:
      type: string
      format: date-time
      nullable: true
      description: "When member was verified"
```

**Use Case Scenario**: When viewing current members, John Smith needs to see that all members show "Verified User" status, but the API doesn't track or return verification details.

### D008: Missing Notification Modal Integration Data

**UI Requirement**: Dashboard notification modal shows:
- Institution icon and name
- Role being offered: "Finance member"
- Role description: "Can create loan offers and manage financials, cannot manage members"
- Verification status warning integration

**API Gap**: No endpoint provides notification modal data structure that combines invitation details with verification warnings.

**Missing API**:
```
GET /notifications/institution-invitations
Response:
{
  "pendingInvitations": [{
    "institutionName": "PT. Bank Central Indonesia",
    "institutionIcon": "...",
    "offeredRole": "Finance",
    "roleDescription": "Can create loan offers and manage financials, cannot manage members",
    "showVerificationWarning": true
  }]
}
```

**Use Case Scenario**: When Sarah Johnson opens the dashboard, she sees the institution invitation modal popup, but no API endpoint structures this notification data for the modal display.
