# Institution Management API Audit Report

## Executive Summary

This audit report compares the institution management UI flows described in `docs/ui-descriptions/user-home-institution.md` against the current API documentation in the OpenAPI specifications. The UI description serves as the source of truth, and this report identifies gaps where the API does not support required functionality.

**Audit Scope**: Institution member management flows (18 UI sections)
**Audit Date**: 2025-09-22
**Status**: CRITICAL GAPS IDENTIFIED

## Key Findings

### Supported Features
- Basic invitation creation (`POST /institutions/invitations`)
- Invitation acceptance (`POST /institutions/invitations/{id}/accept`)
- Invitation rejection (`POST /institutions/invitations/{id}/reject`)
- Notification system integration (Better Auth notifications)

### L Critical Missing Features
- **Member management endpoints** (view, list, remove members)
- **Institution member listing API**
- **Member removal functionality**
- **Pending invitation management**
- **Institution details API for member context**
- **Role-based permission validation**

## Detailed Gap Analysis

### 1. Member Management Current (UI Section 2)

**UI Requirements:**
- Display current institution members with roles, verification status, join dates
- Show member count (234 Active)
- Display institution verification status
- Remove member functionality for non-owners

**API Gaps:**
- L **MISSING**: `GET /institutions/{id}/members` - List current institution members
- L **MISSING**: `DELETE /institutions/{id}/members/{userId}` - Remove institution member
- L **MISSING**: Institution member schema with role, verification status, join date
- L **MISSING**: Institution details API with member count and verification status

**Impact**: HIGH - Core functionality completely unavailable

### 2. Member Management Pending (UI Section 3)

**UI Requirements:**
- List pending invitations with status and timestamps
- Resend invitation functionality
- Cancel/revoke pending invitations

**API Gaps:**
- L **MISSING**: `GET /institutions/{id}/invitations` - List pending invitations
- L **MISSING**: `POST /institutions/invitations/{id}/resend` - Resend invitation
- L **MISSING**: `DELETE /institutions/invitations/{id}` - Cancel pending invitation
- L **MISSING**: Invitation schema with timestamps, status tracking

**Impact**: HIGH - Cannot manage pending invitations

### 3. Institution Dashboard Integration (UI Section 1)

**UI Requirements:**
- Display user's institution role and membership status
- Show loan portfolio data contextual to institution
- Access member management from dashboard

**API Gaps:**
- L **MISSING**: `GET /user/institutions` - List user's institution memberships
- L **MISSING**: Institution-specific loan portfolio aggregation
- L **MISSING**: User role context in institution responses

**Impact**: MEDIUM - Dashboard cannot show institution context

### 4. Invitation Flow Enhancements (UI Sections 4-8)

**UI Requirements:**
- Role-specific invitation creation with permissions preview
- Invitation status tracking (sent, pending, expired)
- Success/failure handling with detailed messaging

**API Gaps:**
- L **MISSING**: Role validation in invitation creation
- L **MISSING**: Invitation expiration handling
- L **MISSING**: Detailed error responses for invitation failures
- L **MISSING**: Institution role permissions definition API

**Impact**: MEDIUM - Invitation flow lacks role context and proper error handling

### 5. Invitation Acceptance Flow (UI Sections 13-18)

**UI Requirements:**
- Multi-tab invitation review (Institution, Role, Terms)
- Role permission and restriction display
- Terms and compliance acceptance
- Acceptance confirmation with institution details

**API Gaps:**
- **SUPPORTED**: Basic acceptance mechanism exists
- L **MISSING**: `GET /institutions/invitations/{id}/details` - Full invitation details for review
- L **MISSING**: Role permissions and restrictions definition
- L **MISSING**: Terms and compliance tracking
- L **MISSING**: Post-acceptance institution details with member count

**Impact**: MEDIUM - Acceptance flow exists but lacks detailed context

### 6. Institution Information Context

**UI Requirements:**
- Institution verification status display
- Member statistics and active counts
- Institution type and registration details

**API Gaps:**
- L **MISSING**: `GET /institutions/{id}` - Institution details API
- L **MISSING**: Institution schema with verification status, member counts, registration info
- L **MISSING**: Institution type definitions

**Impact**: HIGH - No way to display institution context throughout UI

## Schema Deficiencies

### Missing Schemas Required:

1. **InstitutionMember**
```yaml
InstitutionMember:
  type: object
  properties:
    id: string
    userId: string
    institutionId: string
    role: string (enum: Owner, Finance)
    verificationStatus: string
    joinedAt: string (date-time)
    invitedBy: string
    user:
      $ref: '#/components/schemas/UserProfile'
```

2. **Institution**
```yaml
Institution:
  type: object
  properties:
    id: string
    name: string
    type: string
    verificationStatus: string (enum: Verified, Pending, Unverified)
    memberCount: integer
    activeSince: string (date-time)
    registrationDetails: object
```

3. **InstitutionInvitationDetails** (Enhancement)
```yaml
InstitutionInvitationDetails:
  allOf:
    - $ref: '#/components/schemas/InstitutionInvitation'
    - type: object
      properties:
        institution:
          $ref: '#/components/schemas/Institution'
        rolePermissions: array
        roleRestrictions: array
        expiresAt: string (date-time)
```

## Required API Endpoints

### High Priority (Core Functionality)
1. `GET /institutions/{id}/members` - List institution members
2. `DELETE /institutions/{id}/members/{userId}` - Remove member
3. `GET /institutions/{id}/invitations` - List pending invitations
4. `GET /institutions/{id}` - Institution details
5. `GET /user/institutions` - User's institution memberships

### Medium Priority (Enhanced Experience)
6. `POST /institutions/invitations/{id}/resend` - Resend invitation
7. `DELETE /institutions/invitations/{id}` - Cancel invitation
8. `GET /institutions/invitations/{id}/details` - Detailed invitation info
9. `GET /institutions/{id}/roles` - Institution role definitions

### Low Priority (Future Enhancement)
10. `GET /institutions/{id}/permissions` - Role permission matrix
11. `GET /institutions/{id}/statistics` - Institution analytics

## Security Considerations

### Missing Access Controls:
- L Role-based authorization for member management endpoints
- L Institution ownership validation for sensitive operations
- L Member removal authorization (only owners can remove)
- L Invitation management authorization

### Required Guards:
1. `@InstitutionOwnerGuard` - Only owners can invite/remove members
2. `@InstitutionMemberGuard` - Only members can access institution data
3. `@InvitationOwnerGuard` - Only invitation sender can resend/cancel

## Recommendations

### Immediate Actions (Required for MVP):
1. **Implement core member management APIs** (endpoints 1-5 above)
2. **Create missing schemas** (InstitutionMember, Institution, enhanced invitation)
3. **Add role-based authorization guards**
4. **Implement institution details API with member context**

### Phase 2 Implementation:
1. **Add invitation management features** (resend, cancel, detailed view)
2. **Implement role permission system**
3. **Add comprehensive error handling and status tracking**

### Technical Debt Considerations:
1. **Institution data model**: Ensure it supports verification workflows
2. **Member role system**: Design for future role expansion beyond Owner/Finance
3. **Invitation expiration**: Implement proper cleanup and notification system
4. **Audit logging**: Track all member management operations for compliance

## Conclusion

The current API implementation only supports **25%** of the required institution management functionality described in the UI flows. Critical gaps exist in:

- **Member management** (view, list, remove)
- **Institution context** (details, verification, statistics)
- **Invitation management** (list, resend, cancel)
- **Role-based permissions** (validation, display)

**Recommendation**: Implement high-priority endpoints immediately to support basic member management functionality. The current API state would require significant UI compromises that would severely impact user experience.

**Estimated Development Effort**: 3-4 sprint cycles to achieve full UI flow support.