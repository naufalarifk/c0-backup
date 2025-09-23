# Institution KYC Registration API Audit Report

**Date**: 2025-09-22
**Scope**: Institution KYC Registration Flow
**Source of Truth**: `docs/ui-descriptions/user-kyc-institution.md`
**API Files Audited**: better-auth.yaml, user-openapi.yaml, finance-openapi.yaml, loan-market-openapi.yaml, loan-agreement-openapi.yaml

## Executive Summary

This audit compares the institution KYC registration UI flow (4-step process) with the current API implementation. The analysis reveals significant architectural gaps between the UI requirements and API capabilities, particularly in multi-step workflow support, draft management, and document handling.

**Critical Findings**: The current API provides only a single monolithic submission endpoint while the UI requires a sophisticated 4-step progressive workflow with draft saving, individual step validation, and dynamic document management.

## UI Flow Analysis (Source of Truth)

The institution KYC registration process consists of 4 distinct steps:

1. **Step 1: Information Collection**
   - Business details (name, registration number, NPWP)
   - Address with cascading dropdowns (Province ’ City ’ District ’ Sub-district)
   - Director information (name, phone, email)
   - Navigation: Next button (validates step before proceeding)

2. **Step 2: Document Upload (Empty State)**
   - File upload zones for required documents
   - Drag & drop functionality
   - File format and size restrictions
   - Navigation: Previous/Next buttons

3. **Step 3: Document Upload (Completed State)**
   - View uploaded documents
   - Individual file management (download, replace, delete)
   - Upload progress indicators
   - Navigation: Previous/Next buttons

4. **Step 4: Review and Submission**
   - Summary of all entered information
   - Document verification checklist
   - Terms and conditions acceptance
   - Final submission with confirmation

## API Implementation Analysis

### Current API Structure

**Primary Endpoint**: `POST /institutions` (user-openapi.yaml)
- Single submission endpoint for complete application
- Requires all fields in one request
- Uses `multipart/form-data` for file uploads
- No support for progressive workflow

### Critical Discrepancies

#### 1. Multi-Step Workflow Support   **CRITICAL**

**UI Requirement**: 4-step progressive workflow with individual step validation
**API Implementation**: Single monolithic submission endpoint
**Impact**: Complete architectural mismatch

**Issues**:
- No API endpoints for individual step submission/validation
- No draft saving capability for partial progress
- No step-by-step navigation support
- Users cannot save progress and return later

#### 2. Draft Management   **HIGH**

**UI Requirement**: Ability to save progress at each step
**API Implementation**: Missing entirely
**Impact**: Poor user experience, data loss risk

**Missing APIs**:
- `POST /institutions/draft` - Save partial application
- `GET /institutions/draft/{id}` - Retrieve saved draft
- `PUT /institutions/draft/{id}` - Update draft
- `DELETE /institutions/draft/{id}` - Delete draft

#### 3. Document Upload Flow   **HIGH**

**UI Requirement**: Progressive document upload with individual file management
**API Implementation**: All-or-nothing multipart upload
**Impact**: Inflexible document handling

**Issues**:
- Cannot upload documents individually across steps
- No file replacement or deletion endpoints
- Missing file validation per upload
- No upload progress tracking support

#### 4. Location Data APIs   **MEDIUM**

**UI Requirement**: Cascading dropdowns (Province ’ City ’ District ’ Sub-district)
**API Implementation**: Missing location lookup endpoints
**Impact**: Frontend must hardcode location data

**Missing APIs**:
- `GET /locations/provinces`
- `GET /locations/cities/{provinceId}`
- `GET /locations/districts/{cityId}`
- `GET /locations/subdistricts/{districtId}`

#### 5. Field Validation Mismatches   **MEDIUM**

**UI Fields vs API Schema**:

| UI Field | API Field | Status | Issue |
|----------|-----------|---------|-------|
| Business Name | businessName |  Match | - |
| Registration Number | registrationNumber |  Match | - |
| NPWP Number | npwpNumber |  Match | - |
| Province/City/etc | address | L Mismatch | UI has structured fields, API expects single address |
| Director Phone | - | L Missing | No director-specific fields in API |
| Director Email | - | L Missing | No director-specific fields in API |

#### 6. Terms and Conditions   **LOW**

**UI Requirement**: Terms acceptance tracking with version
**API Implementation**: Missing terms validation
**Impact**: No audit trail for legal compliance

## Recommendations

### Priority 1: Multi-Step API Design

Implement progressive workflow endpoints:

```yaml
# Step 1: Business Information
POST /institutions/steps/business-info
PUT /institutions/{id}/steps/business-info
GET /institutions/{id}/steps/business-info

# Step 2-3: Document Management
POST /institutions/{id}/documents
GET /institutions/{id}/documents
DELETE /institutions/{id}/documents/{documentId}
PUT /institutions/{id}/documents/{documentId}

# Step 4: Final Submission
POST /institutions/{id}/submit
GET /institutions/{id}/status
```

### Priority 2: Draft Management System

```yaml
# Draft Operations
POST /institutions/draft          # Create new draft
GET /institutions/draft/{id}      # Get draft
PUT /institutions/draft/{id}      # Update draft
DELETE /institutions/draft/{id}   # Delete draft
GET /institutions/drafts          # List user's drafts
```

### Priority 3: Enhanced Document Handling

```yaml
# Individual File Upload
POST /institutions/{id}/documents/upload
Content-Type: multipart/form-data

# File Management
GET /institutions/{id}/documents/{docId}/download
PUT /institutions/{id}/documents/{docId}/replace
DELETE /institutions/{id}/documents/{docId}
```

### Priority 4: Location Lookup APIs

```yaml
# Cascading Location Data
GET /locations/provinces
GET /locations/cities?province={id}
GET /locations/districts?city={id}
GET /locations/subdistricts?district={id}
```

### Priority 5: Enhanced Validation

- Add director-specific fields to schema
- Implement step-by-step validation rules
- Add terms and conditions tracking
- Structured address fields instead of single text

## Implementation Impact

### Frontend Changes Required
- Implement multi-step form state management
- Add draft save/restore functionality
- Implement progressive document upload
- Add location cascading dropdowns

### Backend Changes Required
- New controller endpoints for step-by-step workflow
- Draft persistence layer
- Document management service
- Location data service
- Enhanced validation pipeline

### Database Schema Changes
- Add draft storage table
- Document metadata tracking
- Terms acceptance audit log
- Structured address fields

## Risk Assessment

**High Risk**: Current API cannot support the designed UI flow without significant refactoring.

**Medium Risk**: Data integrity issues without proper draft management and step validation.

**Low Risk**: User experience degradation due to missing progressive features.

## Conclusion

The audit reveals fundamental architectural gaps between the UI design and API implementation. The current single-endpoint approach cannot support the sophisticated 4-step workflow described in the UI specification. A complete API redesign is required to properly support the intended user experience.

**Recommended Action**: Prioritize implementation of multi-step workflow APIs before frontend development proceeds, as the current API architecture is incompatible with the designed user flow.