# Institution Registration API Audit Report

## Executive Summary

This audit report analyzes the discrepancies between the Institution Registration UI textual description and the API documentation. The UI describes a comprehensive 3-step institution registration process, but several critical gaps exist in the API specification that would prevent proper implementation of the described user experience.

## Scope

- **UI Source of Truth**: `docs/ui-descriptions/user-kyc-institution.md`
- **API Documentation Audited**:
  - `docs/api-plan/user-openapi.yaml`
  - `docs/api-plan/better-auth.yaml`
  - `docs/api-plan/finance-openapi.yaml`
  - `docs/api-plan/loan-market-openapi.yaml`
  - `docs/api-plan/loan-agreement-openapi.yaml`

## Discrepancy Analysis

### D1: Missing Institution Registration Endpoint

**Issue**: The UI describes a complete institution registration process, but no corresponding API endpoint exists for submitting institution applications.

**UI Requirement**: The UI flow shows a "Submit Application" button on the final review page that should submit the complete institution registration data.

**API Gap**: No POST endpoint for institution registration exists. The `user-openapi.yaml` only contains:
- `POST /institutions` - but this is described as "Apply for institution account" without clear request/response structure
- Missing comprehensive request schema for all UI fields

**Data Example**: The UI collects:
```
Basic Business Information:
- Business Name: "PT. Example Company"
- Business Description: "01234567890123455"
- Business Type: [Dropdown selection]
- Tax ID (NPWP): "12345678901234555"
- Business Registration Number (NIB): "01234567890123455"
- Establishment Number: "AHU-123949404"

Address Information:
- Province: [Dropdown]
- City/Regency: "Jakarta"
- District: "Kecamatan"
- Sub District: "Kelurahan"
- Street Address: "Jl. Example Street No. 123"
- Postal Code: [Field shows same as street address - likely UI error]

Director Information:
- Director Name: "Ahmad Rizki Pratama"

Documents:
- NPWP Certificate (PDF/JPG/PNG, max 10MB)
- Business Registration (NIB)
- Deed of Establishment
- Ministry of Law and Human Rights approval
- Director ID Card
```

**Required Fix**: Create comprehensive `POST /institutions` endpoint with complete request schema matching all UI fields.

### D4: Missing Terms and Conditions API Integration

**Issue**: The UI shows 4 specific agreement checkboxes that must be accepted before submission, but no API support exists for this requirement.

**UI Requirement**: 4 mandatory agreement checkboxes:
1. "Institution Agreement"
2. "Compliance with Indonesian Financial Regulations"
3. "Platform Terms of Service"
4. "Anti-Money Laundering (AML) Compliance"

**API Gap**: No API fields or validation for terms acceptance in institution registration.

**Data Example**: Final submission should include:
```json
{
  "termsAccepted": {
    "institutionAgreement": true,
    "regulatoryCompliance": true,
    "platformTerms": true,
    "amlCompliance": true
  },
  "acceptanceTimestamp": "2025-09-23T15:30:00Z"
}
```

**Required Fix**: Add terms acceptance validation to institution registration API.

### D5: Missing Application Status and Review Timeline API

**Issue**: The UI shows processing information (3-5 business days, email updates, additional documentation requests), but no API support exists for application tracking.

**UI Requirement**:
- "Review typically takes 3-5 business days"
- "You'll receive email updates on application status"
- "Additional documentation may be requested"

**API Gap**: While `GET /institutions/my-application-status` exists, it lacks:
- Detailed timeline information
- Communication preferences
- Additional document request handling

**Data Example**: User needs to track application:
```json
{
  "applicationStatus": "UnderReview",
  "estimatedCompletionDate": "2025-09-28T00:00:00Z",
  "daysSinceSubmission": 2,
  "remainingBusinessDays": 3,
  "lastStatusUpdate": "2025-09-25T14:30:00Z",
  "additionalDocumentsRequested": []
}
```

**Required Fix**: Enhance status endpoint with comprehensive tracking information.
