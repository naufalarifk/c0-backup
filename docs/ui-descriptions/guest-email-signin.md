# Guest Email Sign-In UI Flow Description

This document provides detailed textual descriptions of the UI pages in the guest email sign-in flow, organized in logical semantic order.

## 1. Welcome/Get Started Page

**File**: `Get Started.png`

### Page Overview
The initial landing page that introduces users to the CryptoGadai platform and provides sign-in options.

### Elements Description

#### Header Area
- **CryptoGadai Logo**: Company branding logo displayed prominently at the top
- **Welcome Message**: "Welcome to CryptoGadai." - Main heading text
- **Tagline**: "Secure crypto lending platform that makes borrowing against your digital assets simple and transparent" - Descriptive subtitle explaining the platform's purpose

#### Action Buttons
- **Email Sign-In Button**: Primary blue button with envelope icon and text "Sign In with Email"
  - **Function**: Initiates email-based authentication flow
  - **User Interaction**: Tap to navigate to email sign-in form

- **Text Divider**: "or" - Separates the two sign-in options

- **Google Sign-In Button**: Secondary white button with Google logo and text "Sign In with Google"
  - **Function**: Initiates Google OAuth authentication
  - **User Interaction**: Tap to authenticate with Google account

#### Footer Elements
- **Account Creation Link**: "Don't have an account? Sign Up" - Link for new user registration
  - **Function**: Navigates to account creation flow
  - **User Interaction**: Tap "Sign Up" to register

- **Legal Links**: "Terms of Service" and "Privacy Policy" - Footer links to legal documents
  - **Function**: Opens respective legal documents
  - **User Interaction**: Tap to view terms or privacy policy

## 2. Sign In Form (Empty State)

**File**: `Sign In.png`

### Page Overview
Email sign-in form in its initial empty state for user credential input.

### Elements Description

#### Navigation
- **Back Button**: Left-pointing arrow icon in top-left corner
  - **Function**: Returns to previous page (Get Started)
  - **User Interaction**: Tap to go back

- **Page Title**: "Sign in" - Header indicating current page function

#### Form Fields
- **Email Address Field**:
  - **Label**: "Email Address"
  - **Input Field**: Text input with placeholder "Enter your email address..."
  - **Function**: Accepts user's email address
  - **User Interaction**: Tap to focus and enter email

- **Password Field**:
  - **Label**: "Password"
  - **Input Field**: Password input with placeholder "Enter your password..."
  - **Function**: Accepts user's password (hidden text)
  - **User Interaction**: Tap to focus and enter password

#### Action Elements
- **Forgot Password Link**: "Forgot Password?" - Right-aligned link below password field
  - **Function**: Initiates password reset flow
  - **User Interaction**: Tap to reset password

- **Sign In Button**: Primary blue button with text "Sign In"
  - **Function**: Submits credentials for authentication
  - **User Interaction**: Tap to attempt sign-in

#### Footer
- **Account Creation Link**: "Don't have an account? Sign Up" - Link for new users
  - **Function**: Navigates to registration flow
  - **User Interaction**: Tap "Sign Up" to register

## 3. Sign In Form (Filled State)

**File**: `Sign In fill.png`

### Page Overview
Email sign-in form with example data filled in, showing the form's completed state.

### Elements Description

#### Navigation
- **Back Button**: Left-pointing arrow icon
- **Page Title**: "Sign in"

#### Form Fields (Filled)
- **Email Address Field**:
  - **Label**: "Email Address"
  - **Value**: "john.doe@example.com" - Example email address populated
  - **Function**: Shows filled email input state
  - **User Interaction**: Can edit or clear the email

- **Password Field**:
  - **Label**: "Password"
  - **Value**: "ÏÏÏÏÏÏÏÏÏ" - Masked password characters (9 dots)
  - **Show/Hide Toggle**: Eye icon on the right side of field
  - **Function**: Shows filled password state with visibility toggle
  - **User Interaction**: Can edit password or toggle visibility

#### Action Elements
- **Forgot Password Link**: "Forgot Password?" - Available for password recovery
- **Sign In Button**: Primary blue button "Sign In" - Ready for submission

#### Footer
- **Account Creation Link**: "Don't have an account? Sign Up"

## 4. Email Validation Error

**File**: `Email address doesn't match.png`

### Page Overview
Sign-in form displaying email validation error state when invalid email is entered.

### Elements Description

#### Navigation
- **Back Button**: Left-pointing arrow icon
- **Page Title**: "Sign in"

#### Form Fields (Error State)
- **Email Address Field**:
  - **Label**: "Email Address"
  - **Value**: "john.doe@example.com" - Email with validation error
  - **Error Indicator**: Red border around input field
  - **Error Icon**: Red exclamation mark icon on the right side
  - **Error Message**: Red warning triangle icon with text "Please enter a valid email address"
  - **Function**: Shows invalid email format or unrecognized email
  - **User Interaction**: Must correct email to proceed

- **Password Field**:
  - **Label**: "Password"
  - **Input Field**: Empty with placeholder "Enter your password..."
  - **Function**: Reset to empty state due to email error
  - **User Interaction**: Can enter password after fixing email

#### Action Elements
- **Forgot Password Link**: "Forgot Password?" - Still available
- **Sign In Button**: Primary blue button "Sign In" - Enabled but will show error if clicked

#### Footer
- **Account Creation Link**: "Don't have an account? Sign Up"

## 5. Password Validation Error

**File**: `Password doesn't match.png`

### Page Overview
Sign-in form displaying password validation error when incorrect password is entered.

### Elements Description

#### Navigation
- **Back Button**: Left-pointing arrow icon
- **Page Title**: "Sign in"

#### Form Fields (Password Error State)
- **Email Address Field**:
  - **Label**: "Email Address"
  - **Value**: "john.doe@example.com" - Valid email maintained
  - **Function**: Shows correctly entered email
  - **User Interaction**: Email remains editable

- **Password Field**:
  - **Label**: "Password"
  - **Value**: "ÏÏÏÏÏÏÏÏÏ" - Masked password with error state
  - **Error Indicator**: Red border around password field
  - **Show/Hide Toggle**: Eye icon still available
  - **Error Message**: Red warning triangle icon with text "Passwords don't match"
  - **Function**: Indicates incorrect password entered
  - **User Interaction**: Must enter correct password to proceed

#### Action Elements
- **Forgot Password Link**: "Forgot Password?" - Highlighted as relevant option
- **Sign In Button**: Primary blue button "Sign In" - Available for retry

#### Footer
- **Account Creation Link**: "Don't have an account? Sign Up"

## 6. Two-Factor Authentication Code Entry

**File**: `Enter Authentication Code.png`

### Page Overview
Two-factor authentication page requiring 6-digit code from authenticator app.

### Elements Description

#### Navigation
- **Back Button**: Left-pointing arrow icon
- **Page Title**: "Enter Authentication Code"

#### Authentication Interface
- **Instruction Text**: "Enter the 6-digit code from your authenticator app"
  - **Function**: Guides user on what code to enter
  - **User Interaction**: Read instructions for clarity

- **Code Input Grid**: Six individual input boxes for digits
  - **Current Values**: "5", "2", "8", "9", "5", "4" - Example 6-digit code
  - **Function**: Accepts one digit per box for 2FA code
  - **User Interaction**: Tap each box to enter digits sequentially

- **Remember Device Checkbox**: "Remember this device for 30 days"
  - **Function**: Option to avoid 2FA for 30 days on this device
  - **User Interaction**: Tap checkbox to toggle on/off

#### Action Elements
- **Verify Code Button**: Primary blue button with text "Verify Code"
  - **Function**: Submits 6-digit code for verification
  - **User Interaction**: Tap to verify entered code

- **Backup Code Link**: "Use backup code instead"
  - **Function**: Alternative authentication method
  - **User Interaction**: Tap to switch to backup code entry

- **Code Expiration Timer**: "Code expires in 4:32"
  - **Function**: Shows remaining time before code expires
  - **User Interaction**: Visual indicator for urgency

#### Footer
- **Support Link**: "Having trouble? Contact Support"
  - **Function**: Provides help option for authentication issues
  - **User Interaction**: Tap to contact support

## 7. Two-Factor Authentication Backup Code Entry

**File**: `Enter Authentication Backup Code.png`

### Page Overview
Alternative 2FA page for entering backup codes when primary authenticator is unavailable.

### Elements Description

#### Navigation
- **Back Button**: Left-pointing arrow icon
- **Page Title**: "Enter Authentication Code"

#### Backup Code Interface
- **Section Header**: "Enter 2FA Backup Code"
- **Instruction Text**: "You can use a backup code or your two-factor authentications code"
  - **Function**: Explains backup code purpose and usage
  - **User Interaction**: Read for understanding backup codes

- **Backup Code Input Grid**: Six individual input boxes with dashes
  - **Current Values**: "", "", "", "", "", "" - Empty backup code fields
  - **Function**: Accepts backup code digits/characters
  - **User Interaction**: Enter backup code provided during 2FA setup

- **Remember Device Checkbox**: "Remember this device for 30 days"
  - **Function**: Same device memory option as primary 2FA
  - **User Interaction**: Tap to toggle device remembering

#### Action Elements
- **Verify Code Button**: Primary blue button "Verify Code"
  - **Function**: Submits backup code for verification
  - **User Interaction**: Tap to verify backup code

- **Code Expiration Timer**: "Code expires in 4:32"
  - **Function**: Shows time limit for backup code entry
  - **User Interaction**: Visual urgency indicator

#### Footer
- **Support Link**: "Having trouble? Contact Support"
  - **Function**: Help option for backup code issues
  - **User Interaction**: Tap for assistance

## 8. Onboarding/Loading Screen

**File**: `Onboarding.png`

### Page Overview
Post-authentication loading or onboarding screen with CryptoGadai branding.

### Elements Description

#### Branding Display
- **CryptoGadai Logo**: Large company logo centered on blue gradient background
- **Company Name**: "CryptoGadai." - Company name below logo
- **Tagline**: "Secure crypto lending platform that makes borrowing against your digital assets simple and transparent"
  - **Function**: Reinforces platform purpose during loading
  - **User Interaction**: No interaction required - transitional screen

#### Screen Function
- **Purpose**: Loading/transition screen shown after successful authentication
- **Duration**: Temporary display before navigating to main application
- **User Experience**: Provides branded experience during app initialization

## User Flow Summary

The complete guest email sign-in flow follows this logical sequence:

1. **Get Started** ’ User lands on welcome page and chooses email sign-in
2. **Sign In (Empty)** ’ User sees empty form and begins entering credentials
3. **Sign In (Filled)** ’ User completes form with email and password
4. **Email Error** ’ If email is invalid, error state is shown (optional branch)
5. **Password Error** ’ If password is incorrect, error state is shown (optional branch)
6. **2FA Code Entry** ’ User enters 6-digit authenticator code
7. **2FA Backup Code** ’ Alternative if primary 2FA unavailable (optional branch)
8. **Onboarding** ’ Success screen before entering main application

Each page provides clear navigation, helpful error messaging, and consistent branding throughout the authentication experience.