# Mobile App Frontend Specification
## Crypto Gadai Platform - Complete Screen Catalog

**Version:** 2.0  
**Last Updated:** September 8, 2025

---

# TABLE OF CONTENTS

1. [Authentication & Onboarding](#authentication--onboarding)
2. [Identity Verification (KYC)](#identity-verification-kyc)
3. [Institution Management](#institution-management)
4. [Dashboard & Home](#dashboard--home)
5. [Market & Loan Discovery](#market--loan-discovery)
6. [Loan Operations](#loan-operations)
7. [Wallet & Transactions](#wallet--transactions)
8. [User Profile & Settings](#user-profile--settings)

---

# AUTHENTICATION & ONBOARDING

## Splash Screen Layout
1. **Logo** - App logo
2. **Description** - "Secure crypto lending platform that makes borrowing against your digital assets simple and transparent."

## Welcome Screen Layout
1. **Logo** - App logo
2. **Description** - Platform description
3. **Button Sign In with Email** - Sign in with email button
4. **Line OR** - Divider line, OR text
5. **Button Sign In with Google** - Sign in with Google button
6. **Sign Up Link** - Don't have an account? label, Sign up link

## Login Screen Layout
1. **Title** - App logo, App name
2. **Form Input Email** - Email field, Email label
3. **Form Input Password** - Password field, Password label, Show/hide password toggle
4. **Remember Me** - Checkbox, Remember me text
5. **Forgot Password** - Forgot password link
6. **Button Sign In** - Sign in button
7. **Line OR** - Divider line, OR text
8. **Sign Up Link** - Don't have account text, Sign up link

## Registration Screen Layout
1. **Title** - Create account
2. **Email Address Input** - Email address field, Email address label
3. **Password Input** - Password field, Password label
4. **Confirm Password Input** - Confirm password field, Confirm password label
5. **Button Create Account** - Create account button
6. **Sign In Link** - Already have an account? label, Sign In link

## Email Verification Screen Layout
1. **Email Logo** - Email icon
2. **Title** - Check your email
3. **Description** - We sent a verification link to
4. **Email User Disabled Input** - User email field (disabled)
5. **Button Resend Email** - Resend email button
6. **Sign In Link** - Already have an account? label, Sign In link

## 2FA Authentication Screen Layout
1. **Title** - Enter authentication code, Verification message
2. **6 Form Input Horizontally** - Input field 1-6
3. **Button Verify Code** - Verify code button

## Choose Account Type Screen Layout
1. **Icon** - Account type icon
2. **Title** - Select your account type
3. **Description** - Choose the account type that best describes you to continue with registration
4. **Button Personal** - Personal icon, Personal button, For individual users description
5. **Button Institution** - Institution icon, Institution button, For businesses description
6. **Button Continue** - Continue button

## Password Reset Screens
### Reset Password Screen Layout
1. **Title** - Reset password
2. **Email Input** - Email field, Email label

### Reset Your Password Screen Layout
1. **Title** - Reset Your Password
2. **Password Input** - Password field, Password label
3. **Confirm Password Input** - Confirm password field, Confirm password label
4. **Description** - Reset link expires in 24 hours
5. **Reset Password Button** - Reset password button
6. **Security Tips** - Security Tips title, Choose a unique password, Don't reuse passwords, Consider using a password manager

### Password Updated Successfully Screen Layout
1. **Icon** - Success icon
2. **Title** - Password Updated Successfully
3. **Description** - Your password has been changed. You can now sign in with your new password.
4. **Button Sign In** - Sign in button

---

# IDENTITY VERIFICATION (KYC)

## Identity Verification Screen Layout
1. **Step Indicator** - Step 1 of 4
2. **Title** - Verification process
3. **Verification Steps** - Indonesia KTP, Personal Info, Selfie with KTP, Review buttons
4. **Description** - What you'll need:
5. **Requirements List** - Indonesian KTP, Good lighting for photos, About 5 minutes to complete
6. **Button Start Verification** - Start verification button
7. **Privacy & Security Card** - Your information is encrypted and secure

## Scan KTP Screen Layout
1. **Title** - KTP Verification
2. **Subtitle** - Position your Indonesian KTP within the frame
3. **Tips** - Tips for the best result: Use good lighting, Keep KTP flat, Make sure NIK and all text is clearly visible
4. **Camera Button** - Camera button
5. **Privacy & Security Card** - Your information is encrypted and secure

## KTP Verification Screen Layout
1. **Title** - KTP Verification
2. **Image Preview** - KTP image preview
3. **Quality Check Card** - Quality Check Complete, Great! Your KTP is clear and NIK is readable
4. **Quality Details** - Image Clarity: Excellent, Text Readability: All text visible, NIK Visibility: Clear
5. **What Happens Next Card** - What happens next? Confirm your personal details, Take a selfie with your KTP, Submit for verification
6. **Use This Photo Button** - Use this photo button
7. **Retake Photo Button** - Retake photo button
8. **Privacy & Security Card** - Your information is encrypted and secure

## Confirm Your Information Screen Layout
1. **Title** - Confirm Your Information
2. **Personal Detail Subtitle** - Personal Detail
3. **Personal Detail Inputs** - Full name, NIK, Date of birth, Place of birth inputs
4. **Address Information Subtitle** - Address Information
5. **Address Inputs** - Street address, City, Province inputs
6. **Additional Information Subtitle** - Additional Information
7. **Additional Inputs** - Phone number, Postal code inputs
8. **Button Continue** - Continue button
9. **Retake ID Photo Button** - Retake ID photo button
10. **Privacy & Security Card** - Your information is encrypted and secure

## Take Selfie with KTP Screen Layout
1. **Label Face Detected** - Face Detected
2. **Label KTP Not Visible** - KTP not visible
3. **Label Improve Lighting** - Improve lighting
4. **Description** - Hold your KTP next to your face, Make sure NIK is visible
5. **Camera Button** - Camera button
6. **Privacy & Security Card** - Your information is encrypted and secure

## Review Photo Screen Layout
1. **Image Preview** - Image preview
2. **Quality Check Card** - Perfect! Your face and KTP are clearly visible
3. **Quality Details** - Face clearly visible: Excellent, KTP details readable: Excellent, Good lighting quality: Excellent, NIK number visible: Excellent
4. **Use This Photo Button** - Use this photo button
5. **Retake Photo Button** - Retake photo button
6. **Privacy & Security Card** - Your information is encrypted and secure

## Review Your Information Screen Layout
1. **Photo Previews** - ID card photo preview, Retake ID photo link, Selfie photo preview, Retake selfie link
2. **Personal Information Subtitle** - Personal Information
3. **Information Cards** - Full name card with edit link, ID number card with edit link, Date of birth card with edit link, Address card with edit link
4. **Privacy Radio Button** - Privacy and security radio button, Your data is encrypted and will only be used for verification
5. **Submit Verification Button** - Submit verification button

## Identity Verification Complete Screen Layout
1. **Step Indicator** - All Steps Completed
2. **Title** - Verification Process
3. **Verification Steps Highlighted** - Indonesia KTP, Personal Info, Selfie with KTP buttons (primary color)
4. **Success Button** - Verification complete
5. **Description** - All requirements have been successfully fulfilled
6. **Requirements Checklist** - Indonesian KTP, Good lighting for photos, About 5 minutes to complete
7. **Submit for Review Button** - Submit for review button
8. **Privacy & Security Card** - Your information is encrypted and secure

## Verification Status Screen Layout
1. **Icon** - Status icon
2. **Title** - Verification Submitted!
3. **Description** - Your identity verification has been sent for review
4. **Reference Number Card** - Reference Number: KYC-123456, Keep this for support inquiries
5. **What Happens Next Card** - Our team will review your information, You'll receive an email when complete, This usually takes 1-2 business days
6. **Return to Home Button** - Return to home button
7. **Contact Support Button** - Contact support button

---

# INSTITUTION MANAGEMENT

## KYC Institution Screen Layout
1. **Title** - Institution Registration
2. **Step Indicator** - Step 1-3 (Information, Document, Review)
3. **Basic Business Information** - Business name, Description, Type selection, Tax ID, Business registration number, Establishment number, Ministry approval number inputs
4. **Business Address** - Street address, City/region, Province selection, Postal code, Country inputs
5. **Director/Owner Information** - Director name, Business phone number inputs
6. **Banking Information** - Bank name selection, Bank account number, Account holder name inputs
7. **Continue to Documents Button** - Continue to Documents button

## Institution Registration Document Upload Screen Layout
1. **Title** - Institution Registration
2. **Step Indicator** - Step 2 of 3
3. **File Upload Sections** - NPWP, Business registration number, Deed of Establishment, Ministry approval, Director ID Card file uploads
4. **Document Guidelines** - Ensure all text is clearly readable, Documents should be recent, Notarized documents preferred, Contact support if needed
5. **Continue to Review Button** - Continue to review button

## Institution Registration Review Screen Layout
1. **Title** - Institution Registration
2. **Step Indicator** - Step 3 of 3
3. **Application Summary Title** - Application Summary
4. **Business Information Card** - PT Tech Solutions Indonesia, Registration numbers, NPWP, Technology Services
5. **Contact Information Card** - Email, Phone, Address details
6. **Banking Information Card** - Bank details, Account information
7. **Document Summary Card** - Document previews
8. **Terms and Conditions** - Institution Agreement, Indonesian Financial Regulations, Platform Terms, AML Compliance checkboxes
9. **Processing Information** - Review takes 3-5 business days, Email updates, Additional documentation may be requested
10. **Submit Application Button** - Submit application button

## Member Management Screen Layout
1. **Institution Info Card** - Institution info card
2. **Role Permission Card** - Role Permission: Owner (Full access), Finance (Limited access)
3. **Tab Current** - Current tab, List of member cards
4. **Tab Pending** - Pending tab, List of pending member cards
5. **Subtitle and Invite Button** - Subtitle, Invite button

## Invite Member Screen Layout
1. **Subtitle** - Invite New Member
2. **Email Address Input** - Email Address input
3. **Role Selection** - Finance radio button
4. **Personal Message Input** - Personal Message (Optional) input
5. **Requirements** - Target user must have verified KYC, User cannot be member of another institution
6. **Send Invitation Button** - Send invitation button

## Invite Member Review Screen Layout
1. **Member Info Card** - Member info with role
2. **Message Preview** - Message preview
3. **Terms and Conditions Radio** - Invitee access to financial data, Authorized representative confirmation
4. **Send Invitation Button** - Send invitation button

## Member Invitation Screen Layout
1. **Icon** - Success icon
2. **Title** - Invitation sent successfully!
3. **Description** - Invitation sent to user with instructions
4. **Member Card** - Member with role card
5. **Back to Member Management Button** - Back to Member Management button
6. **Invite Another Member Button** - Invite another member button

## Institution Invitation Response Screen
1. **Page Title** - Institution Invitation
2. **Invitation Overview** - Institution name, Inviter details, Expiry notice
3. **Institution Details Card** - Company information, Registration details, Industry, Member count
4. **Role and Responsibilities** - Proposed role badge, Detailed permissions breakdown, Responsibilities notice
5. **Important Notice** - Agreement requirements, Compliance obligations
6. **Terms and Conditions** - Institution Agreement, Authorization confirmations, KYC requirements
7. **Action Buttons** - Accept Invitation, Reject Invitation, Download Details, Contact Support

---

# DASHBOARD & HOME

## Dashboard Home Personal Screen Layout
1. **Verification Status Card** - Complete verification to unlock features, Verify Now button
2. **Payment Alert Card** - Payment due warning, Repay Now button
3. **My Portfolio Card** - Portfolio value, Interest earned, Active loans, View Detail button
4. **Action Buttons** - Offer, Apply, Withdraw, History buttons
5. **Announcement Section** - Announcement section
6. **News Section** - News section, Article news
7. **Navigation Bar** - Home, Loans, Market, Wallet, Profile

## Dashboard Home Institution Screen Layout
1. **Verification Status Card** - Complete verification to unlock features, Verify Now button
2. **Owner Info Card** - Owner info card
3. **My Portfolio Card** - Portfolio value, Interest earned, Active loans, View Detail button
4. **Action Buttons** - Offer, Member, Withdraw, History buttons
5. **Announcement Section** - Announcement section
6. **News Section** - News section, Article news
7. **Navigation Bar** - Home, Loans, Market, Wallet, Profile

## Notification Screen Layout
1. **Labels** - Loans, Security, Payments labels
2. **Notification Items** - Notification item cards with icons

---

# MARKET & LOAN DISCOVERY

## Market Screen Layout - Personal
1. **Search and Filter** - Search icon, Filter icon
2. **Tabs** - Loan Offer tab, Loan Application tab
3. **Label Options** - All, Institution, Personal labels
4. **Loan Offer Cards** - Name, Institution/personal label, Availability supply, Interest rate, Duration, Progress bar

## Market Screen Layout - Institution
1. **Search and Filter** - Search icon, Filter icon
2. **Tab** - Loan Application tab only
3. **Label Options** - All, Institution, Personal labels
4. **Loan Application Cards** - Name, Institution/personal label, Availability supply, Interest rate, Duration, Progress bar

---

# LOAN OPERATIONS

## Create Loan Offer Flow

### Create Loan Offer Screen Layout
1. **Title** - Create New Loan Offer
2. **Total Amount Input** - Total amount field, Currency selector (USDT, BTC, ETH)
3. **Loan Range Section** - Min loan amount, Max loan amount inputs
4. **Interest Rate Input** - Interest rate field, Percentage symbol, Per month/year toggle
5. **Duration Options** - Duration selection: 7, 14, 30, 60, 90 days, Custom duration input
6. **Expired Date Input** - Expired date field, Date picker, Calendar icon
7. **Collateral Acceptance Info** - Accepted collateral list: Bitcoin (BTC), Ethereum (ETH), Binance Coin (BNB), Solana (SOL) checkboxes, LTV ratio, Risk level indicator
8. **Offer Summary Card** - Total fund available, Interest rate, Duration options, Accepted collaterals count, Estimated monthly income
9. **Terms and Conditions** - Terms checkbox, Agreement acknowledgment
10. **Action Buttons** - Continue offer button

### Preview Offer Screen Layout
1. **Title** - Review Loan Offer
2. **Loan Offer Summary Card** - Offer ID, Total Fund Available, Interest Rate, Min/Max Loan Amount, Duration Options, Offer Expires
3. **Collateral Information Card** - Accepted Collaterals with LTV ratios, Total Accepted assets
4. **Legal Agreement Info** - Loan Agreement Terms, Collateral Requirements, Risk Disclosure, Auto-Liquidation Policy, Platform Service Agreement, Indonesian Regulations Compliance, Data Privacy Policy
5. **Terms and Conditions Checkbox** - Agreement confirmation with acknowledgment text
6. **Action Buttons** - Continue to Fund button (primary), Edit Parameter button (secondary), Back to Parameters button

### Deposit Principal to Activate Screen Layout
1. **Title** - Deposit Principal to Activate, Fund your loan offer description
2. **Summary Card** - Invoice ID, Principal Amount, Due Date
3. **Send Exactly Card** - Exact amount, Important payment instructions
4. **QR Code Section** - QR code image, Scan instructions
5. **Payment Address Card** - Payment address, Copy button, Network specification
6. **Payment Status Card** - Waiting status, Detection timeline, Confirmation requirements
7. **Invoice Expires Card** - Countdown timer, Expiry warnings
8. **Action Buttons** - Waiting for Payment button, Back to Review button

## Apply for Loan Flow

### Apply for Loan Screen Layout
1. **Step Indicator** - Step 1 of 3: Parameters > Review > Fund
2. **Title** - Apply for Loan, Set your loan parameters
3. **Principal Amount Input** - Principal amount field, Currency selector (USDT)
4. **Expired Date Input** - Expired date field, Date picker, Calendar icon
5. **Max Interest Rate Input** - Max interest rate field, Percentage symbol, Per month indicator
6. **Preferred Term Length** - 1 month, 3 months, 6 months options
7. **Pick Collateral** - Bitcoin (BTC), Ethereum (ETH), Solana (SOL), Binance Coin (BNB) options
8. **Liquidation Mode** - Full liquidation, Partial liquidation radio buttons
9. **Action Button** - Continue Calculation button

### Apply for Loan Review Screen Layout
1. **Step Indicator** - Step 2 of 3: Parameters > Review > Fund
2. **Title** - Review Loan Application
3. **Current Market Rate Card** - BTC/USDT rate, Last updated time, 24h change
4. **Summary Card** - Principal Amount, Interest Rate, Provisions, Terms, Total Loans
5. **Loan Details Card** - Liquidation Fee, Premium Risk, LTV, Collateral
6. **Legal Agreement Card** - Complete list of terms and policies
7. **Terms and Conditions Radio Button** - Agreement confirmation with acknowledgment
8. **Action Button** - Continue Collateral button

### Deposit Collateral Screen Layout
1. **Step Indicator** - Step 3 of 3: Parameters > Review > Fund
2. **Title** - Deposit Collateral, Send collateral to secure loan
3. **Deposit Collateral Card** - ID, Currency (Bitcoin), Network, Due Date
4. **Amount Details Card** - Send Exactly amount, Precise instructions, Activation confirmation
5. **Scan QR Code** - QR code image, Wallet scanning instructions
6. **Payment Address Card** - Bitcoin address, Copy button, Network specification, Security warning
7. **Invoice Expires Card** - Countdown timer, Expiry warnings, Regeneration notice
8. **Action Buttons** - Waiting for Payment button (disabled), Back to Review button

## Existing Loan Management

### Loans Screen Layout
1. **My Offer Tab** - My offer tab
2. **Loan Offer Overview Card** - Total fund, Disbursement, Income, Active loans, Available per month
3. **New Offer Button** - New offer button
4. **Offer Cards List** - Loan ID, Status, Available offer, Interest rate, Duration, Progress bar

### Loan Details Screen Layout
1. **Loan Card** - ID, Status, Start/End dates, Total funds, Interest rate, Disbursement, Available
2. **Earnings Card** - Gross total, Platform fee, Net income
3. **Matched Borrower List** - ID, Status, Duration, Amount, Collateral, LTV, Due date

### Loan Application Tab Screen Layout
1. **Application Overview Card** - Total applied, Active, Pending, Rejected
2. **New Application Button** - New application button
3. **Application List** - ID, Status, Requested amount, Duration, Interest rate, Collateral

### Loan Application Detail Screen Layout
1. **Application Info** - ID, Status, Amount
2. **Loan Calculation Card** - Principal, Interest, Duration, Provision, Total repayment
3. **Due Date Card** - Due date information
4. **Collateral Card** - Selected asset, LTV, Collateral amount, Current price, Required collateral
5. **Payment Method** - Early repayment, Early liquidation buttons

### Repayment Screens
#### Loan Repayment Screen Layout
1. **Total Repayment Card** - Total repayment amount
2. **Due Date Balance** - Due date balance
3. **Send Exactly Card** - Exact payment amount
4. **Confirm Payment Button** - Confirm payment button

#### Loan Repayment Payment Screen Layout
1. **Amount Detail** - Payment amount details
2. **QR Code** - Payment QR code
3. **Payment Address** - Payment address
4. **Payment Status** - Current payment status
5. **Invoice Expires** - Expiration countdown

#### Application Detail Auto Liquidation Screen Layout
1. **Application Info** - ID, Status, Amount
2. **Loan Calculation Card** - Principal, Interest, Duration, Provision, Total repayment
3. **Due Date Card** - Due date information
4. **Collateral Card** - Asset details, LTV, Current price, Required collateral
5. **Liquidations Executed Card** - Triggered date, Collateral sold, Sale price, Loan repaid, Liquidation fee, Surplus
6. **Payment Method** - Early repayment, Early liquidation buttons

#### Loan Repayment Early Liquidation Screen Layout
1. **Loan Repayment Card** - Total Repayment, Due date
2. **Liquidation Mode Selection** - Partial Liquidation, Full Liquidation radio buttons
3. **Liquidation Breakdown Card** - Collateral to Sell, Est. Market Price, Est. Proceeds
4. **Deductions Section** - Principal, Interest, Provisions, Premium Risk, Early Liquidation Fee, Total Deductions
5. **Estimated Return** - EST. RETURN amount (Subject to market price)

---

# WALLET & TRANSACTIONS

## Wallet Screen Layout
1. **My Balance Card** - Balance information
2. **Asset Tab** - Asset tab with balance
3. **Pending Transaction List** - Pending transactions
4. **Quick Action Button** - Transaction history, Withdrawal history buttons

## Transaction History Screen Layout
1. **Filter** - Transaction filter
2. **Transaction Cards List** - Transaction history cards

## Transaction Detail Screen Layout
1. **Transaction Status** - Current status
2. **Transaction Info Card** - Transaction ID, Date/time, Amount, Currency, Network
3. **Address Information** - From address, To address
4. **Fee Information** - Platform fee, Total fee
5. **Blockchain Info** - Transaction hash, Block number, Confirmations

## Withdrawal Management

### List Withdrawal Address Screen Layout
1. **Add Button** - Add new address button
2. **Beneficiaries Cards** - Address cards with Withdraw, Remove buttons

### Add Withdrawal Address Screen Layout
1. **Select Blockchain** - Blockchain selection
2. **Input Address** - Address input field
3. **Address Format List** - Supported address formats
4. **Warnings** - Security warnings about address verification and testing
5. **Action Button** - Add withdrawal address button

### Withdrawal Screen Layout
1. **Selected Address Input** - Selected address (disabled)
2. **Currency Selection** - Currency selector
3. **Current Balance** - Available balance display
4. **Amount Input** - Withdrawal amount
5. **Fee Breakdown Card** - Platform fee, Net amount received
6. **Warnings** - Security warnings about irreversible transactions
7. **Action Button** - Confirm withdrawal button

### Two-Factor Authentication for Withdrawal Screen Layout
1. **Title** - Verify Withdrawal
2. **Description** - Enter 6-digit authenticator code
3. **6 Input Numbers** - Code input fields 1-6
4. **Troubleshooting** - Time synchronization, Code expiry, QR code verification tips
5. **Action Buttons** - Confirm, Cancel buttons

---

# USER PROFILE & SETTINGS

## User Profile Screen Layout
1. **Profile Avatar** - Avatar with camera icon
2. **User Info** - Name, Email
3. **Verification Card** - Verified user status
4. **Account Links** - Email/Google account link status
5. **User Role** - Current user role
6. **Action Buttons** - Security setting, Help and support, Sign out buttons

## User Profile Institution Screen Layout
1. **Profile Avatar** - Avatar with camera icon
2. **User Info** - Name, Email
3. **Verification Card** - Verified user status
4. **Account Links** - Email/Google account link status
5. **User Role** - Current user role
6. **Action Buttons** - Company information, Company activity, Security setting, Help and support, Sign out buttons

## Account Linking

### Link Google Account Screen Layout
1. **Profile Photo** - User profile photo
2. **Title** - Link your Google account to sign in faster
3. **Description** - Seamless access and enhanced security benefits
4. **Sign in with One Tap Explanation** - One tap benefits, Security and sync features
5. **Current Status Card** - Current linking status
6. **Action Buttons** - Link Google account, Cancel buttons

### Add Email Sign-In Screen Layout
1. **Email Icon** - Email icon
2. **Subtitle** - Add email and password for alternative access
3. **Description** - Create alternative authentication method
4. **Input Fields** - Email, Password inputs
5. **Action Buttons** - Link account, Cancel buttons

## Security Settings

### Security Setting Screen Layout
1. **Icon** - Security icon
2. **Subtitle** - Set Up Two-Factor Authentication
3. **Description** - Add extra security layer using TOTP
4. **Benefit of 2FA** - 2FA benefits explanation
5. **Security Notes** - Security implementation notes
6. **Action Buttons** - Continue, Cancel buttons

### Two-Factor Authentication Setup Screen Layout
1. **QR Code** - Setup QR code
2. **Secret Key** - Manual entry secret key for Google Authenticator

### Two-Factor Authentication Verify Screen Layout
1. **Title** - Verify Setup
2. **Description** - Enter 6-digit verification code
3. **6 Input Numbers** - Code input fields 1-6
4. **Troubleshooting** - Time synchronization, Code expiry, QR code tips
5. **Action Buttons** - Next, Back buttons

### Two-Factor Authentication Backup Codes Screen Layout
1. **Important Card** - Backup codes importance warning
2. **Title** - Your Emergency Backup Codes
3. **Backup Codes** - 10 backup codes with Copy button
4. **Security Guidelines Card** - Storage guidelines, Usage rules, Regeneration options
5. **Confirmation** - Safe storage confirmation checkbox
6. **Action Button** - Finish setup button

### Two-Factor Authentication Complete Screen Layout
1. **Title** - Two-Factor Authentication Enabled!
2. **Description** - Account now protected with 2FA
3. **What's Protected Card** - Protected features list
4. **Next Steps Card** - Authenticator app requirement, Backup code safety, Management options
5. **Action Button** - Done button

---

**Document Prepared By:** Crypto Gadai Development Team  
**Classification:** Internal Development Use  
**Next Review Date:** October 1, 2025