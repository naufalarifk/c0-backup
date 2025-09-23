# User Market Individual - UI Descriptions

This document provides detailed textual descriptions of the User Market Individual interface pages, arranged in logical semantic order to represent the typical user journey through the loan marketplace application.

## 1. Market Listing Pages

### 1.1 Loan Offers - All View (List Market all loan offers.png)

**Page Header:**
- App title: "CryptoGadai" with logo in blue header bar
- Status bar: "09:41" time, signal, WiFi, and battery indicators
- Notification bell icon (top right)

**Navigation:**
- Main heading: "Loan Offers"
- Search icon button (magnifying glass)
- Filter icon button (funnel icon)

**Tab Navigation:**
- Two main tabs: "Loan Offers" (selected with blue background) and "Loan Applications"
- Sub-category tabs: "All" (selected with blue background), "Institutions", "Individual"

**Loan Offer Cards:**
Each loan offer is displayed as a card containing:

**Card 1 - PT. Bank Central Indonesia:**
- Lender type badge: "Institutional" (light green)
- Bank icon and name: "PT. Bank Central Indonesia"
- Available supply: "23,000 USDT"
- Interest Rate: "6.8%"
- Terms: "3-6 Months"
- Progress bar: 33% filled (blue)
- Funding progress: "2,000 USDT" to "25,000 USDT"
- Completion percentage: "100%"

**Card 2 - Individual User:**
- User avatar and masked name: "J*** A*****n"
- Lender type badge: "Individual" (light blue)
- Available supply: "4,000 USDT"
- Interest Rate: "6.8%"
- Terms: "1-2 Months"
- Progress bar: 43% filled (blue)
- Funding progress: "1,000 USDT" to "5,000 USDT"
- Completion percentage: "100%"

**Additional Cards:**
- PT. Bank Negara Indonesia (2 cards with identical details): 120,000 USDT, 6.8%, 3-6 Months, 13% progress
- Another individual user card: J*** A*****n, 4,000 USDT, 6.8%, 1-2 Months, 43% progress

**Load More:**
- "Load More" button at bottom of list

**Bottom Navigation:**
- Five tabs: "Home", "Loans", "Market" (selected with blue icon), "Wallet", "Profile"

**User Interactions:**
- Users can tap on search/filter icons to access search functionality
- Users can switch between "All", "Institutions", "Individual" tabs to filter loan types
- Users can tap on individual loan cards to view details
- Users can tap "Load More" to see additional loan offers
- Users can navigate using bottom navigation tabs

### 1.2 Loan Offers - Individual View (List Market Personal loan offers.png)

Similar structure to "All View" but with:
- "Individual" tab selected (blue background)
- Only displays loan offers from individual lenders
- Shows 5 individual user cards with masked names (J*** A*****n, R*****n L*****e)
- All cards show "Individual" badge in light blue
- Consistent loan details: 4,000 USDT amounts, 6.8% interest, 1-2 months terms, 43% progress

### 1.3 Loan Offers - Institutions View (List Market Institutions loan offers.png)

Similar structure but with:
- "Institutions" tab selected (blue background)
- Only displays institutional lender offers
- Shows bank offers: PT. Bank Central Indonesia, PT. Bank Rakyat Indonesia, PT. Bank Negara Indonesia
- All cards show "Institutional" badge in light green
- Higher loan amounts (23,000-122,000 USDT)
- Longer terms (3-6 months)
- Various progress levels (13%-33%)

### 1.4 Loan Applications List (List Market all aplications.png)

**Page Structure:**
- Same header and navigation as loan offers
- "Loan Applications" tab selected (blue background)
- No sub-category tabs

**Application Cards:**
Each application displays:
- User avatar with masked name: "J*** A*****n"
- "Verified User" badge (light green)
- Requested Amount: "15,000 USDT"
- Terms: "6 Months"
- Interest Rate: "6.8%"
- Collateral: "0.5 BTC"

**Display Pattern:**
- Shows 5 identical application cards
- All from same masked user
- Consistent terms across all applications
- "Load More" button at bottom

**User Interactions:**
- Users can tap on application cards to view details
- Users can switch between "Loan Offers" and "Loan Applications" tabs

## 2. Search and Filter Functionality

### 2.1 Search Interface (Search.png)

**Minimal Search Page:**
- Back arrow navigation
- Search input field with placeholder "Search..."
- Clean, empty interface ready for user input

**User Interactions:**
- Users can type search terms in the input field
- Users can tap back arrow to return to previous page

### 2.2 Search Results (Search-1.png)

**Search Results Display:**
- Search query shown: "PT. Bank Central Indonesia" in search bar with X to clear
- Results show 3 matching institutional loan offers
- Each result card shows:
  - Bank logo and name: "PT. Bank Central Indonesia"
  - "Institutional" badge
  - Available supply: "$25,000 USDT"
  - Interest Rate: "6.8%"
  - Terms: "3-6 Months"

**User Interactions:**
- Users can clear search with X button
- Users can tap on search result cards to view details

### 2.3 Filter Interface - Loan Applications (Sorting.png)

**Filter Modal:**
- Modal title: "Filter" with X close button
- Semi-transparent overlay over loan applications list

**Filter Options:**
1. **Requested amount**
   - Min/Max input fields with placeholder "input amount..."

2. **Interest Rate (%)**
   - Min/Max input fields with placeholder "input amount..."

3. **Terms**
   - Dropdown: "Select Terms" with down arrow

**Action Buttons:**
- "Submit" button (blue)
- "Reset" button (gray)

**User Interactions:**
- Users can input min/max values for amount and interest rate
- Users can select terms from dropdown
- Users can submit filters or reset to clear all filters
- Users can close modal with X button

### 2.4 Filter Interface - Loan Offers (Sorting-1.png)

**Similar Filter Modal but for Loan Offers:**
- Background shows loan offers list instead of applications
- Filter title: "Filter"

**Filter Options:**
1. **Available Supply**
   - Min/Max input fields

2. **Interest Rate (%)**
   - Min/Max input fields

3. **Terms**
   - Dropdown: "Select Terms"

**Same action buttons and interactions as loan applications filter**

## 3. Loan Application Process

### 3.1 Apply for Loan - Empty Form (Details Loans offers.png)

**Page Header:**
- Back arrow navigation
- Page title: "Apply for Loan"

**Loan Details Card:**
- Bank: "PT. Bank Negara Indonesia" with "Institutional" badge
- Available supply: "120,000 USDT"
- Interest Rate: "6.8%"
- Terms: "3-6 Months"
- Progress bar: 13% filled
- Funding range: "5,000 USDT" to "125,000 USDT"
- Completion: "100%"

**Application Form:**
1. **Enter Amount**
   - Input field: "Enter amount..." with "USDT" suffix

2. **Liquidations Mode**
   - Dropdown: "Select liquidations" with down arrow

3. **Select Collateral**
   - Dropdown: "Select collateral" with down arrow

4. **Select Terms**
   - Dropdown: "Select Terms" with down arrow

**Summary Section:**
- All values show "00.00 USDT" (empty state)
- Total: 00.00 USDT
- Interest Rate (6.8%): 00.00 USDT
- Provisions (3%): 00.00 USDT
- Total Loans: 00.00 USDT
- Liquidations Fees (2%): 0.0USDT
- Premium risks (2%): 0.0USDT
- LTV: 0.0%
- Collateral: 00.00 BTC

**About Lender:**
- Text about PT. Bank Negara Indonesia
- "Read More" link

**Apply Button:**
- Disabled gray "Apply" button at bottom

**User Interactions:**
- Users must fill amount, select liquidation mode, collateral, and terms
- Dropdowns can be tapped to reveal options
- Summary updates dynamically based on inputs
- Apply button becomes active when form is complete

### 3.2 Apply for Loan - Filled Form (Details Loans offers fill.png)

**Same structure as empty form but with filled values:**

**Form Values:**
- Amount: "1,000.00" USDT
- Liquidations Mode: "Partial Liquidations"
- Collateral: "BTC"
- Terms: "1 Month"

**Updated Summary:**
- Principal Amount: 1,000.00 USDT
- Interest Rate (6.8%): 68.00 USDT
- Provisions (3%): 30.00 USDT
- Total Loans: 1,098.00 USDT
- Liquidations Fees (2%): 20.0USDT
- Premium risks (2%): 20.0USDT
- LTV: 60%
- Collateral: 1,896.00 BTC

**Apply Button:**
- Active blue "Apply" button

**User Interactions:**
- Form is now complete and ready for submission
- Users can modify any field values
- Users can tap "Apply" to submit the application

## 4. Application Status and Results

### 4.1 Application Pending Status (Apply for loans Pending.png)

**Status Display:**
- Orange clock icon in circular background
- Main message: "Loan Application still Pending"
- Subtext: "Your loan application is pending review."

**Summary Card:**
- Total: 1,000.00 USDT
- Interest Rate (6.8%): 68.00 USDT
- Provisions (3%): 30.00 USDT
- Total: 1,098.00 USDT

**Action Button:**
- "Back to Home" button (blue)

**User Interactions:**
- Users can return to home screen
- Status indicates waiting period for application review

### 4.2 Funding Pending Status (Apply for loans Pending-1.png)

**Similar layout with different messaging:**
- Orange clock icon
- Main message: "Loan Funding still Pending"
- Subtext: "Your loan application is pending review."

**Summary Card:**
- Invoice ID: "INV-2025-4789" with copy icon
- Request Amount: 15,000 USDT
- Terms: 6 Months
- Interest Rate per month: 6.8%
- Total Interest: 1,020.00 USDT

**User Interactions:**
- Users can copy invoice ID
- Users can return to home

### 4.3 Application Success (Apply for loans success.png)

**Success Display:**
- Green checkmark icon in circular background
- Main message: "Loan Application has been Successful"
- Celebration message: "<‰ Congratulations! Your loan application was successful."

**Same summary and action button as pending states**

### 4.4 Funding Success (Apply for loans success-1.png)

**Similar success layout:**
- Green checkmark icon
- Main message: "Loan Funding has been Successful"
- Celebration message with invoice details

### 4.5 Application Rejected (Apply for loans rejected.png)

**Rejection Display:**
- Red X icon in circular background
- Main message: "Loan Application has been Rejected"
- Apology message: "= We're sorry, your loan application has been declined."

**Additional Actions:**
- "Back to Home" button (blue)
- "Reapply" button (gray)

**User Interactions:**
- Users can return home or reapply for the loan

### 4.6 Funding Rejected (Apply for loans rejected-1.png)

**Similar rejection layout with funding-specific messaging:**
- Red X icon
- Main message: "Loan Funding has been Rejected"
- Same action buttons and invoice details

## 5. Application and Payment Details

### 5.1 Application Details (Details applications.png)

**Page Header:**
- Back arrow and "Fund Loan" title
- Share icon (top right)

**User Information:**
- User avatar: "J*** A*****n"
- "Verified User" badge (green)

**Loan Summary:**
- ID Applications: "#FUND-8A4B2C"
- Request Amount: 15,000 USDT
- Terms: 6 Months
- Interest Rate per-month: 6.8%
- Total Interest: 1,020.00 USDT

**Collateral Information:**
- Bitcoin icon: "0.5 BTC (Bitcoin)"
- Estimated amount: "17,500 USDT"
- Explanation: "The collateral is valued at 70% of the loan amount and is securely held by an independent third-party custodian."

**Network Selection:**
- "Select Network" section
- Dropdown: "Select network..."
- Instructions: "Select the blockchain network you'll use to send funds."

**Apply Button:**
- Blue "Apply" button at bottom

**User Interactions:**
- Users can share the application details
- Users must select a blockchain network
- Users can proceed with funding the loan

### 5.2 Invoice for Loan Offers (Invoice loan offers.png)

**Payment Status:**
- Clock icon: "Payment Status"
- Status: "Waiting for payment..."
- Message: "We'll automatically detect your payment"

**Invoice Timer:**
- Triangle warning icon: "Invoice Expires In"
- Countdown timer: "23:59:59"
- Message: "Deposit within this time to keep your application active"

**Information Alert:**
- Info icon: "Individual users can both lend and borrow"
- Subtext: "Institution users can only lend"

**Collateral Deposit:**
- Section title: "Deposit Collateral"
- Instructions: "Deposit collateral to activate your application"

**Deposit Details:**
- Invoice ID: "COL-2847-9163" with copy icon
- Currency: Bitcoin (BTC) with icon
- Network: "Bitcoin Network"
- Due Date: "15-07-2025-23:59:59"

**Amount Details:**
- "Send Exactly": "0.31 BTC"

**QR Code:**
- Large QR code for payment
- "Scan QR Code" label

**Collateral Address:**
- "Collateral Address" section
- "Bitcoin Network" with "Validated" status (green checkmark)
- Address: "bc1axy2kgdygjrsqtzq2n0yrf2493p8..." with copy icon

**Back Button:**
- "Back" button at bottom

**User Interactions:**
- Users can copy invoice ID and wallet address
- Users can scan QR code for payment
- Users monitor timer for payment deadline
- Users can return to previous screen

### 5.3 Invoice for Loan Applications (Invoice loan applications.png)

**Similar structure but for loan funding:**

**Different Headers:**
- "Fund Loand" title (appears to be a typo for "Fund Loan")

**Payment Status:**
- Same waiting for payment status
- Same countdown timer: "23:59:59"

**Principal Deposit:**
- Section: "Deposit Principal to Activate"
- Instructions: "Send USDT to the address below to fund your loan offer"

**Summary Details:**
- Invoice ID: "INV-2025-4789" with copy
- Request Amount: 15,000 USDT
- Terms: 6 Months
- Interest Rate per month: 6.8%
- Total Interest: 1,020.00 USDT

**Amount Details:**
- "Send Exactly": "15,000 USDT"
- Warning: "  Sending wrong amount may delay processing"

**Payment Address:**
- "Payment Address" section
- "Bitcoin Network" with "Validated" status
- Same address format with copy function

**User Interactions:**
- Users send USDT to fund the loan
- Users monitor payment confirmation
- Users can copy payment details

## Page Flow Summary

The user journey typically follows this sequence:

1. **Browse Market** ’ Users start by viewing loan offers or applications
2. **Search/Filter** ’ Users can refine their search using search and filter tools
3. **Application Process** ’ Users fill out loan application forms
4. **Status Tracking** ’ Users monitor application status (pending/success/rejected)
5. **Payment/Invoice** ’ Users complete payment or collateral deposit processes

Each page is designed with consistent navigation patterns, clear status indicators, and actionable buttons to guide users through the loan marketplace experience.