# User OpenAPI Implementation Analysis Report

This document compares the current implementation state of the CryptoGadai backend against the user-openapi.yaml specification.

## Implementation Status Overview

### ✅ Implemented Features
- **User Type Selection** - Partially implemented
- **Basic User Profile Management** - Implemented
- **KYC Submission & Status** - Implemented
- **Institution Application & Management** - Partially implemented
- **Database Schemas** - Mostly complete
- **Authentication Integration** - Implemented with Better Auth

### ❌ Missing/Incomplete Features
- **User Preferences Management** - Missing completely
- **Notification Management API** - Missing API endpoints
- **Complete Institution Member Management** - Partially missing
- **Profile Picture Management** - Needs verification
- **Phone Verification Integration** - Schema exists but API missing

## Detailed Analysis by Feature Area

### 1. User Type Selection (`/users/type-selection`)

**Status**: ✅ **Implemented**
- **Controller**: `src/modules/users/users.controller.ts:25-55` (`PATCH /type-selection`)
- **Service**: `UsersService.setUserType()`
- **Database**: Users table has `user_type` field with proper constraints
- **OpenAPI Compliance**: ⚠️ **Mismatch** - OpenAPI spec shows `POST` but implementation uses `PATCH`

**Required Adjustments**:
- [ ] Change HTTP method from `PATCH` to `POST` to match OpenAPI spec
- [ ] Update request/response DTOs to match OpenAPI examples
- [ ] Add proper 409 conflict response for already selected user types

### 2. User Profile Management (`/users/profile`)

**Status**: ✅ **Implemented**
- **Controller**: `src/modules/users/profile/profile.controller.ts`
- **Endpoints**:
  - `GET /users/profile` - ✅ Implemented
  - `PUT /users/profile` - ✅ Implemented
- **File Upload**: Profile picture upload support exists
- **Database**: Users table has name and profile_picture fields

**Required Adjustments**:
- [ ] Verify profile picture URL generation matches OpenAPI examples
- [ ] Add proper validation for 5MB file size limit
- [ ] Ensure response DTOs match OpenAPI schema exactly

### 3. User Preferences Management (`/users/preferences`)

**Status**: ❌ **Missing Completely**

**Missing Implementation**:
- [ ] Create preferences controller (`/users/preferences` GET/PUT)
- [ ] Create preference entities/database schema
- [ ] Implement preference service logic
- [ ] Create DTOs for notification, display, and privacy preferences
- [ ] Database schema for user preferences (notifications, display, privacy settings)

**Database Schema Needed**:
```sql
CREATE TABLE user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  notifications_email_enabled BOOLEAN DEFAULT TRUE,
  notifications_push_enabled BOOLEAN DEFAULT TRUE,
  notifications_sms_enabled BOOLEAN DEFAULT FALSE,
  -- Add all preference fields from OpenAPI
  updated_date TIMESTAMP DEFAULT NOW()
);
```

### 4. KYC Management (`/users/kyc/*`)

**Status**: ✅ **Implemented**
- **Controller**: `src/modules/users/kyc/kyc.controller.ts`
- **Endpoints**:
  - `GET /users/kyc/status` - ✅ Implemented (`GET /users/kyc`)
  - `POST /users/kyc/submit` - ✅ Implemented (`POST /users/kyc`)
- **Database**: `user_kycs` table fully implemented with triggers
- **File Upload**: Multi-file upload for ID card and selfie

**Required Adjustments**:
- [ ] Verify URL paths match OpenAPI spec exactly (`/kyc/status` vs `/kyc`)
- [ ] Ensure response schemas match OpenAPI examples
- [ ] Add proper canResubmit logic based on rejection status

### 5. Institution Management

**Status**: ⚠️ **Partially Implemented**

**Implemented**:
- ✅ `POST /institutions` - Institution application
- ✅ `POST /institutions/invitations` - Send invitations
- ✅ `PATCH /institutions/invitations/:id` - Accept/reject invitations
- ✅ Database schemas for institution_applications and institution_invitations

**Missing**:
- [ ] `GET /institutions/{id}` - Get institution details
- [ ] `GET /institutions/{id}/members` - List institution members
- [ ] `DELETE /institutions/{id}/members/{userId}` - Remove members
- [ ] `GET /institutions/{id}/invitations` - List pending invitations
- [ ] `GET /institutions/{id}/status` - Get application status
- [ ] `POST /institutions/invitations/{id}/resend` - Resend invitations
- [ ] `DELETE /institutions/invitations/{id}` - Cancel invitations
- [ ] `GET /institutions/invitations/{id}` - Get invitation details
- [ ] `POST /institutions/invitations/{id}/accept` - Accept invitations
- [ ] `POST /institutions/invitations/{id}/reject` - Reject invitations
- [ ] `GET /user/institutions` - Get user's institution memberships

**Controllers to Create**:
```typescript
// src/modules/institutions/institution-details.controller.ts
// src/modules/institutions/institution-members.controller.ts
// src/modules/institutions/institution-invitations.controller.ts
```

### 6. Notification Management (`/notifications/*`)

**Status**: ❌ **Missing API Endpoints**

**Existing Infrastructure**:
- ✅ Database schema exists (`notifications` table)
- ✅ Notification service and composers exist
- ✅ Queue processing for notifications

**Missing API Endpoints**:
- [ ] `GET /notifications` - List user notifications
- [ ] `PATCH /notifications/{id}/read` - Mark as read
- [ ] `PATCH /notifications/mark-all-read` - Mark all as read
- [ ] `PATCH /notifications/{id}/archive` - Archive notification
- [ ] `DELETE /notifications/{id}/delete` - Delete notification

**Controller to Create**:
```typescript
// src/modules/notifications/notification.controller.ts
@Controller('notifications')
export class NotificationController {
  // Implement all notification endpoints
}
```

**Missing Schema Fields**:
```sql
ALTER TABLE notifications ADD COLUMN archived_date TIMESTAMP;
ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
```

### 7. Phone Verification

**Status**: ⚠️ **Database Ready, API Missing**

**Existing**:
- ✅ Database fields: `phone_number`, `phone_number_verified`
- ✅ Better Auth integration likely supports phone verification

**Missing**:
- [ ] Phone verification endpoints
- [ ] SMS integration for verification codes
- [ ] Phone number validation

### 8. Enhanced Features from OpenAPI

**Missing Advanced Features**:
- [ ] Feature unlock status logic based on verification levels
- [ ] Required verifications array in user profile responses
- [ ] Portfolio analytics integration
- [ ] Advanced institution role permissions and restrictions
- [ ] Comprehensive error response schemas with request IDs

## Database Schema Gaps

### User Preferences Table (Missing)
```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) UNIQUE,
  -- Notification preferences
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  push_notifications_enabled BOOLEAN DEFAULT TRUE,
  sms_notifications_enabled BOOLEAN DEFAULT FALSE,
  email_payment_alerts BOOLEAN DEFAULT TRUE,
  email_loan_updates BOOLEAN DEFAULT TRUE,
  email_system_notifications BOOLEAN DEFAULT TRUE,
  email_marketing_communications BOOLEAN DEFAULT FALSE,
  push_payment_alerts BOOLEAN DEFAULT TRUE,
  push_loan_updates BOOLEAN DEFAULT FALSE,
  push_system_notifications BOOLEAN DEFAULT TRUE,
  push_marketing_communications BOOLEAN DEFAULT FALSE,
  sms_payment_alerts BOOLEAN DEFAULT FALSE,
  sms_loan_updates BOOLEAN DEFAULT FALSE,
  sms_system_notifications BOOLEAN DEFAULT FALSE,
  sms_marketing_communications BOOLEAN DEFAULT FALSE,
  -- Display preferences
  theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  language VARCHAR(5) DEFAULT 'en' CHECK (language IN ('en', 'es', 'fr', 'de', 'it')),
  currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD')),
  timezone VARCHAR(50) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY' CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  number_format VARCHAR(10) DEFAULT 'en-US',
  -- Privacy preferences
  profile_visibility VARCHAR(10) DEFAULT 'private' CHECK (profile_visibility IN ('private', 'public')),
  analytics_data_sharing BOOLEAN DEFAULT TRUE,
  third_party_integrations BOOLEAN DEFAULT FALSE,
  market_research BOOLEAN DEFAULT FALSE,
  activity_tracking BOOLEAN DEFAULT TRUE,
  created_date TIMESTAMP DEFAULT NOW(),
  updated_date TIMESTAMP DEFAULT NOW()
);
```

### Notification Table Enhancements
```sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_date TIMESTAMP;
-- Note: is_read can be computed from read_date IS NOT NULL
```

## Implementation Priority

### High Priority (Core Features)
1. **User Preferences Management** - Complete missing implementation
2. **Notification API Endpoints** - Leverage existing infrastructure
3. **Complete Institution Member Management** - Fill missing endpoints
4. **Fix User Type Selection HTTP method** - Quick alignment with spec

### Medium Priority (Enhanced Features)
5. **Phone Verification API** - Implement missing endpoints
6. **Advanced Institution Features** - Status tracking, member management
7. **Enhanced Error Responses** - Add request IDs and detailed error schemas

### Low Priority (Nice to Have)
8. **Portfolio Analytics Integration** - Complex feature requiring financial data
9. **Advanced Permission System** - Role-based restrictions and permissions
10. **Feature Unlock Logic** - Complex verification level calculations

## File Structure for Missing Implementations

```
src/modules/
├── users/
│   ├── preferences/
│   │   ├── preferences.controller.ts          # NEW
│   │   ├── preferences.service.ts            # NEW
│   │   ├── preferences.module.ts             # NEW
│   │   └── dto/
│   │       ├── user-preferences-response.dto.ts     # NEW
│   │       └── user-preferences-update-request.dto.ts # NEW
│   └── phone/
│       ├── phone-verification.controller.ts  # NEW
│       └── phone-verification.service.ts     # NEW
├── institutions/
│   ├── institution-details.controller.ts     # NEW
│   ├── institution-members.controller.ts     # NEW
│   └── institution-invitations.controller.ts # NEW
└── notifications/
    └── notification.controller.ts            # NEW
```

## Conclusion

The current implementation covers approximately **60%** of the OpenAPI specification. The core features like user profiles, KYC, and basic institution management are well implemented. However, significant gaps exist in user preferences, notification API endpoints, and advanced institution management features.

The database schemas are mostly complete and well-designed, which provides a solid foundation for implementing the missing API endpoints. The main work required is creating controllers, services, and DTOs for the missing endpoints rather than fundamental architectural changes.