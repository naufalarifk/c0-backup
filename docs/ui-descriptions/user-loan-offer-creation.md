# User Loan Offer Creation - UI Descriptions

This document describes the UI pages for the loan offer creation flow in their logical sequence.

## Page 1: Create Loan Offer - Parameters (Initial State)

**Page Type**: Form Input Page
**Progress**: Step 1 of 3 (33% complete)
**Navigation**: Back arrow, Progress tabs (Parameters, Review, Fund)

### Header Section
- **Back button**: Arrow icon to return to previous screen
- **Title**: "Create Loan Offer"
- **Progress indicator**: "Step 1 of 3" with 33% completion
- **Tab navigation**: Three tabs - "Parameters" (active), "Review", "Fund"

### Main Question
- **Primary heading**: "How much do you want to lend?"

### Loan Amount Section
- **Total Amount field**:
  - Component: Number input field
  - Label: "Total Amount"
  - Placeholder: "10,000"
  - Currency suffix: "USDT"
  - Function: User enters the total amount they want to lend

### Loan Size Range Section
- **Min Loan Size field**:
  - Component: Number input field
  - Label: "Min Loan Size"
  - Placeholder: "0.00"
  - Function: User sets minimum loan amount for borrowers

- **Max Loan Size field**:
  - Component: Number input field
  - Label: "Max Loan Size"
  - Placeholder: "0.00"
  - Function: User sets maximum loan amount for borrowers

### Date Selection
- **Expired Date field**:
  - Component: Date picker input
  - Label: "Expired Date"
  - Placeholder: "00-00-0000"
  - Icon: Calendar icon for date selection
  - Function: User selects when the loan offer expires

### Terms Section
- **Interest Rate field**:
  - Component: Number input field
  - Label: "Interest Rate"
  - Placeholder: "0.0"
  - Suffix: "%" symbol
  - Function: User sets the interest rate for the loan

- **Term Length selection**:
  - Component: Radio button group
  - Label: "Term Length"
  - Options: "1 month", "3 month", "6 month"
  - Function: User selects loan duration (single selection)

### Collateral Section
- **Section heading**: "Collateral"
- **Instruction text**: "Accept collateral in:"

- **Cryptocurrency options** (all with toggle switches):
  - **Bitcoin (BTC)**: Orange Bitcoin icon + toggle switch (enabled)
  - **Ethereum (ETH)**: Blue Ethereum icon + toggle switch (enabled)
  - **Solana (SOL)**: Green Solana icon + toggle switch (enabled)
  - **BNB (BNB)**: Yellow BNB icon + toggle switch (enabled)

- Function: Users can toggle which cryptocurrencies they accept as collateral

### Action Button
- **Continue to Review button**:
  - Component: Primary blue button
  - Text: "Continue to Review"
  - Function: Proceeds to review page when form is complete

---

## Page 2: Create Loan Offer - Parameters (Filled State)

**Page Type**: Form Input Page (Completed)
**Progress**: Step 1 of 3 (33% complete)

### Filled Form Values
- **Total Amount**: "100,000 USDT"
- **Min Loan Size**: "1,000"
- **Max Loan Size**: "50,000"
- **Expired Date**: "09-09-2025"
- **Interest Rate**: "8.5%"
- **Term Length**: All three options selected (1 month, 3 month, 6 month) with green checkmarks
- **Collateral**: All cryptocurrencies enabled (Bitcoin, Ethereum, Solana, BNB)

### Interaction States
- All form fields are populated with example values
- Term length shows multiple selection capability
- Continue button remains active and ready for next step

---

## Page 3: Create Loan Offer - Review

**Page Type**: Review and Agreement Page
**Progress**: Step 1 of 3 (66% complete)

### Header
- Same navigation structure as previous pages
- Progress shows 66% completion

### Loan Offer Summary Card
- **Section heading**: "Loan Offer Summary"
- **Summary fields** (read-only display):
  - **Total Amount**: "100,000 USDT"
  - **Loan Size Range**: "1,000 - 50,000 USDT"
  - **Interest Rate**: "8.5%"
  - **Term Length**: "1, 3, 6 months"
  - **Expired Date**: "09-09-2025"
  - **Accepted Collateral**: Icons for Bitcoin, Ethereum, Solana, BNB

- **Edit Parameters link**:
  - Component: Text link with edit icon
  - Function: Returns user to parameters page for modifications

### Legal Agreement Section
- **Section heading**: "Legal Agreement"

- **Loan Agreement Contract**:
  - Component: Document card
  - Icon: Document icon
  - Text: "Loan Agreement Contract"
  - Action: "Download" button
  - Function: Allows user to download contract document

- **Contract Terms** (scrollable text area):
  1. **LOAN TERMS**: "This agreement establishes the terms for cryptocurrency-backed lending between the Lender and Borrower through the CryptoGadai platform."

  2. **COLLATERAL REQUIREMENTS**: "Borrower must deposit acceptable cryptocurrency collateral as specified in the loan parameters. Collateral will be held in escrow until loan repayment."

### Agreement Confirmation
- **Checkbox**: "I agree to these terms and conditions"
- **Disclaimer text**: "By checking this box, you acknowledge that you have read, understood, and agree to be bound by the loan agreement terms."

### Action Buttons
- **Continue to Fund button**:
  - Component: Primary blue button
  - Text: "Continue to Fund"
  - Function: Proceeds to funding page

- **Back to Parameters button**:
  - Component: Secondary button
  - Text: "Back to Parameters"
  - Function: Returns to parameter editing page

---

## Page 4: Create Loan Offer - Fund

**Page Type**: Payment/Funding Page
**Progress**: Step 1 of 3 (100% complete)

### Header Section
- **Main heading**: "Deposit Principal to Activate"
- **Instruction text**: "Send USDT to the address below to fund your loan offer"

### Summary Information Card
- **Section heading**: "Summary"
- **Invoice details**:
  - **Invoice ID**: "INV-2025-4789"
  - **Principal Amount**: "100,000 USDT"
  - **Send Exactly**: "100,000 USDT" (emphasized)

### Payment Warning
- **Alert component**: Red warning triangle icon
- **Warning text**: "Sending wrong amount may delay processing"

### QR Code Section
- **Section heading**: "Scan QR Code"
- **QR Code**: Large black and white QR code for payment
- Function: Users can scan with mobile wallet to make payment

### Payment Address
- **Section heading**: "Payment Address"
- **Address field**: "bc1qxy2kgdygjrsqtzq2n0yrf2493p8..."
- **Copy button**: Icon to copy address to clipboard
- Function: Users can copy address for manual payment

### Countdown Timer
- **Warning icon**: Triangle warning indicator
- **Timer heading**: "Invoice Expires In"
- **Countdown display**: "23:59:59" (hours:minutes:seconds)
- **Expiration note**: "Invoice expires automatically"

### Action Buttons
- **Waiting for Payment button**:
  - Component: Primary blue button (disabled state)
  - Text: "Waiting for Payment"
  - Function: Shows payment pending status

- **Back to Review button**:
  - Component: Secondary button
  - Text: "Back to Review"
  - Function: Returns to review page

---

## Page 5: Loan Offers Submitted (Success Page)

**Page Type**: Confirmation/Success Page
**State**: Process Complete

### Success Indicator
- **Success icon**: Large green circle with checkmark
- **Confirmation message**: "Loan Offers Submitted!"
- **Description**: "Your loan offers has been successfully submitted and is now under review."

### Summary Details Card
- **Section heading**: "Summary Details"
- **Loan information**:
  - **Invoice ID**: "COL-2847-9163"
  - **Loan Amount**: "100,000 USDT"
  - **Interest Rate**: "8.5% APR"
  - **Accepted Collateral**: Icons for Bitcoin, Ethereum, Solana, BNB
  - **Submitted**: "Jan 15, 2025 14:30"

### What's Next Section
- **Section heading**: "What's Next?"
- **Process steps** (bulleted list):
  - "Application submitted successfully"
  - "Review by lender (24-48 hours)"
  - "Approval notification"
  - "Funds disbursement"

### Action Buttons
- **Save PDF button**:
  - Component: Secondary button with download icon
  - Text: "Save PDF"
  - Function: Downloads summary as PDF document

- **Share button**:
  - Component: Secondary button with share icon
  - Text: "Share"
  - Function: Shares loan offer details

- **Continue to Dashboard button**:
  - Component: Primary blue button
  - Text: "Continue to Dashboard"
  - Function: Returns user to main dashboard

- **Track Application Status button**:
  - Component: Secondary button
  - Text: "Track Application Status"
  - Function: Navigates to application tracking page

### Branding
- **Footer**: "CryptoGadai." logo with stylized icon

## User Interaction Flow Summary

1. **Parameters Page**: User fills out loan details (amount, terms, collateral preferences)
2. **Review Page**: User reviews all details, reads and agrees to legal terms
3. **Fund Page**: User makes payment via QR code or address to activate loan offer
4. **Success Page**: Confirmation of successful submission with next steps and tracking options

Each page maintains consistent navigation with back buttons and progress indicators, allowing users to move between steps as needed during the loan offer creation process.