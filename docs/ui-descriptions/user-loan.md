# User Loan Module - UI Descriptions

This document provides detailed textual descriptions of all UI pages in the user loan module, organized in logical flow order.

## 1. My Loan Applications Page

### Header Section
- **Page Title**: "My Loan Applications"
- **Search Icon**: Clickable search button (top right)
- **Filter Icon**: Clickable filter button (top right)

### Tab Navigation
- **Tab 1**: "Loan Offers" (inactive, clickable to switch views)
- **Tab 2**: "Loan Applications" (active, highlighted in blue)

### Application Overview Card
- **Card Type**: Blue gradient summary card
- **Title**: "Application Overview" with calendar icon
- **Date Display**: "July, 2025" (top right)
- **Metrics Display**:
  - Total Applied: "12" (large white text, left)
  - Active: "8" (large white text, right)
  - Pending: "0" (smaller text, left bottom)
  - Rejected: "4" (smaller text, right bottom)

### All Applications Section
- **Section Header**: "All Applications"
- **Action Button**: "+ New Applications" (blue button, right aligned)

### Loan Application Cards (List of 5 items)
Each card contains:
- **Card Icon**: Document icon (blue)
- **Application ID**: "Loan Application (#3146)"
- **Status Badge**: Color-coded status (Published/Matched/Pending/Close/Expired)
- **Requested Amount**: "15,000 USDT" (large text)
- **Loan Details**:
  - Terms: "6 Months"
  - Interest Rate: "6.8%"
  - Collateral: "0.5 BTC"

**User Interactions**:
- Users can tap any application card to view details
- Users can tap "+ New Applications" to create new loan applications
- Users can use search and filter functions
- Users can switch between "Loan Offers" and "Loan Applications" tabs

---

## 2. My Loan Applications (Published State)

### Similar structure to above but with different metrics:
- **Total Applied**: "12"
- **Approved**: "8" (instead of Active)
- **Pending**: "21" (increased)
- **Rejected**: "125" (increased)

### Application Cards
All 5 visible cards show "Published" status (green badges)

**User Interactions**:
- Same interaction patterns as the previous state
- All applications are in published state, indicating they are live and available for matching

---

## 3. My Loan Offers Page

### Header Section
- **Page Title**: "My Loan Offers"
- **Search Icon**: Clickable search button
- **Filter Icon**: Clickable filter button

### Tab Navigation
- **Tab 1**: "Loan Offers" (active, highlighted)
- **Tab 2**: "Loan Applications" (inactive, clickable)

### Loan Offer Overview Card
- **Card Type**: Blue gradient summary card
- **Title**: "Loan Offer Overview"
- **Date**: "July, 2025"
- **Financial Metrics**:
  - Total Funds: "10,000 USDT"
  - Monthly Income: "250 USDT"
  - Total Disbursement: "5,000 USDT"
  - Total Available: "5,000 USDT"
  - Active Loans: "125"

### All Offers Section
- **Section Header**: "All Offers"
- **Action Button**: "+ New Offer" (blue button)

### Loan Offer Cards (List of 6 items)
Each card contains:
- **Card Icon**: Document icon (blue)
- **Offer ID**: "Loan Offers (#5678)"
- **Status Badge**: Various statuses (Published/Matched/Pending/Close/Expired)
- **Available Supply**: "23,000 USDT"
- **Terms**: "3-6 Months"
- **Interest Rate**: "6.8%"
- **Progress Indicators**:
  - Percentage complete: "33%"
  - Progress bar (blue)
  - Amount range: "2,000 USDT" to "25,000 USDT"

**User Interactions**:
- Users can tap any offer card to view details
- Users can create new offers via "+ New Offer" button
- Users can filter and search through offers
- Users can switch between tabs

---

## 4. My Loan Offers (Published State)

### Similar structure but showing filtered view:
- **Section Header**: "Published Offers" (instead of "All Offers")
- All 6 visible cards show "Published" status

**User Interactions**:
- Shows only published/active offers
- Same interaction capabilities as the main offers page

---

## 5. Loan Applications Details Page

### Header
- **Back Arrow**: Navigation back to previous screen
- **Page Title**: "Application Details"

### Application Card
- **Application ID**: "Loan Applications (#5678)"
- **Status**: "Active" (green badge)
- **Loan Amount**: "10,000 USDT" (large display)

### Loan Calculations Section
- **Section Title**: "Loan Calculations" with calculator icon
- **Details**:
  - Principal: "10,000 USDT"
  - Interest (1%): "300 USDT"
  - Terms: "3 Months"
  - Provisions (3%): "300 USDT"
- **Total Repayment**: "10,600 USDT" (emphasized)

### Due Date Alert
- **Warning Icon**: Red triangle with exclamation
- **Text**: "Due Date: Apr 15, 2025 (One-time payment)"

### Collateral Section
- **Section Title**: "Collateral" with shield icon
- **Collateral Details**:
  - Selected Assets: "ETH"
  - LTV: "70%"
  - Collateral Value: "15,428 USDT"
  - Collateral Price: "2,900 USDT"
  - Collateral Required: "5.32 ETH" (emphasized)

### Payment Method Section
- **Section Title**: "Payment Method"
- **Option 1**: "Early Repayment" button (blue)
  - Amount: "10,600 USDT"
  - Note: "Send repayment specified address"
- **Option 2**: "Early Liquidation" button (blue)
  - Amount: "10,600 USDT"
  - Note: "Sell collateral to repay"
- **Footer Note**: "Payment will be processed immediately"

**User Interactions**:
- Users can navigate back using the back arrow
- Users can choose between early repayment or early liquidation
- Users can view all loan calculation details and collateral requirements

---

## 6. Loan Details Page

### Header
- **Back Arrow**: Navigation back
- **Page Title**: "Loan Details"

### Loan Offer Card
- **Offer ID**: "Loan Offers (#5678)"
- **Status**: "Active" (green badge)
- **Date Range**: "Start Jan 10, 2025" to "End Jan 10, 2025"
- **Financial Summary**:
  - Total Funds: "100,000 USDT"
  - Interest Rate: "5%"
  - Disbursement: "75,000 USDT"
  - Available: "25,000 USDT"

### Earnings Section
- **Section Title**: "Earnings" with money icon
- **Earnings Breakdown**:
  - Gross Total: "687.50 USDT"
  - Platform Fee (10%): "54.37 USDT"
  - Net Income: "584.37 USDT" (emphasized)

### Matched Borrowers Section
- **Section Title**: "Matched Borrowers"
- **Count**: "4" (green indicator)
- **Borrower List**: 4 borrower entries
  - Each shows: "Borrower #1", "Borrower #2", etc.
  - Status: "Active" (green badges)
  - Dropdown arrows for expansion

**User Interactions**:
- Users can navigate back to previous screen
- Users can expand individual borrower details using dropdown arrows
- Users can view comprehensive loan performance metrics

---

## 7. Loan Details (Expanded Borrower View)

### Same header and loan offer sections as above

### Expanded Borrower Entry
- **Borrower #1**: Expanded to show details
  - ID: "B23124"
  - Terms: "6 Month"
  - Amount: "25,000 USDT"
  - Collateral: "10 ETH"
  - LTV: "52.8%"
  - Due date: "Feb 21, 2025"
- **Other Borrowers**: Collapsed (Borrower #2, #3, #4)

**User Interactions**:
- Users can expand/collapse individual borrower details
- Users can view specific loan terms for each matched borrower

---

## 8. Loan Repayment Page

### Header
- **Back Arrow**: Navigation back
- **Page Title**: "Loan Repayment"

### Total Repayment Card
- **Card Title**: "Total Repayment" with document icon
- **Amount**: "10,600 USDT" (large display)
- **Subtitle**: "Total Amount Due"
- **Balance Info**: "Your Balance: 2,000.00 USDT"
- **Due Date**: "Jan 25, 2025"

### Amount Details Section
- **Section Title**: "Amount Details" with shield icon
- **Payment Amount**: "Send Exactly 8,600.00 USDT"

### Action Button
- **Primary Button**: "Confirm Payment" (blue, with card icon)
- **Footer Note**: "Payment will be processed immediately"

**User Interactions**:
- Users can navigate back to previous screen
- Users can confirm payment by tapping "Confirm Payment" button
- Users can see exact amount needed and their current balance

---

## 9. Loan Repayment Invoice Page

### Header
- **Back Arrow**: Navigation back
- **Page Title**: "Loan Repayment"

### Liquidation Alert
- **Alert Type**: Orange warning banner
- **Icon**: Warning triangle
- **Message**: "Liquidation Required"
- **Description**: "Your collateral value has fallen below the required threshold"

### Amount Details Section
- **Section Title**: "Amount Details" with shield icon
- **Amount**: "13,750.50 USDT"
- **Alert**: Red triangle with "Must be exact amount"

### QR Code Section
- **Section Title**: "Scan QR Code" with QR icon
- **QR Code Display**: Large black and white QR code for payment

### Payment Address Section
- **Network**: "BSC (BEP-20)"
- **Status**: "Validated" (with checkmark)
- **Address**: "bc1qxy2kgdvgjrsqtzg2n0vrf2493p8..." (with copy icon)

### Payment Status Section
- **Section Title**: "Payment Status" with clock icon
- **Status**: "Waiting for payment..."
- **Description**: "We'll automatically detect your payment"

### Invoice Timer Section
- **Section Title**: "Invoice Expires In" with warning triangle
- **Countdown**: "23:59:59" (blue, large text)
- **Description**: "Invoice expires automatically"

**User Interactions**:
- Users can navigate back to previous screen
- Users can scan QR code for payment
- Users can copy payment address
- Users can see real-time countdown and payment status
- System automatically detects incoming payments

---

## 10. Early Liquidations Page

### Header
- **Back Arrow**: Navigation back
- **Page Title**: "Loan Repayment"

### Total Repayment Card
- **Same structure as regular repayment page**
- **Amount**: "10,600 USDT"
- **Due Date**: "Jan 25, 2025"

### Liquidation Models Section
- **Section Title**: "Liquidation Models" with shield icon
- **Options**:
  - Partial Liquidation (unselected radio button)
  - Full Liquidation (selected radio button with green checkmark)

### Liquid Breakdown Section
- **Section Title**: "Liquid Breakdown" with shield icon
- **Breakdown Details**:
  - Collateral to Sell: "5 ETH"
  - Est. Market Price: "52,900 USDT/ETH/ETH"
  - Est. Proceeds: "14,500 USDT"

### Deductions Section
- **Section Title**: "Deductions"
- **Deduction Items**:
  - Principal: "10,000 USDT"
  - Interest: "300 USDT (full)"
  - Provisions: "300 USDT"
  - Prem Risk: "200 USDT (2%)"
  - Early Liq. Fee: "200 USDT (2%)"
  - Total Deductions: "11,000 USDT"

### Estimated Return Section
- **Section Title**: "Estimated Return" with shield icon
- **Return Amount**: "3,500 USDT" (large display)
- **Note**: "This amount will be sent on your wallet" (with info icon)

### Action Button
- **Primary Button**: "Confirm Liquidations" (blue, with document icon)
- **Footer Note**: "Payment will be processed immediately"

**User Interactions**:
- Users can navigate back to previous screen
- Users can select between partial and full liquidation
- Users can review detailed breakdown of liquidation proceeds
- Users can confirm liquidation by tapping "Confirm Liquidations"
- Users can see estimated return amount after all deductions

---

## 11. Auto Liquidations Page

### Similar structure to Application Details but showing completed liquidation:

### Header
- **Back Arrow**: Navigation back
- **Page Title**: "Application Details"

### Application Card
- **Status**: "Close" (gray badge instead of Active)

### Additional Section: Liquidations Executed
- **Section Title**: "Liquidations Executed" with chart icon
- **Liquidation Details**:
  - Triggered: "LTV exceeded 70%"
  - Date: "Jan 15, 2025 09:45"
  - Collateral Sold: "5 ETH"
  - Sale Price: "14,250 USDT"
  - Loan Repaid: "-10,600 USDT"
  - Liquidation Fee: "-212 USDT"
  - Your Surplus: "+3,438 USDT"

**User Interactions**:
- Users can view the completed auto-liquidation details
- Users can see the timeline and financial outcome of the liquidation
- Users can navigate back to the main loan list

---

## 12. Search Page

### Header
- **Back Arrow**: Navigation back
- **Search Bar**: Text input with placeholder "Search..." and search icon

### Content Area
- **Empty State**: Blank white area (no search results displayed)

**User Interactions**:
- Users can navigate back to previous screen
- Users can enter search terms in the search bar
- Users can tap search icon to execute search

---

## 13. Filter/Sorting Page

### Header
- **CryptoGadai Logo**: Top left
- **Notification Bell**: Top right
- **Page Title**: "Loan Offers"
- **Search and Filter Icons**: Top right

### Tab Navigation
- **Tab 1**: "Loan Offers" (active)
- **Tab 2**: "Loan Applications" (inactive)

### Filter Categories
- **Category Buttons**:
  - "All" (selected, blue background)
  - "Institutions" (unselected)
  - "Individual" (unselected)

### Loan Offer Examples
- **Institutional Offer**:
  - "PT. Bank Central Indonesia"
  - "Institutional" badge (green)
  - Available supply: "$25,000 USDT"
  - Interest Rate: "6.8%"
  - Terms: "3-6 Months"
  - Progress: "33%" with progress bar
  - Range: "$2,890 USDT" to "$25,000 USDT"

- **Individual Offer**:
  - "John Anderson" with avatar
  - "Individual" badge (blue)
  - Available supply: "$5,000 USDT"
  - Interest Rate: "6.8%"
  - Terms: "1-2 Months"
  - Progress: "43%" with progress bar

### Filter Modal
- **Modal Title**: "Filter" with X close button
- **Filter Options**:
  - "Select Status" dropdown with placeholder "Please select status.."
  - "Select Month" dropdown with placeholder "Please select month.."
- **Action Buttons**:
  - "Submit" (blue button)
  - "Reset" (outline button)

**User Interactions**:
- Users can switch between filter categories (All/Institutions/Individual)
- Users can open filter modal by tapping filter icon
- Users can select status and month filters
- Users can submit or reset filter selections
- Users can close filter modal
- Users can view filtered loan offers based on selected criteria

---

## Page Flow and Navigation

The logical user flow through these pages would be:

1. **My Loan Applications** ’ View and manage loan applications
2. **My Loan Offers** ’ View and manage loan offers
3. **Search/Filter** ’ Find specific loans or offers
4. **Application/Loan Details** ’ View detailed information
5. **Loan Repayment** ’ Make payments or handle liquidations
6. **Auto/Early Liquidations** ’ Handle collateral liquidation scenarios

Each page maintains consistent navigation patterns with back arrows, tab switching, and bottom navigation bar containing: Home, Loans (active), Market, Wallet, and Profile.