I'll describe each mobile app page in detail, focusing on the layout, components, and functionality:

## Page 1: Enter OTP Code
**Header**: "Enter OTP Code" with back arrow navigation
**Main Content**: 
- Instruction text: "Enter the 6-digit code from your Phone number"
- Six input boxes displaying the digits: 5, 2, 8, 9, 5, 4
- Blue "Verify Code" button (primary action)
- Timer text: "Code expires in 4:32"
- Help link at bottom: "Having trouble? Contact Support"

**User Interaction**: Users enter a 6-digit verification code received via SMS, then tap Verify Code to proceed.

## Page 2: Add Email Sign-In
**Header**: "Add Email Sign-In" with back arrow
**Main Content**:
- Email icon with description: "Add email and password to sign in even without Google"
- Subtitle: "Create an alternative way to access your account with email authentication"
- Form fields:
  - "Email Address" input with placeholder "john.anderson@email.com"
  - "Password" input with placeholder "Enter your password..." and eye icon
  - Password strength indicator: "Weak"
  - "Confirm Password" input with placeholder "Confirm your password..." and eye icon
- Security notice with shield icon explaining encryption
- Blue "Link Account" button (primary action)
- "Cancel" button

**User Interaction**: Users create email/password credentials as backup authentication method.

## Page 3: Two-Factor Authentication Enabled
**Header**: "Two-Factor Authentication" with progress indicator "Step 3 of 5" at 100%
**Main Content**:
- Green checkmark icon
- Success message: "Two-Factor Authentication Enabled!"
- Subtitle: "Your account is now protected with 2FA"
- "What's Protected" section listing:
  - Login attempts
  - Withdrawal requests  
  - Account settings changes
  - Sensitive operations
- "Next Steps" info box with instructions about authenticator app and backup codes
- Blue "Done" button

**User Interaction**: Confirmation screen showing 2FA setup completion with next steps guidance.

## Page 4: Emergency Backup Codes
**Header**: "Two-Factor Authentication" with progress "Step 3 of 5" at 80%
**Main Content**:
- Red warning: "IMPORTANT: Save Your Backup Codes"
- Explanation that codes are only way to access account if authenticator device is lost
- "Your Emergency Backup Codes" section with 10 codes:
  1. A7B-9K2    6. K94-D83
  2. XM4-P6L    7. LM2-S97
  3. QW5-R7T    8. P15-E48
  4. 8V1-4B6    9. TY3-UI9
  5. HG7-ZY2    10. V28-NM5
- "Copy Backup Code" button
- Security guidelines with bullet points
- Green checkbox: "I have safely stored these backup codes"
- Warning: "You must save your backup codes before continuing"
- Blue "Finish Setup" button
- "Back" button

**User Interaction**: Users must acknowledge saving backup codes before proceeding.

## Page 5: Verify Setup
**Header**: "Two-Factor Authentication" with progress "Step 3 of 5" at 60%
**Main Content**:
- "Verify Setup" title
- Instructions: "Enter the 6-digit code from your authenticator app to verify setup"
- Six input boxes showing: 5, 2, 8, 9, 5, 4
- Timer: "New code in 23s"
- Troubleshooting tips in info box:
  - Make sure device time is synchronized
  - Wait for next code if current expired
  - Check correct QR code was scanned
- Blue "Verify" button
- "Back" button

**User Interaction**: Users enter TOTP code from authenticator app to verify setup.

## Page 6: Scan QR Code
**Header**: "Two-Factor Authentication" with progress "Step 2 of 5" at 40%
**Main Content**:
- "Scan QR Code" title
- Instructions: "Scan this QR code with your authenticator app"
- Large QR code display
- "App: CryptoGadai" label
- "Can't scan? Enter this code manually" section with secret key:
  "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP"
- Copy button for secret key
- Alternative authenticator app options:
  - Google Authenticator
  - Auth
  - Microsoft Authenticator
- Red warning: "This QR code will only be shown once. Make sure to scan it now."
- Blue "Next" button
- "Back" button

**User Interaction**: Users scan QR code with authenticator app or manually enter secret key.

## Page 7: Set Up Two-Factor Authentication
**Header**: "Security Settings" with back arrow
**Main Content**:
- Shield icon
- "Set Up Two-Factor Authentication" title
- Description: "Add an extra layer of security to your account using Time-based One-Time Passwords (TOTP)"
- "Benefits of 2FA:" section with checkmarks:
  - Protect against unauthorized access
  - Keep your funds secure
  - Required for withdrawals and sensitive operations
- Security note: "2FA codes expire every 30 seconds for maximum security"
- Blue "Continue" button
- "Cancel" button

**User Interaction**: Introduction screen explaining 2FA benefits before setup begins.

## Page 8: Change Password (Error State)
**Header**: "Change Password" with back arrow
**Main Content**:
- Form fields:
  - "Current Password" (filled with dots, eye icon)
  - "Password" (filled with dots, eye icon) with green "Strong" indicator
  - "Confirm Password" (filled with dots, eye icon)
- Green error message: "Passwords don't match"
- Blue "Continue" button
- "Cancel" button

**User Interaction**: Password change form with validation showing password mismatch error.

## Page 9: Change Password (Empty State)
**Header**: "Change Password" with back arrow
**Main Content**:
- Form fields:
  - "Current Password" with placeholder "Enter current password..."
  - "New Password" with placeholder "Enter new password..."
  - Password strength: "Weak"
  - "Confirm Password" with placeholder "Confirm new password..."
- All fields have eye icons for visibility toggle
- Blue "Continue" button
- "Cancel" button

**User Interaction**: Empty password change form ready for user input.

## Page 10: Phone Number
**Header**: "Phone Number" with back arrow
**Main Content**:
- "Phone Number" label
- Input field with placeholder "Enter phone number"
- Blue "Continue" button
- "Cancel" button

**User Interaction**: Simple form for entering/updating phone number.

## Page 11: Company Information
**Header**: "Company Information" with back arrow
**Main Content**:
- Company card showing:
  - "PT. Bank Central Indonesia" with "Verified" badge
  - "Industry: Financial Services"
- Business Information section:
  - Registration: 123456789012
  - NPWP: 123456789012345
  - Description: Financial Services
- Contact Information section:
  - Email: pt.bca@company.id
  - Telephone: +62 21 1234 5678
  - Address: Jakarta Selatan, DKI Jakarta
- Banking Information section:
  - Bank Name: Bank BCA
  - Account Number: 1234567890

**User Interaction**: Read-only display of verified company information.

## Page 12: Security Settings Menu
**Header**: "Security Settings" with back arrow
**Main Content**:
- Two menu items:
  - "Two-Factor Authentication" with toggle switch (currently off)
    Subtitle: "Add extra security to your account"
  - "Change Password" with arrow
    Subtitle: "Last changed 30 days ago"

**User Interaction**: Settings menu for security-related options.

## Page 13: Security Settings with Password Modal
**Background**: Grayed-out security settings menu
**Modal**: "Enter Password" dialog
- "Password" input field with red dots and eye icon
- Red error: "Passwords don't match"
- Explanation: "You need to enter password before enabling or disabling 2FA Authentications"
- Blue "Continue" button
- "Cancel" button

**User Interaction**: Password verification required before accessing 2FA settings.

## Page 14: Security Settings with Empty Password Modal
**Background**: Grayed-out security settings menu
**Modal**: "Enter Password" dialog
- "Password" input field with placeholder "Enter password..." and eye icon
- Explanation: "You need to enter password before enabling or disabling 2FA Authentications"
- Blue "Continue" button
- "Cancel" button

**User Interaction**: Empty password prompt for 2FA access.

## Page 15: Link Google Account
**Header**: "Link Google Account" with back arrow
**Main Content**:
- Google account icon
- "Link your Google account to sign in faster"
- Description: "Enjoy seamless access and enhanced security with Google authentication"
- "Benefit using google account to sign in" section:
  - Sign in with one tap
  - Added security
  - Sync across devices
- Status: "No Google account linked" with warning icon
- Blue "Link Google Account" button with Google logo
- "Cancel" button
- Security note about encrypted information storage

**User Interaction**: Option to link Google account for easier authentication.

## Page 16: Profile
**Header**: "Profile" with back arrow
**Main Content**:
- User avatar and name: "John Smith"
- Email: "john.smith@company.com"
- Status items with verification badges:
  - KYC: Verified (green)
  - Email Address: Connected (green)
  - Google Account: Unlinked (gray)
  - Phone Number: "Verify" link (blue)
- Institution Role: "Owner - PT. Bank Central Indonesia"
- Menu items with arrows:
  - Company Information
  - Security Settings  
  - Help and Support
  - Sign Out
- Bottom navigation: Home, Loans, Market, Wallet, Profile (selected)

**User Interaction**: Main profile screen with account status and navigation to various settings.

## Page 17: Help and Support
**Header**: "Help and Support" with back arrow on blue gradient background
**Main Content**:
- "How can we help you?" heading
- Search bar with placeholder "Search..." and "Search" button
- Categories section with "See more" link:
  - Filter tabs: "All" (selected), "Institutions", "Individual"
- "Related question" section with expandable items:
  - What is CryptoGadai
  - How to Loan Offers
  - How to Loan Applications
  - What is risk summary
  - Documentations

**User Interaction**: Help center with search functionality and categorized FAQ sections.

This appears to be a financial/crypto lending application with comprehensive security features including 2FA setup, password management, and account verification processes.