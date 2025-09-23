# User Loan Application Creation - UI Descriptions

This document provides detailed textual descriptions of the UI pages for the user loan application creation flow, arranged in logical sequence.

## Page 1: Apply for Loan - Initial Parameters

### Header Section
- **Navigation**: Back arrow button (top-left) to return to previous screen
- **Page Title**: "Apply for Loan" (center-aligned)
- **Info Alert**: Orange warning icon with text "Individual users can both lend and borrow" with subtext "Institution users can only lend"

### Progress Indicator
- **Step Counter**: "Step 1 of 3" with "33%" completion
- **Progress Bar**: Blue progress indicator showing 1/3 completion
- **Tab Navigation**: Three tabs labeled "Parameters", "Review", "Fund"

### Main Form Content

#### Loan Amount Section
- **Section Title**: "How much USDT do you need?"
- **Principal Amount Field**:
  - Label: "Principal Amount"
  - Input Field: Number input with placeholder "10,000" and "USDT" suffix
  - User Interaction: Tap to enter desired loan amount

#### Date Selection
- **Expired Date Field**:
  - Label: "Expired Date"
  - Date Picker: Shows "00-00-0000" placeholder with calendar icon
  - User Interaction: Tap calendar icon to select expiration date

#### Loan Terms Section
- **Section Title**: "Loan terms you're willing to accept:"
- **Max Interest Rate Field**:
  - Label: "Max Interest Rate"
  - Input Field: Number input with "0,0" placeholder and "%" suffix
  - User Interaction: Enter maximum acceptable interest rate percentage

#### Term Length Selection
- **Preferred Term Length**:
  - Label: "Preferred Term Length"
  - Button Group: Three radio buttons - "1 month", "3 month", "6 month"
  - User Interaction: Tap to select preferred loan duration

#### Collateral Selection
- **Section Title**: "What can you offer as collateral?"
- **Cryptocurrency Options**: List of selectable cryptocurrency cards:
  - **Bitcoin (BTC)**: Orange Bitcoin icon, "Bitcoin Network" subtitle
  - **Ethereum (ETH)**: Blue Ethereum icon, "Ethereum Network" subtitle
  - **Solana (SOL)**: Teal Solana icon, "Solana Network" subtitle
  - **BNB**: Yellow BNB icon, "Binance Smart Chain" subtitle
- **Network Status**: Green checkmark with "Network compatibility verified"
- **User Interaction**: Tap cryptocurrency cards to select collateral type

#### Risk Management Section
- **Section Title**: "Risk Management"
- **Liquidation Mode Label**: "Liquidation Mode"
- **Liquidation Options**: Two radio button cards:
  - **Partial Liquidation**:
    - Description: "Sell only enough collateral to maintain LTV ratio. Lower risk, gradual recovery."
    - User Interaction: Select for conservative risk approach
  - **Full Liquidation**:
    - Description: "Sell all collateral immediately when LTV is breached. Higher recovery but more aggressive."
    - User Interaction: Select for aggressive risk approach

### Action Buttons
- **Primary Button**: "Continue Calculating" (blue, full-width)
- **Secondary Button**: "Back" (text button, center-aligned)
- **User Interaction**: Tap "Continue Calculating" to proceed to next step

---

## Page 2: Apply for Loan - Filled Parameters

### Content Changes from Page 1
This page shows the same layout as Page 1 but with user-filled data:

#### Filled Fields
- **Principal Amount**: "10,000 USDT"
- **Expired Date**: "09-09-2025"
- **Max Interest Rate**: "7.5%"
- **Preferred Term Length**: "3 month" (selected with green checkmark)
- **Collateral**: Bitcoin (BTC) selected (green checkmark)
- **Liquidation Mode**: "Partial Liquidation" selected (green checkmark)

### User Interaction
- All fields remain editable for modifications
- Tapping "Continue Calculating" proceeds to review stage

---

## Page 3: Apply for Loan - Review & Agreement

### Header Section
- **Navigation**: Back arrow button
- **Page Title**: "Apply for Loan"
- **Info Alert**: Same orange warning about user types
- **Progress**: "Step 1 of 3" with "66%" completion showing Parameters > Review > Fund tabs

### Market Information
- **Section Title**: "Current Market Rates"
- **Rate Display**:
  - Currency pair icons (Tether + Bitcoin)
  - Rate: "BTC/USDT 42,350 USDT"
  - Change indicator: "+2.4%" in green

### Application Review
- **Section Title**: "Review Your Application"
- **Summary Card**:
  - **Principal Amount**: 10,000 USDT
  - **Interest Rate**: 7.5%
  - **Provisions (3%)**: 30.00 USDT
  - **Terms**: 3 month
  - **Total Loans**: 12,550.00 USDT (highlighted in larger text)

#### Fee Breakdown
- **Liquidations Fees (2%)**: 200.0 USDT
- **Premium risks (2%)**: 200.0 USDT
- **LTV**: 70%
- **Collateral**: 0.44 BTC

### Legal Agreement Section
- **Section Title**: "Legal Agreement"
- **Contract Download**:
  - Icon: Document icon
  - Text: "Loan Agreement Contract"
  - Action: "Download" button
  - User Interaction: Tap to download loan agreement PDF

#### Agreement Terms Preview
- **1. LOAN TERMS**: "This agreement establishes the terms for cryptocurrency-backed lending between the Lender and Borrower through the CryptoGadai platform."
- **2. COLLATERAL REQUIREMENTS**: "Borrower must deposit acceptable cryptocurrency collateral as specified in the loan parameters. Collateral will be held in escrow until loan repayment."

#### Consent Checkbox
- **Checkbox**: Unchecked state
- **Agreement Text**: "I agree to these terms and conditions"
- **Subtext**: "By checking this box, you acknowledge that you have read, understood, and agree to be bound by the loan agreement terms."
- **User Interaction**: Must check box to proceed

### Action Buttons
- **Primary Button**: "Continue Collateral" (blue, full-width, likely disabled until checkbox is checked)
- **Secondary Button**: "Back" (text button)

---

## Page 4: Deposit Collateral - Invoice

### Header Section
- **Navigation**: Back arrow button
- **Page Title**: "Apply for Loan"
- **Info Alert**: Same orange warning
- **Progress**: "Step 4 of 3" with "100%" completion

### Main Content
- **Section Title**: "Deposit Collateral"
- **Subtitle**: "Deposit collateral to activate your application"

### Invoice Details Card
- **Section Icon**: Credit card icon
- **Section Title**: "Deposit Collateral"
- **Invoice Information**:
  - **Invoice ID**: COL-2847-9163 (with copy icon)
  - **Currency**: Bitcoin (BTC) with orange Bitcoin icon
  - **Network**: Bitcoin Network
  - **Due Date**: 15-07-2025-23:59:59

### Amount Details Card
- **Section Icon**: Calculator/amount icon
- **Section Title**: "Amount Details"
- **Payment Amount**: "Send Exactly 0.44 BTC" (emphasized)
- **Warning**: Red triangle icon with "Sending wrong amount may delay processing"

### Payment Method
- **Section Icon**: QR code icon
- **Section Title**: "Scan QR Code"
- **QR Code**: Large black and white QR code for Bitcoin payment
- **User Interaction**: Scan with cryptocurrency wallet to get payment address

### Address Information
- **Section Title**: "Collateral Address"
- **Bitcoin Address**: "bc1qxy2kgdygjrsqtzq2n0yrf2493p8..." (truncated with copy icon)
- **User Interaction**: Tap copy icon to copy address to clipboard

### Payment Status
- **Section Icon**: Clock icon
- **Section Title**: "Payment Status"
- **Status Text**: "Waiting for collateral deposit..."
- **Instructions List**:
  - "Send exactly 0.31 BTC to the address above"
  - "We'll detect your transaction within minutes"
  - "Your application will be published after confirmation"

### Expiration Notice
- **Warning Icon**: Yellow triangle
- **Title**: "Invoice Expires In"
- **Countdown Timer**: "23:59:59" (blue text, large)
- **Subtext**: "Invoice expires automatically"

### Action Buttons
- **Primary Button**: "Waiting for Payment" (blue, full-width, disabled state)
- **Secondary Button**: "Back to Review"
- **User Interaction**: Button remains disabled until payment is detected

---

## Page 5: Loan Application Submitted - Success

### Success Indicator
- **Success Icon**: Large green circular checkmark icon
- **Title**: "Loan Application Submitted!"
- **Subtitle**: "Your loan application has been successfully submitted and is now under review."

### Summary Details Card
- **Section Icon**: Document icon
- **Section Title**: "Summary Details"
- **Application Information**:
  - **Invoice ID**: COL-2847-9163
  - **Loan Amount**: 12,550 USDT
  - **Collateral**: 0.44 BTC
  - **Interest Rate**: 7.5% APR
  - **Submitted**: Jan 15, 2025 14:30

### Next Steps Card
- **Section Icon**: Information icon
- **Section Title**: "What's Next?"
- **Process Steps**:
  - "Application submitted successfully" (completed)
  - "Review by lender (24-48 hours)"
  - "Approval notification"
  - "Funds disbursement"

### Action Buttons
- **Secondary Actions**: Two icon buttons:
  - **Save PDF**: Document icon with "Save PDF" text
  - **Share**: Share icon with "Share" text
  - **User Interaction**: Tap to save application details or share

### Primary Actions
- **Main Button**: "Continue to Dashboard" (blue, full-width)
- **Secondary Button**: "Track Application Status" (text button)
- **User Interaction**: Tap to navigate to dashboard or track application

### Footer
- **Branding**: "CryptoGadai." logo with shield icon

## User Flow Summary

1. **Parameters Page**: User enters loan amount, terms, collateral type, and risk preferences
2. **Filled Parameters**: Review and modify entered parameters before proceeding
3. **Review & Agreement**: Review calculated loan terms, fees, and accept legal agreement
4. **Deposit Collateral**: Follow payment instructions to deposit required Bitcoin collateral
5. **Success Confirmation**: Confirmation of successful submission with next steps and tracking options

The flow emphasizes transparency with detailed fee breakdowns, clear payment instructions, and comprehensive agreement terms before final submission.