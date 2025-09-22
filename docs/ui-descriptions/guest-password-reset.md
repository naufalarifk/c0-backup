# Guest Password Reset UI Flow - Textual Descriptions

This document provides detailed textual descriptions of the guest password reset UI flow. The pages are organized in semantic logical order representing the typical user journey.

## 1. Password Reset Request Page (Initial State)

**File:** `Reset Password.png`

### Page Structure
- **Header:** Mobile status bar showing time "09:41", signal strength, WiFi, and battery icons
- **Navigation:** Back arrow button with "Reset Password" title
- **Main Content:** Centered form layout

### Form Elements
- **Instructional Text:** "Enter your email and we'll send you a reset link"
- **Email Address Label:** "Email Address"
- **Email Input Field:**
  - Component: Text input field
  - Placeholder: "Enter your email address..."
  - Function: Accepts user's email address for password reset
  - User Interaction: Tap to focus and enter email address
- **Send Reset Link Button:**
  - Component: Primary action button (blue background)
  - Text: "Send Reset Link"
  - Function: Submits email for password reset link generation
  - User Interaction: Tap to send reset email

### Footer Elements
- **Helper Text:** "Remember your password?"
- **Sign In Link:** "Back to Sign In" (clickable link)
  - Function: Navigate back to sign-in page
  - User Interaction: Tap to return to login

---

## 2. Password Reset Request Page (Error States)

### 2a. Invalid Link Error

**File:** `Indicatior invalid link.png`

Same layout as initial state with additional error alert:
- **Error Alert Component:**
  - Type: Warning alert (orange background)
  - Icon: Warning triangle icon
  - Title: "Invalid Link"
  - Message: "This reset link is not valid. Please request a new one."
  - Function: Informs user that the reset link is invalid
  - User Interaction: User must request a new reset link

### 2b. Expired Link Error

**File:** `Indicatior link has expired.png`

Same layout as initial state with additional error alert:
- **Error Alert Component:**
  - Type: Warning alert (orange background)
  - Icon: Warning triangle icon
  - Message: "This reset link has expired. Please request a new one."
  - Function: Informs user that the reset link has expired
  - User Interaction: User must request a new reset link

### 2c. Server Error

**File:** `Indicatior server error.png`

Same layout as initial state with additional error alert:
- **Error Alert Component:**
  - Type: Error alert (red background)
  - Icon: Error circle icon
  - Title: "Server Error"
  - Message: "Something went wrong. Please try again or contact support."
  - Function: Informs user of technical issues
  - User Interaction: User can retry or contact support

---

## 3. New Password Creation Page (Empty State)

**File:** `Reset Your Password.png`

### Page Structure
- **Header:** Mobile status bar and CryptoGadai logo
- **Brand Logo:** CryptoGadai shield logo with company name

### Main Content
- **Page Title:** "Reset Your Password"
- **Expiration Notice:**
  - Component: Info banner (gray background)
  - Icon: Clock icon
  - Text: "Reset link expires in 24 hours"
  - Function: Informs user of time limitation

### Form Fields
- **Password Section:**
  - Label: "Password"
  - Input Field: Password input with eye icon for visibility toggle
  - Placeholder: "Enter new password..."
  - Strength Indicator: "Password strength: Weak"
  - User Interaction: Enter new password, toggle visibility

- **Confirm Password Section:**
  - Label: "Confirm Password"
  - Input Field: Password input with eye icon for visibility toggle
  - Placeholder: "Confirm new password..."
  - User Interaction: Re-enter password for confirmation

### Action Button
- **Reset Password Button:**
  - Component: Primary button (disabled/gray state)
  - Text: "Reset Password"
  - Function: Submits new password (currently disabled)
  - User Interaction: Becomes active when valid passwords are entered

### Security Information
- **Security Tips Section:**
  - Icon: Shield icon
  - Title: "Security Tips"
  - Tips List:
    - "Choose a unique password"
    - "Don't reuse passwords from other accounts"
    - "Consider using a password manager"

### Footer Links
- **Navigation Links:** "Back to Sign In" | "Contact Support"
- **Legal Links:** "Terms of Service" | "Privacy Policy"

---

## 4. New Password Creation Page (Filled State with Validation)

**File:** `Reset Your Password Fill.png`

Same layout as empty state with form validation feedback:

### Form State Changes
- **Password Field:**
  - Input: Shows masked password (dots)
  - Strength Indicator: "Password strength: Strong" (green color)
  - Progress Bar: Green strength indicator bar

- **Confirm Password Field:**
  - Input: Shows masked password (dots)
  - Validation Error: "Passwords don't match" (red text with X icon)
  - Function: Real-time validation feedback

- **Reset Password Button:**
  - State: Remains disabled due to password mismatch
  - User Interaction: Will activate when passwords match

### User Experience Flow
- User enters strong password ’ strength indicator updates to green
- User enters non-matching confirmation ’ error message appears
- Button remains disabled until validation passes

---

## 5. Password Reset Success Page (Sign In Variant)

**File:** `Password Updated Successfully.png`

### Page Structure
- **Header:** Mobile status bar and CryptoGadai logo
- **Success Indicator:**
  - Component: Success icon (green circular checkmark)
  - Function: Visual confirmation of successful operation

### Main Content
- **Success Title:** "Password Updated Successfully"
- **Success Message:** "Your password has been changed. You can now sign in with your new password."
- **Primary Action Button:**
  - Component: Primary button (blue background)
  - Text: "Sign In"
  - Function: Navigate to sign-in page with new password
  - User Interaction: Tap to proceed to login

### Support Links
- **Help Links:** "Contact Support" | "Help Center"
- **Legal Links:** "Terms of Service" | "Privacy Policy"

### User Journey
- User successfully resets password
- System confirms password change
- User can immediately sign in with new credentials

---

## 6. Password Reset Success Page (Mobile App Variant)

**File:** `Password Updated Successfully when register from web.png`

Same layout as sign-in variant with different primary action:

### Action Button Difference
- **Primary Action Button:**
  - Component: Primary button (blue background)
  - Icon: Mobile app icon
  - Text: "Open Mobile App"
  - Function: Deep link or redirect to mobile application
  - User Interaction: Tap to open or download mobile app

### Context
- This variant appears when password reset was initiated from web
- Directs user to continue journey in mobile application
- Maintains consistent success messaging and visual design

---

## Overall Flow Summary

### Logical User Journey
1. **Request Reset:** User enters email to request password reset link
2. **Error Handling:** System displays specific error messages for invalid/expired links or server issues
3. **Create Password:** User accesses valid reset link and creates new password with real-time validation
4. **Success Confirmation:** System confirms password change and provides appropriate next action based on context

### Key Interaction Patterns
- **Form Validation:** Real-time feedback for password strength and matching
- **Error Communication:** Clear, actionable error messages with visual indicators
- **Progressive Disclosure:** Step-by-step flow with contextual information
- **Accessibility:** Clear labels, helpful placeholder text, and visual feedback
- **Security Focus:** Password strength indicators, security tips, and expiration notices

### Design Consistency
- Consistent CryptoGadai branding and color scheme
- Standard mobile UI patterns with proper touch targets
- Clear visual hierarchy with appropriate spacing
- Consistent error/success/warning alert styling