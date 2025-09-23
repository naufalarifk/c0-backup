# User Withdrawal UI Descriptions

This document provides detailed textual descriptions of the user withdrawal flow UI pages. Pages are arranged in logical order based on the typical user journey.

## 1. List Withdrawal Address (Empty State)

**Page Title:** List Withdrawal Address

**Navigation:**
- Back arrow button (top-left)
- Page title "List Withdrawal Address" in header

**Main Content:**
- Blue "Add Withdrawal Address" button with plus icon at the top
- When no addresses exist, the page shows an empty state below the button

**User Interaction:**
- User can tap the back arrow to return to previous page
- User can tap "Add Withdrawal Address" button to navigate to the address addition flow

## 2. Add Withdrawal Address

**Page Title:** Add Withdrawal Address

**Navigation:**
- Back arrow button (top-left)
- Page title "Add Withdrawal Address" in header

**Security Alert:**
- Orange warning icon with text: "For your security, all withdrawal addresses must be verified via email before use"

**Form Sections:**

### Select Blockchains
- Section title "Select Blockchains"
- Dropdown selector showing "Bitcoin (BTC)" with Bitcoin icon and "Bitcoin Network" subtitle
- Dropdown arrow indicating expandable options

### Wallet Address
- Section title "Wallet Address"
- Input field with placeholder text "Enter wallet address..."
- QR code scan button (camera icon) on the right side of input
- Helper text below: "Enter address to validate format"

### Address Format Examples
- Section title "Address Format Examples"
- Three example cards:
  - **Bitcoin:** `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2b...`
  - **Ethereum/BSC:** `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2b...`
  - **Solana:** `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2b...`

**Warning Messages:**
- Red triangle warning: "Double-check your address. Funds sent to wrong addresses cannot be recovered"
- Red triangle warning: "Only add addresses you control. Test with small amounts first"

**Action Button:**
- Blue "Add Withdrawal Address" button at bottom

**User Interaction:**
- User selects blockchain from dropdown
- User enters wallet address manually or scans QR code
- User reviews format examples to ensure correct address format
- User taps "Add Withdrawal Address" to submit the form

## 3. Verify Withdrawal Address (Success)

**Page Title:** Verify Withdrawal Address

**Navigation:**
- Back arrow button (top-left)

**Success State:**
- Large green checkmark icon in circular background
- Main message: "Withdrawal address has been verified"
- Subtitle: "Your withdrawal address has been verified and is now ready to use."

**Address Details Card:**
- Section title "Address Details"
- Currency & Network: "Bitcoin (BTC)" with info icon
- Wallet Address section showing: `JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP`
- Green checkmark with text: "This address is now ready for withdraw..."

**Action Buttons:**
- Blue "Continue to Withdrawal" button
- Gray "Return to App" button
- Gray "View My Addresses" text link

**User Interaction:**
- User can view verified address details
- User can tap "Continue to Withdrawal" to proceed with withdrawal
- User can tap "Return to App" to go back to main app
- User can tap "View My Addresses" to see all addresses

## 4. Verify Withdrawal Address (Failed)

**Page Title:** Verify Withdrawal Address

**Navigation:**
- Back arrow button (top-left)

**Failed State:**
- Large red X icon in circular background
- Main message: "Verification Failed"
- Subtitle: "We couldn't verify your withdrawal address. Please check the details below."

**Error Information:**
- Section title "What went wrong?"
- Error message: "Adding new withdrawal address failed. The address may be invalid or server error.."
- Gray box with text: "Please request new withdrawal address"

**Action Buttons:**
- Blue "Request New Verification" button
- Gray "Return to App" button

**Support Section:**
- "Contact Support" link
- "Still having trouble?" text
- Description: "Our support team is here to help you complete the verification process."
- Two support options:
  - Email Support (with email icon)
  - Live Chat (with chat icon)

**User Interaction:**
- User reads error information
- User can tap "Request New Verification" to retry
- User can contact support via email or live chat
- User can return to app

## 5. Verify Withdrawal Address (Already Verified)

**Page Title:** Verify Withdrawal Address

**Navigation:**
- Back arrow button (top-left)

**Already Verified State:**
- Large orange exclamation mark icon in circular background
- Main message: "Already Exists"
- Subtitle: "This address has already been verified and is ready for use."

**Address Details Card:**
- Section title "Address Details"
- Currency & Network: "Bitcoin (BTC)" with info icon
- Wallet Address: `JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP`
- Green checkmark: "This address is now ready for withdraw..."
- Verified On: "Jan 15, 2025"

**Action Buttons:**
- Blue "Continue to Withdrawal" button
- Gray "Return to App" button
- Gray "View My Addresses" text link

**User Interaction:**
- User sees that address is already verified
- User can proceed to withdrawal or return to app
- User can view all their addresses

## 6. List Withdrawal Address (With Addresses)

**Page Title:** List Withdrawal Address

**Navigation:**
- Back arrow button (top-left)
- Blue "Add Withdrawal Address" button with plus icon

**Address List:**
Each address card contains:

### Bitcoin Address 1:
- Bitcoin icon with "Bitcoin (BTC)" label
- Green "Verified" status badge
- Address: `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2b...`
- Blue "Withdraw" button
- Gray "Remove" button

### Ethereum Address:
- Ethereum icon with "Ethereum (ETH)" label
- Green "Verified" status badge
- Address: `x6vBMSEYstWetqTFn5Au4m4GFg7xJaNVN...`
- Blue "Withdraw" button
- Gray "Remove" button

### Bitcoin Address 2:
- Bitcoin icon with "Bitcoin (BTC)" label
- Green "Verified" status badge
- Address: `x0vBMSEYstWetqTFn5Au4m4GFg7xJaNVN...`
- Blue "Withdraw" button
- Gray "Remove" button

**User Interaction:**
- User can add new addresses via the top button
- User can initiate withdrawal from any verified address
- User can remove addresses they no longer need
- Each address shows verification status clearly

## 7. Withdrawal Form

**Page Title:** Withdrawal

**Navigation:**
- Back arrow button (top-left)

**Security Notice:**
- Lock icon with text: "Withdrawals require two-factor authentication for security"

**Form Sections:**

### Selected Address
- Truncated address: `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2b...`
- Green "Verified" badge

### Select Currency
- Dropdown showing "Bitcoin (BTC)" with Bitcoin icon and dropdown arrow

### Current Balance Card
- "Current Balance" label
- Amount: "0.5834 BTC"
- USD equivalent: "H 24,567.89 USDT"

### Amount to Withdraw
- Input field showing "0.2834 BTC"
- "max" button on the right
- Helper text: "Minimum withdrawal: 0.001 BTC"

### Fee Breakdown Card
- "Fee Breakdown" section title
- Platform Fee: "0.0002 BTC"
- "You will receive": "0.2833 BTC"

**Warning Messages:**
- Red triangle: "Verify the address carefully. Transactions cannot be reversed."
- Red triangle: "Processing typically takes 1-6 confirmations depending on network."

**Action Button:**
- Gray "Confirm Withdrawal" button

**User Interaction:**
- User verifies the selected address
- User can change currency if multiple options available
- User enters withdrawal amount or uses "max" button
- User reviews fees and final amount
- User reads warnings before confirming
- User taps "Confirm Withdrawal" to proceed

## 8. Two-Factor Authentication

**Page Title:** Two-Factor Authentication

**Navigation:**
- Back arrow button (top-left)

**Main Content:**
- Title: "Please enter your 2FA code to continue withdrawal"
- Subtitle: "Enter the 6-digit code from your authenticator app to verify setup"

**Code Input:**
- Six individual boxes for digits: 5, 2, 8, 9, 5, 4
- Timer showing "New code in 23s"

**Troubleshooting Section:**
- Orange warning icon with "Having trouble?"
- Bullet points:
  - "Make sure your device time is synchronized"
  - "Wait for the next code if the current one expired"
  - "Check that you scanned the correct QR code"

**Action Buttons:**
- Blue "Continue" button
- Gray "Back" button

**User Interaction:**
- User enters 6-digit 2FA code from authenticator app
- User waits for new code if current one expires
- User can tap "Continue" to proceed or "Back" to return

## 9. OTP Code Entry

**Page Title:** Enter OTP Code

**Navigation:**
- Back arrow button (top-left)

**Main Content:**
- Title: "Please enter your OTP Code to continue withdrawal"
- Subtitle: "Enter the 6-digit code from your Phone number"

**Code Input:**
- Six individual boxes for digits: 5, 2, 8, 9, 5, 4
- Timer showing "New code in 23s"

**Troubleshooting Section:**
- Orange warning icon with "Having trouble?"
- Same bullet points as 2FA page:
  - "Make sure your device time is synchronized"
  - "Wait for the next code if the current one expired"
  - "Check that you scanned the correct QR code"

**Action Buttons:**
- Blue "Continue" button
- Gray "Back" button

**User Interaction:**
- User enters 6-digit OTP code received via SMS
- User waits for new code if needed
- User can proceed or go back

## 10. Withdrawal Status

**Page Title:** Withdrawal

**Navigation:**
- Back arrow button (top-left)

**Transaction Summary Card:**
- Bitcoin icon with "0.025 BTC" amount
- USD equivalent: "$1,247.50"
- Destination: "bc1q...7x8k" with copy icon
- Transaction ID: "abc123...def456" with copy icon
- Initiated: "Jan 16, 2025 - 14:30"

**Progress Section:**
- Title: "Progress"
- Four-step progress indicator:
  1. **Requested** (completed - blue checkmark): "Withdrawal request received"
  2. **Processing** (current - blue dot): "Preparing blockchain transaction"
  3. **Confirming** (pending - gray): "Waiting for confirmations (2 of 6)"
  4. **Completed** (pending - gray): "Transaction confirmed"

**Blockchain Information Card:**
- Transaction Hash: "abc123...def456" with copy icon
- Network Fees: "0.0001 BTC"
- Block Number: "Pending"
- Blue "View on Explorer" button with external link icon

**Estimated Completion:**
- "Typically takes 10-30 minutes for Bitcoin"
- Orange info icon: "Network conditions are normal"

**Action Buttons:**
- "Share Transaction" button with share icon
- "Download Receipt" button with download icon
- "Contact Support" button with support icon

**Status Updates:**
- Orange info box: "Status updates automatically every 30 seconds"

**User Interaction:**
- User can copy transaction details using copy icons
- User can view transaction on blockchain explorer
- User can share transaction details
- User can download receipt for records
- User can contact support if needed
- Page automatically updates transaction status
