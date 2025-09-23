# User KYC Individual - UI Page Descriptions

This document provides detailed textual descriptions of all UI pages in the individual KYC (Know Your Customer) verification flow. Pages are organized in the logical user journey order.

## 1. Identity Verification Start Page
**File**: `KYC Personal Identity Verification.png`

### Page Header
- **Back button**: Arrow icon on top-left for navigation
- **Title**: "Identity Verification"
- **Progress indicator**: "Step 1 of 4" with blue progress bar

### Main Content
- **Section title**: "Verification Process"

### Process Steps (4 cards)
1. **Indonesian KTP Card** (active/highlighted in blue)
   - **Icon**: ID card icon
   - **Title**: "Indonesian KTP"
   - **Description**: "Take picture of your KTP (Indonesian ID Card)"
   - **Status**: Currently active step

2. **Individual Info Card** (inactive)
   - **Icon**: User profile icon
   - **Title**: "Individual Info"
   - **Description**: "Confirm your details"
   - **Status**: Pending step

3. **Selfie with KTP Card** (inactive)
   - **Icon**: Camera icon
   - **Title**: "Selfie with KTP"
   - **Description**: "Take photo holding your KTP"
   - **Status**: Pending step

4. **Review Card** (inactive)
   - **Icon**: Checkmark icon
   - **Title**: "Review"
   - **Description**: "Submit for approval"
   - **Status**: Pending step

### Requirements Section
- **Section title**: "What you'll need :"
- **Requirements list**:
  - KTP (Indonesian ID Card) icon with text
  - Good lighting for photos icon with text
  - About 5 minutes to complete icon with text

### Privacy Section
- **Shield icon** with "Privacy & Security"
- **Description**: "Your information is encrypted and secure"

### Action Button
- **Primary button**: "Start Verification" (blue, full-width)

### User Interactions
- Users can tap the back button to exit
- Users tap "Start Verification" to begin the KYC process
- Each step card shows the verification flow but only the active step is interactable

---

## 2. KTP Scanning Camera Page
**File**: `Scan KTP.png`

### Page Header
- **Back button**: White arrow icon on top-left
- **Title**: "KTP Verification" (white text)

### Camera Interface
- **Live camera view**: Full-screen background showing hands holding a KTP
- **Scanning frame**: White rectangular border with rounded corners for KTP positioning
- **Instruction overlay**: "Position your Indonesian KTP within the frame"

### Tips Section (bottom overlay)
- **Section title**: "Tips for the best result :"
- **Tips list**:
  - "Use good lighting"
  - "Keep KTP flat"
  - "Make sure NIK and all text is clearly visible"

### Camera Controls
- **Capture button**: Large white circular button at bottom center

### User Interactions
- Users position their KTP within the white frame
- Users ensure good lighting and flat positioning
- Users tap the capture button to take the photo
- Users can tap back button to return to previous screen

---

## 3. KTP Photo Review Page
**File**: `KYC Personal KTP Verification.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "KTP Verification"

### Captured Image Section
- **KTP photo**: Shows captured Indonesian KTP image
- **Image label**: "Indonesian KTP - Front Side"
- **Timestamp**: "Captured just now"

### Quality Assessment
- **Status indicator**: Green checkmark with "Quality Check Complete"
- **Assessment description**: "Great! Your KTP is clear and NIK is readable"

### Quality Metrics
- **Image Clarity**: "Excellent" (green indicator)
- **Text Readability**: "All text visible" (green indicator)
- **NIK Visibility**: "Clear" (green indicator)

### Next Steps Section
- **Info icon** with "What happens next?"
- **Steps list**:
  - "Confirm your Individual details"
  - "Take a selfie with your KTP"
  - "Submit for verification"

### Action Buttons
- **Primary button**: "Use This Photo" (blue, full-width)
- **Secondary button**: "Retake Photo" (outlined, full-width)

### User Interactions
- Users review the captured KTP image quality
- Users can tap "Use This Photo" to proceed if satisfied
- Users can tap "Retake Photo" to capture a new image
- Users can tap back button to return to camera

---

## 4. Selfie with KTP Camera Page
**File**: `Take Selfie with KTP.png`

### Page Header
- **Back button**: White arrow icon on top-left
- **Title**: "Take Selfie with KTP" (white text)

### Camera Interface
- **Front-facing camera view**: Full-screen showing user's face
- **Face detection frame**: White rectangular border with rounded corners
- **Status indicators** (top overlays):
  - "Face Detected" (green checkmark)
  - "KTP not visible" (warning triangle)
  - "Improve lighting" (info icon)

### Instructions
- **Bottom instruction**: "Hold your KTP next to your face"
- **Sub-instruction**: "Make sure NIK is visible"

### Camera Controls
- **Capture button**: Large white circular button at bottom center

### User Interactions
- Users position their face within the detection frame
- Users hold their KTP card next to their face
- Users ensure the NIK number is visible in the photo
- Users adjust lighting as needed based on feedback
- Users tap capture button when face and KTP are properly detected
- Users can tap back button to return to previous screen

---

## 5. Selfie Photo Review Page
**File**: `KYC Personal KTP Verification-1.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "Review Photo"

### Captured Image Section
- **Selfie photo**: Shows captured selfie with user holding KTP
- **Image label**: "Take Selfie with KTP"
- **Timestamp**: "Captured just now"

### Quality Assessment
- **Status indicator**: Green checkmark with "Perfect!"
- **Assessment description**: "Your face and KTP are clearly visible"

### Quality Metrics
- **Face clearly visible**: "Excellent" (green indicator)
- **KTP details readable**: "Excellent" (green indicator)
- **Good lighting quality**: "Excellent" (green indicator)
- **NIK number visible**: "Excellent" (green indicator)

### Action Buttons
- **Primary button**: "Use This Photo" (blue, full-width)
- **Secondary button**: "Retake Photo" (outlined, full-width)

### Footer Note
- **Instruction**: "Make sure your face and KTP details are clearly visible before proceeding"

### User Interactions
- Users review the selfie image quality and visibility
- Users can tap "Use This Photo" to proceed if satisfied
- Users can tap "Retake Photo" to capture a new selfie
- Users can tap back button to return to camera

---

## 6. Individual Information Confirmation Page
**File**: `Confirm Your Information.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "Confirm Your Information"

### Individual Details Section
- **Section title**: "Individual Details"

#### Form Fields (read-only display)
1. **Full Name**
   - **Value**: "Ahmad Rizki Pratama"
   - **Type**: Text display field

2. **NIK - ID Number**
   - **Value**: "3201234567890123"
   - **Type**: Text display field

3. **Date of Birth**
   - **Value**: "1990-05-15"
   - **Icon**: Calendar icon on right
   - **Type**: Date display field

4. **Place of Birth**
   - **Value**: "Jakarta"
   - **Type**: Text display field

### Address Information Section
- **Section title**: "Address Information"

#### Address Form Fields (read-only display)
1. **Province**
   - **Value**: "DKI Jakarta"

2. **City/Regency**
   - **Value**: "Jakarta Selatan"

3. **District**
   - **Value**: "Jakarta Selatan"

4. **Sub District**
   - **Value**: "Jakarta Selatan"

5. **Street Address**
   - **Value**: "Jl. Sudirman No. 123"

6. **Postal Code**
   - **Value**: "9821990"

### Action Button
- **Primary button**: "Continue" (blue, full-width)

### User Interactions
- Users review all pre-filled information extracted from KTP
- Users verify accuracy of personal and address details
- Users tap "Continue" to proceed to next step
- Users can tap back button to return to previous screen

---

## 7. Information Review Page
**File**: `Review Your Information.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "Review Your Information"

### Photo Review Section
Two photo cards side by side:

1. **ID Card Photo**
   - **Image**: KTP front side photo
   - **Label**: "ID Card Photo"
   - **Action**: "Retake" link button

2. **Selfie Photo**
   - **Image**: Selfie with KTP photo
   - **Label**: "ID Card Photo"
   - **Action**: "Retake" link button

### Individual Information Section
- **Section title**: "Individual Information"

#### Information Display (with edit options)
1. **Full Name**
   - **Label**: "Full Name"
   - **Value**: "Ahmad Rizki Pratama"
   - **Action**: "Edit" link on right

2. **ID Number**
   - **Label**: "ID Number"
   - **Value**: "3174012345678901"
   - **Action**: "Edit" link on right

3. **Date of Birth**
   - **Label**: "Date of Birth"
   - **Value**: "January 15, 1990"
   - **Action**: "Edit" link on right

4. **Address**
   - **Label**: "Address"
   - **Value**: "Jl. Sudirman No. 123, Jakarta Pusat, DKI Jakarta 10110"
   - **Action**: "Edit" link on right

### Confirmation Section
- **Checkbox**: "I confirm this information is accurate and agree to the terms"
- **Type**: Checkbox input (unchecked state shown)

### Privacy Section
- **Shield icon** with "Privacy & Security"
- **Description**: "Your data is encrypted and will only be used for verification"

### Submit Section
- **Primary button**: "Submit for Verification" (blue, full-width)
- **Info text**: "Verification typically takes 1-2 business days"

### User Interactions
- Users review both captured photos and can retake either one
- Users review all extracted information
- Users can edit any information field by tapping "Edit"
- Users must check the confirmation checkbox to agree to terms
- Users tap "Submit for Verification" to submit their KYC application
- Users can tap back button to return to previous screen

---

## 8. Verification Process Completion Page
**File**: `KYC Personal Identity Verification-1.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "Identity Verification"
- **Progress indicator**: "All Steps Completed" with full blue progress bar

### Verification Process Summary
- **Section title**: "Verification Process"

### Completed Steps (all showing blue checkmarks)
1. **Indonesian KTP** 
   - **Title**: "Indonesian KTP"
   - **Description**: "Take picture of your KTP (Indonesian ID Card)"
   - **Status**: Completed

2. **Individual Info** 
   - **Title**: "Individual Info"
   - **Description**: "Confirm your details"
   - **Status**: Completed

3. **Selfie with KTP** 
   - **Title**: "Selfie with KTP"
   - **Description**: "Take photo holding your KTP"
   - **Status**: Completed

4. **Review** 
   - **Title**: "Review"
   - **Description**: "Submit for approval"
   - **Status**: Completed

5. **Verification Complete** 
   - **Title**: "Verification Complete"
   - **Description**: "All requirements have been successfully fulfilled"
   - **Status**: Final completion (green background)

### Requirements Met Section
- **Section title**: "What you'll need :"
- **Completed requirements** (all with green checkmarks):
  - "Indonesian KTP (Kartu Tanda Penduduk)"
  - "Good lighting for photos"
  - "About 5 minutes to complete"

### Privacy Section
- **Shield icon** with "Privacy & Security"
- **Description**: "Your information is encrypted and secure"

### Action Button
- **Primary button**: "Submit for Review" (blue, full-width)

### User Interactions
- Users see all verification steps completed
- Users can review the completed process summary
- Users tap "Submit for Review" to finalize submission
- Users can tap back button if they need to make changes

---

## 9. Verification Submitted Status Page
**File**: `Verification Status Submitted.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "Verification Status"

### Status Section
- **Status icon**: Large green circle with checkmark
- **Status title**: "Verification Submitted!"
- **Status description**: "Your identity verification has been sent for review"

### Reference Information
- **Reference card**: Light gray background
- **Label**: "Reference Number"
- **Value**: "KYC-123456"
- **Note**: "Keep this for support inquiries"

### Next Steps Section
- **Section title**: "What happens next:"
- **Steps list**:
  1. "Our team will review your information"
  2. "You'll receive an email when complete"
  3. "This usually takes 1-2 business days"

### Action Buttons
- **Primary button**: "Return to Profile" (blue, full-width)
- **Secondary button**: "Contact Support" (outlined, full-width)

### User Interactions
- Users note their reference number for future inquiries
- Users can return to their profile by tapping "Return to Profile"
- Users can contact support if needed by tapping "Contact Support"
- Users can tap back button to navigate back

---

## 10. Under Review Status Page
**File**: `Verification Status Under review.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "Verification Status"

### Status Section
- **Status icon**: Large orange circle with clock icon
- **Status title**: "Under Review"
- **Status description**: "Your verification is being processed"

### Submission Details
- **Information card**:
  - **Submitted on**: "January 15, 2025"
  - **Reference ID**: "#KYC-2025-001234"

### Verification Progress Section
- **Section title**: "Verification Progress"

#### Progress Steps
1. **Documents Received** 
   - **Status**: Completed (blue checkmark)
   - **Timestamp**: "January 15, 2025 at 2:30 PM"

2. **Under Review** (current)
   - **Status**: In progress (blue dot)
   - **Description**: "Currently in progress"

3. **Verification Complete**
   - **Status**: Pending (gray circle)
   - **Description**: "Pending"

### Timeline Information
- **Estimated Completion card**:
  - **Icon**: Clock icon
  - **Title**: "Estimated Completion"
  - **Description**: "1-2 business days from submission"
  - **Expected date**: "Expected by: January 17, 2025"

### Notification Information
- **Stay Updated card**:
  - **Icon**: Email icon
  - **Title**: "Stay Updated"
  - **Description**: "We'll send you an email notification when your verification is complete"

### Help Section
- **Section title**: "Need Help?"
- **Contact option**: "Contact Support" with arrow icon

### Action Button
- **Primary button**: "Back to Dashboard" (blue, full-width)

### User Interactions
- Users can monitor their verification progress
- Users can contact support if they have questions
- Users can return to dashboard by tapping "Back to Dashboard"
- Users can tap back button to navigate back

---

## 11. Verification Approved Status Page
**File**: `Verification Status Verified.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "Verification Status"

### Status Section
- **Status icon**: Large green circle with checkmark
- **Status title**: "Verified"
- **Status description**: "Your identity has been successfully verified"

### Verification Confirmation
- **Confirmation card**:
  - **Icon**: Calendar with checkmark
  - **Date**: "Verified on January 15, 2025"
  - **Message**: "Your account is fully verified"

### Available Services Section
- **Section title**: "Verification Progress"

#### Unlocked Features
1. **Apply for Crypto Loans**
   - **Icon**: Document icon
   - **Description**: "Access all lending services with your verified account"

2. **Provide Funding**
   - **Icon**: Coins icon
   - **Description**: "Earn interest by funding crypto loans"

3. **Higher Limits**
   - **Icon**: Chart icon
   - **Description**: "Access to premium lending limits and rates"

### Verification Details Section
- **Section title**: "Verification Details:"

#### Completed Verifications (all with green checkmarks)
1. **Indonesian KTP** 
   - **Status**: Verified

2. **Individual Information** 
   - **Status**: Verified

3. **Selfie Verification** 
   - **Status**: Verified

### Action Button
- **Primary button**: "Back to Dashboard" (blue, full-width)

### User Interactions
- Users can see their successful verification status
- Users understand what services are now available
- Users can return to dashboard to access new features
- Users can tap back button to navigate back

---

## 12. Verification Rejected Status Page
**File**: `Verification Status Rejected.png`

### Page Header
- **Back button**: Arrow icon on top-left
- **Title**: "Verification Status"

### Status Section
- **Status icon**: Large red circle with X mark
- **Status title**: "Needs Attention"
- **Status description**: "Review required"

### Issue Information
- **Warning card**:
  - **Icon**: Warning triangle
  - **Date**: "Verified on January 15, 2025"
  - **Issue description**: "Your KTP photo is unclear and cannot be verified. The document appears blurry and some text is not readable."

### Resolution Instructions
- **Section title**: "How to fix this:"

#### Steps to Resolve
1. "Take a new photo of your KTP in good lighting"
2. "Ensure all text on the KTP is clearly visible"
3. "Hold the camera steady to avoid blur"
4. "Make sure the entire KTP fits within the frame"

### Tips Section
- **Photo Tips card**:
  - **Icon**: Lightbulb icon
  - **Title**: "Photo Tips"
  - **Description**: "Use natural lighting, avoid shadows, and ensure your KTP is flat against a dark background"

### Action Buttons
- **Primary button**: "Start New Verification" (blue, full-width)
- **Secondary button**: "Contact Support" (outlined, full-width)

### User Interactions
- Users understand why their verification was rejected
- Users can start a new verification process by tapping "Start New Verification"
- Users can contact support for assistance by tapping "Contact Support"
- Users can tap back button to navigate back

---

## Summary

This KYC individual verification flow consists of 12 distinct pages that guide users through:

1. **Onboarding**: Introduction to the verification process and requirements
2. **Document Capture**: KTP scanning with real-time feedback and quality checks
3. **Selfie Capture**: Selfie with KTP document verification
4. **Information Review**: Confirmation and editing of extracted data
5. **Submission**: Final review and submission of verification request
6. **Status Tracking**: Multiple status pages for submitted, under review, approved, and rejected states

Each page provides clear navigation, status feedback, and appropriate user actions to complete the KYC verification process successfully.