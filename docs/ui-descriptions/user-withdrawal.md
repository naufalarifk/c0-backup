# User Withdrawal - UI Description

This document provides detailed textual descriptions of the User Withdrawal feature UI pages, organized in logical user flow order.

## 1. List Withdrawal Address (Empty State)

**Page Title:** List Withdrawal Address

**Navigation:**
- Back button (arrow icon) in the top-left corner to return to the previous screen

**Elements:**

1. **Add Withdrawal Address Button** (Primary Action Button)
   - Text: "+ Add Withdrawal Address"
   - Color: Blue (primary)
   - Full-width button positioned at the top of the content area
   - Function: Navigates user to the Add Withdrawal Address page
   - User interaction: Tap to add a new withdrawal address

2. **Empty State Display** (Informational Section)
   - Icon: Document/file icon in a circular container (gray)
   - Message: "Withdrawal address not found"
   - Function: Informs user that no withdrawal addresses have been added yet
   - User interaction: No interaction, display only

**User Flow:**
When users first access withdrawal addresses and have none configured, they see this empty state encouraging them to add their first withdrawal address.

---

## 2. Add Withdrawal Address

**Page Title:** Add Withdrawal Address

**Navigation:**
- Back button (arrow icon) in the top-left corner to return to the List Withdrawal Address page

**Elements:**

1. **Security Notice Banner** (Alert/Warning Component)
   - Icon: Shield icon (orange/warning color)
   - Text: "For your security, all withdrawal addresses must be verified via email before use"
   - Function: Informs users about the security requirement for address verification
   - User interaction: Read-only informational display

2. **Select Blockchains Section** (Dropdown/Select Component)
   - Label: "Select Blockchains"
   - Current Selection Display:
     - Cryptocurrency icon (e.g., Bitcoin icon)
     - Primary text: "Bitcoin (BTC)"
     - Secondary text: "Bitcoin Network"
   - Dropdown indicator (chevron down icon)
   - Function: Allows users to select which blockchain network for the withdrawal address
   - User interaction: Tap to open dropdown menu and select blockchain

3. **Wallet Address Section** (Input Field)
   - Label: "Wallet Address"
   - Input field with placeholder: "Enter wallet address..."
   - Paste button (clipboard icon) on the right side of input field
   - Helper text below: "Enter address to validate format"
   - Function: Accepts the wallet address input from user
   - User interaction: Type or paste wallet address

4. **Address Format Examples Section** (Informational Card)
   - Title: "Address Format Examples"
   - Examples listed:
     - "Bitcoin:" with example address "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2b..."
     - "Ethereum/BSC:" with example address "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2b..."
     - "Solana:" with example address "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2b..."
   - Function: Provides reference examples for correct address formats
   - User interaction: Read-only reference information

5. **Warning Messages** (Alert Components)
   - First warning (red alert icon):
     - Text: "Double-check your address. Funds sent to wrong addresses cannot be recovered"
   - Second warning (red alert icon):
     - Text: "Only add addresses you control. Test with small amounts first"
   - Function: Warns users about the irreversible nature of blockchain transactions
   - User interaction: Read-only safety warnings

6. **Add Withdrawal Address Button** (Primary Action Button)
   - Text: "Add Withdrawal Address"
   - Color: White background (secondary/outline style)
   - Full-width button at the bottom
   - Function: Submits the form to add the withdrawal address
   - User interaction: Tap to submit and proceed to email verification

**User Flow:**
Users select their desired blockchain, enter or paste their wallet address, review format examples and warnings, then submit to add the address. This triggers an email verification process.

---

## 3. Email Verification

**Page Title:** Email Verification

**Navigation:**
- Back button (arrow icon) in the top-left corner

**Elements:**

1. **Status Icon** (Visual Indicator)
   - Icon: Email/envelope icon in a circular container (green/mint color)
   - Function: Visual confirmation that email was sent
   - User interaction: No interaction, display only

2. **Main Message** (Text Display)
   - Heading: "Check your email"
   - Description: "We sent a verification link to"
   - Function: Informs user to check their email
   - User interaction: Read-only information

3. **Email Display** (Information Card)
   - Text: "john.doe@example.com"
   - Background: Light gray card
   - Function: Shows the email address where verification was sent
   - User interaction: Read-only display

4. **Instructions** (Helper Text)
   - Text: "Click the link in the email to verify your account. If you don't see it, check your spam folder."
   - Function: Provides guidance on next steps
   - User interaction: Read-only instructions

**User Flow:**
After adding a withdrawal address, users are shown this page confirming that a verification email has been sent. They must check their email and click the verification link to proceed.

---

## 4. Verify Withdrawal Address - Success

**Page Title:** Verify Withdrawal Address

**Navigation:**
- Back button (arrow icon) in the top-left corner

**Elements:**

1. **Status Icon** (Visual Indicator)
   - Icon: Checkmark icon in a circular container (green)
   - Function: Visual confirmation of successful verification
   - User interaction: No interaction, display only

2. **Success Message** (Text Display)
   - Heading: "Withdrawal address has been verified"
   - Description: "Your withdrawal address has been verified and is now ready to use."
   - Function: Confirms successful verification
   - User interaction: Read-only information

3. **Address Details Card** (Information Display)
   - Title: "Address Details"
   - Fields:
     - "Currency & Network" label with value "Bitcoin (BTC)" and info icon
     - "Wallet Address" label
     - Address display: "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP" (formatted for readability)
   - Success indicator: Green checkmark icon with text "This address is now ready for withdraw..."
   - Function: Shows verified address details
   - User interaction: Info icon can be tapped for additional network information

4. **Continue to Withdrawal Button** (Primary Action Button)
   - Text: "Continue to Withdrawal"
   - Color: Blue (primary)
   - Full-width button
   - Function: Navigates to the withdrawal form with this address pre-selected
   - User interaction: Tap to proceed to withdrawal

5. **Return to App Button** (Secondary Action Button)
   - Text: "Return to App"
   - Color: White background (secondary)
   - Full-width button
   - Function: Returns user to the main app interface
   - User interaction: Tap to exit verification flow

6. **View My Addresses Link** (Tertiary Action)
   - Text: "View My Addresses"
   - Style: Text link (underlined)
   - Function: Navigates to the list of all withdrawal addresses
   - User interaction: Tap to view all addresses

**User Flow:**
After clicking the verification link in their email, users see this success page confirming their address is verified. They can continue to make a withdrawal, return to the app, or view all their addresses.

---

## 5. Verify Withdrawal Address - Failed

**Page Title:** Verify Withdrawal Address

**Navigation:**
- Back button (arrow icon) in the top-left corner

**Elements:**

1. **Status Icon** (Visual Indicator)
   - Icon: X/close icon in a circular container (red)
   - Function: Visual indication of failed verification
   - User interaction: No interaction, display only

2. **Error Message** (Text Display)
   - Heading: "Verification Failed"
   - Description: "We couldn't verify your withdrawal address. Please check the details below."
   - Function: Informs user of verification failure
   - User interaction: Read-only information

3. **Error Details Card** (Information Display)
   - Title: "What went wrong?"
   - Explanation: "Adding new withdrawal address failed. The address may be invalid or server error.."
   - Instruction: "Please request new withdrawal address"
   - Function: Provides specific error information and guidance
   - User interaction: Read-only information

4. **Request New Verification Button** (Primary Action Button)
   - Text: "Request New Verification"
   - Color: Blue (primary)
   - Full-width button
   - Function: Initiates a new verification request
   - User interaction: Tap to request new verification email

5. **Return to App Button** (Secondary Action Button)
   - Text: "Return to App"
   - Color: White background (secondary)
   - Full-width button
   - Function: Returns user to the main app
   - User interaction: Tap to exit and return to app

6. **Contact Support Link** (Tertiary Action)
   - Text: "Contact Support"
   - Style: Text link (underlined)
   - Function: Opens support contact options
   - User interaction: Tap to view support options

7. **Support Information Section** (Informational Display)
   - Heading: "Still having trouble?"
   - Description: "Our support team is here to help you complete the verification process."
   - Support options:
     - "Email Support" with email icon
     - "Live Chat" with chat icon
   - Function: Provides alternative support channels
   - User interaction: Tap on email or chat options to contact support

**User Flow:**
If verification fails (invalid link, expired link, or server error), users see this error page with explanation and options to retry or contact support.

---

## 6. Verify Withdrawal Address - Already Verified

**Page Title:** Verify Withdrawal Address

**Navigation:**
- Back button (arrow icon) in the top-left corner

**Elements:**

1. **Status Icon** (Visual Indicator)
   - Icon: Information/exclamation icon in a circular container (orange/warning)
   - Function: Visual indication that address already exists
   - User interaction: No interaction, display only

2. **Status Message** (Text Display)
   - Heading: "Already Exists"
   - Description: "This address has already been verified and is ready for use."
   - Function: Informs user the address was previously verified
   - User interaction: Read-only information

3. **Address Details Card** (Information Display)
   - Title: "Address Details"
   - Fields:
     - "Currency & Network" label with value "Bitcoin (BTC)" and info icon
     - "Wallet Address" label
     - Address display: "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP"
   - Success indicator: Green checkmark icon with text "This address is now ready for withdraw..."
   - Verification timestamp: "Verified On" with date "Jan 15, 2025"
   - Function: Shows the already-verified address details
   - User interaction: Info icon can be tapped for network information

4. **Continue to Withdrawal Button** (Primary Action Button)
   - Text: "Continue to Withdrawal"
   - Color: Blue (primary)
   - Full-width button
   - Function: Proceeds to withdrawal form with this address
   - User interaction: Tap to start withdrawal

5. **Return to App Button** (Secondary Action Button)
   - Text: "Return to App"
   - Color: White background (secondary)
   - Full-width button
   - Function: Returns to main app interface
   - User interaction: Tap to exit

6. **View My Addresses Link** (Tertiary Action)
   - Text: "View My Addresses"
   - Style: Text link (underlined)
   - Function: Shows all saved withdrawal addresses
   - User interaction: Tap to view address list

**User Flow:**
If users click a verification link for an address that's already been verified, they see this page informing them the address is already active and ready to use.

---

## 7. List Withdrawal Address (With Addresses)

**Page Title:** List Withdrawal Address

**Navigation:**
- Back button (arrow icon) in the top-left corner

**Elements:**

1. **Add Withdrawal Address Button** (Primary Action Button)
   - Text: "+ Add Withdrawal Address"
   - Color: Blue (primary)
   - Full-width button at the top
   - Function: Navigates to Add Withdrawal Address page
   - User interaction: Tap to add new address

2. **Withdrawal Address Cards** (List of Card Components)

   Each card contains:
   - **Cryptocurrency Icon and Name**
     - Icon: Cryptocurrency logo (e.g., Bitcoin, Ethereum)
     - Text: "Bitcoin (BTC)" or "Ethereum (ETH)"
     - Function: Identifies the blockchain
     - User interaction: Visual identification only

   - **Verification Badge**
     - Text: "Verified"
     - Color: Green badge with checkmark icon
     - Position: Top-right of card
     - Function: Shows verification status
     - User interaction: Visual indicator only

   - **Wallet Address Display**
     - Text: Full wallet address (e.g., "1BvBMSEYstWetqTFn5Au4m4GFg7xJaN", "x6vBMSEYstWetqTFn5Au4m4GFg7xJaN", "x0vBMSEYstWetqTFn5Au4m4GFg7xJaN")
     - Function: Shows the saved wallet address
     - User interaction: Read-only display

   - **Withdraw Button** (Primary Action)
     - Text: "Withdraw"
     - Color: Blue (primary)
     - Function: Initiates withdrawal using this address
     - User interaction: Tap to start withdrawal with this address

   - **Remove Button** (Secondary Action)
     - Text: "Remove"
     - Color: Gray/neutral (text only)
     - Function: Deletes this withdrawal address
     - User interaction: Tap to remove address (likely shows confirmation)

**Example Cards Shown:**
- Bitcoin (BTC) - "1BvBMSEYstWetqTFn5Au4m4GFg7xJaN" - Verified
- Ethereum (ETH) - "x6vBMSEYstWetqTFn5Au4m4GFg7xJaN" - Verified
- Bitcoin (BTC) - "x0vBMSEYstWetqTFn5Au4m4GFg7xJaN" - Verified

**User Flow:**
Users can view all their saved and verified withdrawal addresses. They can add new addresses, initiate withdrawals with existing addresses, or remove addresses they no longer need.

---

## 8. Withdrawal Form

**Page Title:** Withdrawal

**Navigation:**
- Back button (arrow icon) in the top-left corner to return to address list

**Elements:**

1. **Security Notice Banner** (Alert/Information Component)
   - Icon: Lock icon
   - Text: "Withdrawals require two-factor authentication for security"
   - Function: Informs users about 2FA requirement
   - User interaction: Read-only informational display

2. **Selected Address Section** (Information Display)
   - Label: "Selected Address"
   - Address display: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaN..." (truncated)
   - Verification badge: "Verified" with green checkmark
   - Function: Shows the withdrawal destination address
   - User interaction: Display only (pre-selected from address list)

3. **Select Currency Section** (Dropdown Component)
   - Label: "Select Currency"
   - Current selection:
     - Cryptocurrency icon (Bitcoin)
     - Text: "Bitcoin (BTC)"
     - Dropdown indicator (chevron down)
   - Function: Allows user to select which cryptocurrency to withdraw
   - User interaction: Tap to open currency dropdown

4. **Current Balance Display** (Information Card)
   - Label: "Current Balance"
   - Amount: "0.5834 BTC"
   - USD equivalent: "H 24,567.89 USDT"
   - Function: Shows available balance for withdrawal
   - User interaction: Read-only information

5. **Amount to Withdraw Section** (Input Field)
   - Label: "Amount to Withdraw"
   - Input field: "0.2834 BTC"
   - Max button: "max" link on the right
   - Helper text: "Minimum withdrawal: 0.001 BTC"
   - Function: Accepts withdrawal amount from user
   - User interaction: Type amount or tap "max" to fill with maximum available

6. **Fee Breakdown Card** (Information Display)
   - Title: "Fee Breakdown"
   - Fields:
     - "Platform Fee": "0.0002 BTC"
     - "You will receive": "0.2833 BTC" (emphasized)
   - Function: Shows fee calculation and net amount
   - User interaction: Read-only calculation display

7. **Warning Messages** (Alert Components)
   - First warning (red alert icon):
     - Text: "Verify the address carefully. Transactions cannot be reversed."
   - Second warning (red alert icon):
     - Text: "Processing typically takes 1-6 confirmations depending on network."
   - Function: Warns users about transaction finality and timing
   - User interaction: Read-only safety warnings

8. **Confirm Withdrawal Button** (Primary Action Button)
   - Text: "Confirm Withdrawal"
   - Color: White background (secondary/outline)
   - Full-width button at bottom
   - Function: Proceeds to 2FA verification
   - User interaction: Tap to confirm and proceed to authentication

**User Flow:**
Users review the selected address, choose currency, enter withdrawal amount, review fees, and confirm. This initiates the two-factor authentication process.

---

## 9. Two-Factor Authentication (2FA)

**Page Title:** Two-Factor Authentication

**Navigation:**
- Back button (arrow icon) in the top-left corner

**Elements:**

1. **Instruction Text** (Text Display)
   - Main heading: "Please enter your 2FA code to continue withdrawal"
   - Description: "Enter the 6-digit code from your authenticator app to verify setup"
   - Function: Instructs user on what to enter
   - User interaction: Read-only instructions

2. **6-Digit Code Input** (Input Fields)
   - Six individual input boxes displaying: "5", "2", "8", "9", "5", "4"
   - Function: Accepts 6-digit 2FA code from authenticator app
   - User interaction: Type or paste 6-digit code

3. **Timer Display** (Countdown Component)
   - Text: "New code in 23s"
   - Function: Shows countdown until next valid code
   - User interaction: Visual indicator only

4. **Help Section** (Information Card)
   - Icon: Warning/info icon (orange)
   - Title: "Having trouble?"
   - Tips list:
     - "Make sure your device time is synchronized"
     - "Wait for the next code if the current one expired"
     - "Check that you scanned the correct QR code"
   - Function: Provides troubleshooting guidance
   - User interaction: Read-only help information

5. **Continue Button** (Primary Action Button)
   - Text: "Continue"
   - Color: Blue (primary)
   - Full-width button
   - Function: Validates 2FA code and proceeds
   - User interaction: Tap to submit code

6. **Back Button** (Secondary Action Button)
   - Text: "Back"
   - Color: White background (secondary)
   - Full-width button
   - Function: Returns to withdrawal form
   - User interaction: Tap to go back

**User Flow:**
After confirming withdrawal, users must enter their 2FA code from their authenticator app. Once validated, they proceed to OTP verification.

---

## 10. Enter OTP Code

**Page Title:** Enter OTP Code

**Navigation:**
- Back button (arrow icon) in the top-left corner

**Elements:**

1. **Instruction Text** (Text Display)
   - Main heading: "Please enter your OTP Code to continue withdrawal"
   - Description: "Enter the 6-digit code from your Phone number"
   - Function: Instructs user to enter SMS/phone OTP
   - User interaction: Read-only instructions

2. **6-Digit Code Input** (Input Fields)
   - Six individual input boxes displaying: "5", "2", "8", "9", "5", "4"
   - Function: Accepts 6-digit OTP code sent to phone
   - User interaction: Type the code received via SMS

3. **Timer Display** (Countdown Component)
   - Text: "New code in 23s"
   - Function: Shows countdown for code expiration/resend availability
   - User interaction: Visual indicator only

4. **Help Section** (Information Card)
   - Icon: Warning/info icon (orange)
   - Title: "Having trouble?"
   - Tips list:
     - "Make sure your device time is synchronized"
     - "Wait for the next code if the current one expired"
     - "Check that you scanned the correct QR code"
   - Function: Provides troubleshooting assistance
   - User interaction: Read-only help information

5. **Continue Button** (Primary Action Button)
   - Text: "Continue"
   - Color: Blue (primary)
   - Full-width button
   - Function: Validates OTP and submits withdrawal request
   - User interaction: Tap to submit and process withdrawal

6. **Back Button** (Secondary Action Button)
   - Text: "Back"
   - Color: White background (secondary)
   - Full-width button
   - Function: Returns to previous screen (2FA)
   - User interaction: Tap to go back

**User Flow:**
After 2FA verification, users must enter the OTP code sent to their phone number. Once validated, the withdrawal is submitted and they see the withdrawal status page.

---

## 11. Withdrawal Status

**Page Title:** Withdrawal

**Navigation:**
- Back button (arrow icon) in the top-left corner

**Elements:**

1. **Withdrawal Summary Card** (Information Display)
   - Cryptocurrency icon and amount: Bitcoin icon with "0.025 BTC"
   - USD equivalent: "H$1,247.50"
   - Fields:
     - "Destination": "bc1q...7x8kr" with copy icon
     - "Transaction ID": "abc123...def456" with copy icon
     - "Initiated": "Jan 16, 2025 - 14:30"
   - Function: Shows key withdrawal details
   - User interaction: Tap copy icons to copy destination or transaction ID

2. **Progress Section** (Stepper/Progress Indicator)
   - Title: "Progress"
   - Steps:
     1. **Requested** (Completed - blue checkmark)
        - Text: "Withdrawal request received"
     2. **Processing** (Current - blue indicator)
        - Text: "Preparing blockchain transaction"
     3. **Confirming** (Pending - gray indicator)
        - Text: "Waiting for confirmations (2 of 6)"
     4. **Completed** (Pending - gray indicator)
        - Text: "Transaction confirmed"
   - Function: Shows current withdrawal progress status
   - User interaction: Visual progress indicator only

3. **Blockchain Information Card** (Information Display)
   - Title: "Blockchain Information"
   - Fields:
     - "Transaction Hash": "abc123...def456" with copy icon
     - "Network Fees": "0.0001 BTC"
     - "Block Number": "Pending"
   - Function: Shows blockchain-specific transaction details
   - User interaction: Tap copy icon to copy transaction hash

4. **View on Explorer Button** (Secondary Action Button)
   - Text: "View on Explorer" with external link icon
   - Color: Blue (primary)
   - Full-width button
   - Function: Opens blockchain explorer to view transaction
   - User interaction: Tap to view transaction on blockchain explorer

5. **Estimated Completion Section** (Information Display)
   - Title: "Estimated Completion"
   - Estimate: "Typically takes 10-30 minutes for Bitcoin"
   - Status indicator: "Network conditions are normal" (orange text with icon)
   - Function: Provides time estimate and network status
   - User interaction: Read-only information

6. **Share Transaction Button** (Tertiary Action Button)
   - Text: "Share Transaction" with share icon
   - Color: White background (secondary)
   - Full-width button
   - Function: Shares transaction details
   - User interaction: Tap to open share options

7. **Download Receipt Button** (Tertiary Action Button)
   - Text: "Download Receipt" with download icon
   - Color: White background (secondary)
   - Full-width button
   - Function: Downloads transaction receipt
   - User interaction: Tap to download receipt file

8. **Contact Support Button** (Tertiary Action Button)
   - Text: "Contact Support" with headset icon
   - Color: White background (secondary)
   - Full-width button
   - Function: Opens support contact options
   - User interaction: Tap to contact support

9. **Auto-Update Notice** (Information Banner)
   - Icon: Info icon (orange)
   - Text: "Status updates automatically every 30 seconds"
   - Function: Informs users the page auto-refreshes
   - User interaction: Read-only information

**User Flow:**
After successfully submitting withdrawal (passing 2FA and OTP), users see this status page showing real-time progress of their withdrawal through blockchain confirmations. They can view details, check blockchain explorer, download receipt, or contact support if needed.

---

## Complete User Journey Summary

1. **Empty State** ’ User sees they have no addresses and taps "Add Withdrawal Address"
2. **Add Address** ’ User selects blockchain, enters wallet address, submits
3. **Email Verification** ’ User receives email and clicks verification link
4. **Verification Result** ’ User sees success (or failure/already exists) and continues
5. **Address List** ’ User views verified addresses and taps "Withdraw" on one
6. **Withdrawal Form** ’ User enters amount, reviews fees, confirms
7. **2FA Authentication** ’ User enters authenticator app code
8. **OTP Verification** ’ User enters phone OTP code
9. **Withdrawal Status** ’ User monitors withdrawal progress in real-time

**Key Security Features:**
- Email verification for new addresses
- Two-factor authentication (2FA) requirement
- OTP phone verification
- Multiple warnings about irreversible transactions
- Address format validation and examples

**Key User Experience Features:**
- Clear progress tracking
- Helpful error messages with recovery options
- Support contact options throughout
- Real-time status updates
- Copy-to-clipboard functionality for addresses and transaction IDs
- Blockchain explorer integration
- Receipt download capability
