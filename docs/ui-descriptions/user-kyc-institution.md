# Institution Registration UI Description

This document describes the user interface flow for institutional KYC (Know Your Customer) registration. The process consists of three main steps arranged in logical order: Information, Documents, and Review.

## Page Flow Overview

The registration process follows this sequence:
1. **Institution Registration Information** - Basic business and director information collection
2. **Institution Registration Documents** - Document upload interface (empty state)
3. **Institution Registration Documents** - Document upload interface (completed state)
4. **Institution Registration Review** - Final review and submission

## Page 1: Institution Registration Information

### Header Section
- **Page Title**: "Institution Registration"
- **Progress Indicator**: "Step 1 of 3" with 33% completion bar
- **Navigation Tabs**: Information (active), Documents, Review
- **Back Button**: Arrow icon for navigation

### Basic Business Information Section
- **Section Title**: "Basic business information"

#### Business Name Field
- **Component Type**: Text input field
- **Label**: "Business Name"
- **Content**: "PT. Example Company"
- **Function**: Allows user to enter the official business name
- **Interaction**: User can type or edit the business name

#### Business Description Field
- **Component Type**: Text input field
- **Label**: "Business Description"
- **Content**: "01234567890123455"
- **Function**: Allows user to describe the business activities
- **Interaction**: User can type business description

#### Business Type Field
- **Component Type**: Dropdown menu
- **Label**: "Business Type"
- **Content**: "Select business type" (placeholder)
- **Function**: Allows user to select from predefined business categories
- **Interaction**: User clicks dropdown to reveal options

#### Tax ID (NPWP) Field
- **Component Type**: Text input field
- **Label**: "Tax ID (NPWP)"
- **Content**: "12345678901234555"
- **Function**: Collects Indonesian tax identification number
- **Interaction**: User enters numerical tax ID

#### Business Registration Number (NIB) Field
- **Component Type**: Text input field
- **Label**: "Business Registration Number (NIB)"
- **Content**: "01234567890123455"
- **Function**: Collects business registration number
- **Interaction**: User enters business registration number

#### Establishment Number Field
- **Component Type**: Text input field
- **Label**: "Establishment Number (Akta Pendirian)"
- **Content**: "AHU-123949404"
- **Function**: Collects company establishment document number
- **Interaction**: User enters establishment number

### Business Address Information Section
- **Section Title**: "Business Address Information"

#### Province and City/Regency Fields
- **Component Type**: Two-column layout with dropdowns
- **Left Field**:
  - **Label**: "Province"
  - **Content**: "Select province" (placeholder)
  - **Function**: Geographic location selection
- **Right Field**:
  - **Label**: "City/Regency"
  - **Content**: "Jakarta"
  - **Function**: More specific location within province
- **Interaction**: Users select from dropdown menus

#### District and Sub District Fields
- **Component Type**: Two-column layout with dropdowns
- **Left Field**:
  - **Label**: "District"
  - **Content**: "Kecamatan"
  - **Function**: District level location
- **Right Field**:
  - **Label**: "Sub District"
  - **Content**: "Kelurahan"
  - **Function**: Sub-district level location
- **Interaction**: Users select from dropdown menus

#### Street Address Field
- **Component Type**: Text input field
- **Label**: "Street Address"
- **Content**: "Jl. Example Street No. 123"
- **Function**: Detailed street address input
- **Interaction**: User types complete street address

#### Postal Code Field
- **Component Type**: Text input field
- **Label**: "Postal Code"
- **Content**: "Jl. Example Street No. 123"
- **Function**: Postal code for the address
- **Interaction**: User enters postal code

### Director/Owner Information Section
- **Section Title**: "Director/Owner Information"

#### Director Name Field
- **Component Type**: Text input field
- **Label**: "Director Name"
- **Content**: "Ahmad Rizki Pratama"
- **Function**: Collects name of company director/owner
- **Interaction**: User enters director's full name

### Navigation
- **Primary Action Button**: "Continue to Documents"
- **Component Type**: Blue primary button
- **Function**: Proceeds to document upload step
- **Interaction**: User clicks to advance to next step

## Page 2: Institution Registration Documents (Empty State)

### Header Section
- **Page Title**: "Institution Registration"
- **Progress Indicator**: "Step 2 of 3" with 67% completion bar
- **Navigation Tabs**: Information, Documents (active), Review
- **Back Button**: Arrow icon for navigation

### Document Upload Sections

#### NPWP Section
- **Section Title**: "NPWP"
- **Subtitle**: "NPWP Sertifikat"
- **Upload Area**:
  - **Component Type**: File upload zone with cloud upload icon
  - **Action Button**: "Choose File"
  - **File Types**: "PDF, JPG, PNG (max 10MB)"
  - **Warning**: "Must match the NPWP number provided above"
- **Function**: Upload tax certificate document
- **Interaction**: User clicks "Choose File" or drags file to upload area

#### Business Registration Number (NIB) Section
- **Section Title**: "Business Registration Number (NIB)"
- **Subtitle**: "Nomor Induk Berusaha"
- **Upload Area**: Same format as NPWP section
- **Warning**: "Must be notarized and show current business name"
- **Function**: Upload business registration document
- **Interaction**: File upload via button or drag-and-drop

#### Deed of Establishment Section
- **Section Title**: "Deed of Establishment"
- **Subtitle**: "Akta Pendirian"
- **Upload Area**: Same format as other sections
- **Warning**: "Business overview and financial capacity information"
- **Function**: Upload company establishment deed
- **Interaction**: File upload via button or drag-and-drop

#### Ministry of Law and Human Rights Section
- **Section Title**: "Ministry of Law and Human Rights"
- **Subtitle**: "SK Kemenkumham"
- **Upload Area**: Same format as other sections
- **Warning**: "Must be notarized and show current business name"
- **Function**: Upload ministry approval document
- **Interaction**: File upload via button or drag-and-drop

#### Director ID Card Section
- **Section Title**: "Director ID Card"
- **Subtitle**: "KTP Direksi"
- **Upload Area**: Same format as other sections
- **Function**: Upload director's identification document
- **Interaction**: File upload via button or drag-and-drop

### Document Guidelines Section
- **Section Title**: "Document Guidelines"
- **Guidelines List**:
  - "Ensure all text is clearly readable"
  - "Documents should be recent (within 6 months)"
  - "Notarized documents preferred"
  - "Contact support if you need help with specific documents"
- **Component Type**: Checklist with green checkmarks
- **Function**: Provides document quality requirements

### Navigation
- **Primary Action Button**: "Continue to Review"
- **Secondary Action Button**: "Back"
- **Function**: Navigate between steps
- **Interaction**: User clicks to proceed or return

## Page 3: Institution Registration Documents (Completed State)

### Header Section
- **Page Title**: "Institution Registration"
- **Progress Indicator**: "Step 2 of 3" with 67% completion bar
- **Navigation Tabs**: Information, Documents (active), Review

### Uploaded Documents Display

#### NPWP Section
- **Document Display**:
  - **File Icon**: PDF icon
  - **Filename**: "npwp_certificate.pdf"
  - **File Size**: "120 KB of 120 KB"
  - **Status**: "Completed" (green text)
  - **Action Icon**: Remove/delete option (X)
- **Warning**: "Must match the NPWP number provided above"

#### Business Registration Number (NIB) Section
- **Document Display**:
  - **File Icon**: PDF icon
  - **Filename**: "bussiness_registr.pdf"
  - **File Size**: "120 KB of 120 KB"
  - **Status**: "Completed" (green text)
  - **Action Icon**: Remove/delete option (X)
- **Warning**: "Must be notarized and show current business name"

#### Deed of Establishment Section
- **Document Display**:
  - **File Icon**: JPG icon
  - **Filename**: "deed_establishment.jpg"
  - **File Size**: "120 KB of 120 KB"
  - **Status**: "Completed" (green text)
  - **Action Icon**: Remove/delete option (X)
- **Warning**: "Business overview and financial capacity information"

#### Ministry of Law and Human Rights Section
- **Document Display**:
  - **File Icon**: PDF icon
  - **Filename**: "mol_and_hr.pdf"
  - **File Size**: "120 KB of 120 KB"
  - **Status**: "Completed" (green text)
  - **Action Icon**: Remove/delete option (X)
- **Warning**: "Must be notarized and show current business name"

#### Director ID Card Section
- **Document Display**:
  - **File Icon**: PNG icon
  - **Filename**: "director_id.png"
  - **File Size**: "120 KB of 120 KB"
  - **Status**: "Completed" (green text)
  - **Action Icon**: Remove/delete option (X)

### Document Guidelines Section
- **Same as empty state**
- **Function**: Continues to display upload requirements

### Navigation
- **Primary Action Button**: "Continue to Review"
- **Secondary Action Button**: "Back"
- **Function**: Navigate between steps
- **Interaction**: User can proceed to review or go back to edit

## Page 4: Institution Registration Review

### Header Section
- **Page Title**: "Institution Registration"
- **Progress Indicator**: "Step 3 of 3" with 100% completion bar
- **Navigation Tabs**: Information, Documents, Review (active)

### Application Summary Section
- **Section Title**: "Application Summary"

#### Business Information Card
- **Component Type**: Information display card
- **Content**:
  - **Business Name**: "PT Tech Solutions Indonesia"
  - **Description**: [Business description]
  - **NPWP**: "12345678901234555"
  - **Registration Number**: "12345678901234"
  - **Established Number**: "AHU-12345567"

#### Director/Owner Information Card
- **Component Type**: Information display card
- **Content**:
  - **Director Name**: [Director name displayed]

### Document Summary Section
- **Section Title**: "Document Summary"

#### Document List Display
Each document shows:
- **NPWP**:
  - **File Icon**: PDF icon
  - **Filename**: "npwp_certificated.pdf"
  - **File Size**: "1.2 MB"
  - **Status**: Green checkmark indicating completion

- **Business Registration Number (NIB)**:
  - **File Icon**: PDF icon
  - **Filename**: "bussiness(NIB).pdf"
  - **File Size**: "1.3 MB"
  - **Status**: Green checkmark

- **Deed of Establishment**:
  - **File Icon**: PDF icon
  - **Filename**: "deed_of_establishment.pdf"
  - **File Size**: "3.1 MB"
  - **Status**: Green checkmark

- **Ministry of Law and Human Rights**:
  - **File Icon**: PDF icon
  - **Filename**: "human_rights.pdf"
  - **File Size**: "2.3 MB"
  - **Status**: Green checkmark

- **Director ID Card**:
  - **File Icon**: PDF icon
  - **Filename**: "director_letter.pdf"
  - **File Size**: "2.3 MB"
  - **Status**: Green checkmark

### Terms and Conditions Section
- **Section Title**: "Terms and Conditions"

#### Agreement Checkboxes
- **Institution Agreement**:
  - **Checkbox**: Unchecked
  - **Text**: "I agree to the Institution Agreement"
  - **Subtitle**: "Terms governing institutional account usage and responsibilities"

- **Regulatory Compliance**:
  - **Checkbox**: Unchecked
  - **Text**: "Compliance with Indonesian Financial Regulations"
  - **Subtitle**: "Adherence to OJK and Bank Indonesia regulations"

- **Platform Terms**:
  - **Checkbox**: Unchecked
  - **Text**: "Platform Terms of Service"
  - **Subtitle**: "General terms and conditions for platform usage"

- **AML Compliance**:
  - **Checkbox**: Unchecked
  - **Text**: "Anti-Money Laundering (AML) Compliance"
  - **Subtitle**: "Commitment to AML policies and reporting requirements"

### Processing Information Section
- **Section Title**: "Processing Information"

#### Information Items
- **Review Timeline**:
  - **Icon**: Clock icon
  - **Text**: "Review typically takes 3-5 business days"

- **Status Updates**:
  - **Icon**: Email icon
  - **Text**: "You'll receive email updates on application status"

- **Additional Documentation**:
  - **Icon**: Document icon
  - **Text**: "Additional documentation may be requested"

### Navigation
- **Primary Action Button**: "Submit Application"
  - **Component Type**: Blue primary button
  - **Function**: Submits the complete application
  - **State**: Likely disabled until all terms are accepted
  - **Interaction**: User clicks to submit after accepting all terms

- **Secondary Action Button**: "Edit Applications"
  - **Component Type**: Text button with edit icon
  - **Function**: Allows user to return and modify information
  - **Interaction**: User clicks to edit any section

## User Interaction Flow Summary

1. **Information Entry**: Users complete all required business and director information fields
2. **Document Upload**: Users upload all required documents in supported formats
3. **Review and Acceptance**: Users review all information, accept terms and conditions
4. **Submission**: Users submit the complete application for processing

## Key UX Patterns

- **Progressive Disclosure**: Information is broken into digestible steps
- **Visual Progress**: Clear progress indicators show completion status
- **Validation**: Real-time warnings and requirements for each field
- **File Management**: Clear file status with ability to remove and re-upload
- **Confirmation**: Comprehensive review before final submission
- **Accessibility**: Clear labels, status indicators, and action buttons