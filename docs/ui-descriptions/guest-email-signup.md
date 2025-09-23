# Guest Email Signup UI Flow

This document provides detailed textual descriptions of the guest email signup user interface flow, organized in logical sequence.

## Page Flow Overview

1. **Create Account** - Initial signup form
2. **Create Account (Filled)** - Form with valid data entered
3. **Create Account (Email Validation Error)** - Email format validation error state
4. **Create Account (Password Validation Error)** - Password requirements validation error state
5. **Create Account (Password Mismatch Error)** - Password confirmation mismatch error state
6. **Email Verification** - Post-signup email verification screen
7. **Select Account Type** - Account type selection screen

---

## 1. Create Account (Initial State)

**Page Title**: Create Account

**Navigation**:
- Back arrow button (top-left) - Returns to previous screen
- Page title "Create Account" displayed in header

**Form Elements**:

**Email Address Section**:
- Label: "Email Address"
- Input field: Text input with placeholder "Enter your email address..."
- Component type: Standard text input field
- User interaction: Click to focus and enter email address

**Password Section**:
- Label: "Password"
- Input field: Password input with placeholder "Enter your password..."
- Eye icon button (right side) - Toggles password visibility
- Password strength indicator: Shows "Password strength: Weak" in gray text
- Component type: Password input with visibility toggle
- User interaction: Click to focus and enter password, click eye icon to show/hide password

**Confirm Password Section**:
- Label: "Confirm Password"
- Input field: Password input with placeholder "Confirm your password..."
- Eye icon button (right side) - Toggles password visibility
- Component type: Password input with visibility toggle
- User interaction: Click to focus and re-enter password for confirmation

**Action Button**:
- Primary button: "Create Account" (blue background)
- Component type: Primary action button
- User interaction: Click to submit registration form

**Legal Text**:
- Text: "By creating an account, you agree to our"
- Links: "Terms of Service" and "Privacy Policy" (clickable links)
- Component type: Legal agreement text with hyperlinks
- User interaction: Click links to view legal documents

**Sign In Link**:
- Text: "Already have an account?"
- Link: "Sign In" (clickable)
- Component type: Navigation link
- User interaction: Click to navigate to sign-in page

---

## 2. Create Account (Filled State)

**Page Title**: Create Account

**Navigation**: Same as initial state

**Form Elements**:

**Email Address Section**:
- Label: "Email Address"
- Input field: Contains "john.doe@example.com" (sample filled data)
- Component type: Filled text input field
- User interaction: Can edit the entered email address

**Password Section**:
- Label: "Password"
- Input field: Shows masked password (dots) indicating password is entered
- Eye icon button (right side) - Available for visibility toggle
- Password strength indicator: Shows "Password strength: Strong" in green text with green progress bars
- Component type: Filled password input with strength indicator
- User interaction: Can edit password, toggle visibility

**Confirm Password Section**:
- Label: "Confirm Password"
- Input field: Shows masked password (dots) matching the password field
- Eye icon button (right side) - Available for visibility toggle
- Component type: Filled password confirmation input
- User interaction: Can edit confirmation password, toggle visibility

**Action Button**: Same as initial state - "Create Account" button enabled

**Legal Text**: Same as initial state

**Sign In Link**: Same as initial state

---

## 3. Create Account (Email Validation Error)

**Page Title**: Create Account

**Navigation**: Same as previous states

**Form Elements**:

**Email Address Section**:
- Label: "Email Address"
- Input field: Contains "john.doe@example.com" with red border indicating error
- Red warning icon (right side of input)
- Error message: "  Please enter a valid email address" in red text below input
- Component type: Text input in error state
- User interaction: Edit email to correct the validation error

**Password Section**:
- Label: "Password"
- Input field: Empty with placeholder "Enter your password..."
- Password strength indicator: Shows "Password strength: Weak"
- Component type: Standard password input
- User interaction: Enter password

**Confirm Password Section**:
- Label: "Confirm Password"
- Input field: Empty with placeholder "Confirm your password..."
- Component type: Standard password confirmation input
- User interaction: Enter password confirmation

**Action Button**: "Create Account" button (enabled but form has validation errors)

**Legal Text**: Same as previous states

**Sign In Link**: Same as previous states

---

## 4. Create Account (Password Validation Error)

**Page Title**: Create Account

**Navigation**: Same as previous states

**Form Elements**:

**Email Address Section**:
- Label: "Email Address"
- Input field: Contains "john.doe@example.com" (valid state)
- Component type: Valid text input field
- User interaction: Can edit email address

**Password Section**:
- Label: "Password"
- Input field: Shows masked password (red dots) with red border indicating error
- Password strength indicator: Shows "Password strength: Weak" with minimal red progress bar
- Error message: "  Password must be at least 8 characters" in red text below input
- Component type: Password input in error state
- User interaction: Edit password to meet minimum requirements

**Confirm Password Section**:
- Label: "Confirm Password"
- Input field: Shows masked password (red dots) with red border
- Error message: "  Passwords don't match" in red text below input
- Component type: Password confirmation input in error state
- User interaction: Re-enter password to match the password field

**Action Button**: "Create Account" button (present but form has validation errors)

**Legal Text**: Same as previous states

**Sign In Link**: Same as previous states

---

## 5. Create Account (Password Mismatch Error - Alternative State)

**Page Title**: Create Account

**Navigation**: Same as previous states

**Form Elements**:

**Email Address Section**:
- Label: "Email Address"
- Input field: Contains "john.doe@example.com" (valid state)
- Component type: Valid text input field
- User interaction: Can edit email address

**Password Section**:
- Label: "Password"
- Input field: Shows masked password (black dots) indicating valid password entered
- Password strength indicator: Shows "Password strength: Weak" with green progress bars
- Component type: Valid password input
- User interaction: Can edit password

**Confirm Password Section**:
- Label: "Confirm Password"
- Input field: Shows masked password (red dots) with red border indicating mismatch
- Error message: "  Passwords don't match" in red text below input
- Component type: Password confirmation input in error state
- User interaction: Re-enter password to match the password field

**Action Button**: "Create Account" button (present but confirmation password doesn't match)

**Legal Text**: Same as previous states

**Sign In Link**: Same as previous states

---

## 6. Email Verification

**Page Title**: Email Verification

**Navigation**:
- Back arrow button (top-left) - Returns to previous screen
- Page title "Email Verification" displayed in header

**Main Content**:

**Visual Element**:
- Large circular icon with envelope symbol (green background)
- Component type: Status illustration
- User interaction: None (decorative element)

**Heading**:
- Text: "Check your email"
- Component type: Primary heading
- User interaction: None (informational)

**Instructions**:
- Text: "We sent a verification link to"
- Email display: "john.doe@example.com" (highlighted in gray box)
- Additional text: "Click the link in the email to verify your account. If you don't see it, check your spam folder."
- Component type: Instructional text with email display
- User interaction: None (informational)

**Action Button**:
- Secondary button: "Resend Email"
- Component type: Secondary action button
- User interaction: Click to request a new verification email

**Timer/Counter**:
- Text: "Didn't receive an email? You can resend in 01:32"
- Component type: Countdown timer with resend option
- User interaction: Wait for timer to expire before resending

**Sign In Link**:
- Text: "Already have an account?"
- Link: "Sign In" (clickable)
- Component type: Navigation link
- User interaction: Click to navigate to sign-in page

---

## 7. Select Account Type

**Page Title**: Choose Account Type

**Navigation**:
- Back arrow button (top-left) - Returns to previous screen
- Page title "Choose Account Type" displayed in header

**Main Content**:

**Visual Element**:
- Large circular icon with user/account symbol (blue background)
- Component type: Feature illustration
- User interaction: None (decorative element)

**Heading**:
- Text: "Select your account type"
- Component type: Primary heading
- User interaction: None (informational)

**Subheading**:
- Text: "Choose the account type that best describes you to continue with registration"
- Component type: Descriptive text
- User interaction: None (informational)

**Account Type Options**:

**Individual Account Option**:
- Icon: User/person icon (left side)
- Title: "Individual"
- Description: "For individual users who want to manage their individual crypto assets and collateral for individual loans"
- Component type: Selectable option card
- User interaction: Click to select individual account type

**Institution Account Option**:
- Icon: Building/institution icon (left side)
- Title: "Institution"
- Description: "For businesses, organizations, or institutions that need to manage larger crypto portfolios and commercial lending"
- Component type: Selectable option card
- User interaction: Click to select institution account type

**Action Button**:
- Primary button: "Continue"
- Component type: Primary action button
- User interaction: Click to proceed with selected account type

**Help Section**:
- Text: "You can change your account type later in settings"
- Link: "Contact Support" for additional help
- Component type: Help text with support link
- User interaction: Click contact support for assistance

---

## User Flow Summary

1. **Registration**: User fills out email and password fields on Create Account page
2. **Validation**: System validates email format, password strength, and password confirmation
3. **Error Handling**: Specific error messages guide user to correct validation issues
4. **Email Verification**: After successful registration, user is directed to verify email
5. **Account Type Selection**: User chooses between Individual or Institution account type
6. **Completion**: User proceeds with selected account type to complete registration

Each page includes consistent navigation elements, legal agreement acceptance, and sign-in options for existing users.