# User Market Institution - UI Description

This document provides detailed textual descriptions of the loan marketplace UI pages where users can browse and apply for loans from financial institutions. The pages are organized in logical user flow order.

## 1. Loan Applications List (Main Market View)

**File:** `List Market all aplications Institutions.png`

### Header Section
- **Component Type:** Navigation header with blue gradient background
- **Content:**
  - Top status bar showing "09:41" time, signal strength, WiFi, and battery icons
  - CryptoGadai logo with shield icon on left
  - Notification bell icon on right
- **User Interaction:** Users can tap notification bell to view notifications

### Page Title and Controls
- **Component Type:** Page header with search and filter controls
- **Content:**
  - Title: "Loan Applications"
  - Search icon button (magnifying glass)
  - Filter icon button (funnel/filter symbol)
- **User Interaction:** Users can tap search icon to search applications, tap filter icon to open filtering options

### Loan Application Cards
- **Component Type:** List of loan application cards
- **Content:** Each card contains:
  - User avatar icon with masked username format "J*** A*****n"
  - "Verified User" green badge
  - "Requested Amount: 15,000 USDT" (consistent across all visible cards)
  - Three-column layout for loan details:
    - Terms: "6 Months"
    - Interest Rate: "6.8%"
    - Collateral: "0.5 BTC"
- **User Interaction:** Users can tap on any card to view detailed information and apply for funding

### Load More Section
- **Component Type:** Load more button
- **Content:** "Load More" text button
- **User Interaction:** Users can tap to load additional loan applications

### Bottom Navigation
- **Component Type:** Tab bar navigation with 5 tabs
- **Content:**
  - Home tab (house icon)
  - Loans tab (handshake icon)
  - Market tab (dollar sign icon) - currently active (blue)
  - Wallet tab (wallet icon)
  - Profile tab (user icon)
- **User Interaction:** Users can tap any tab to navigate to different sections

## 2. Search Functionality

### 2a. Empty Search State

**File:** `Search.png`

### Header Section
- **Component Type:** Navigation header
- **Content:**
  - Back arrow button on left
  - Search input field with placeholder text "Search..."
  - Clear/close icon on right
- **User Interaction:** Users can tap back arrow to return, enter search terms in input field, tap clear icon to clear search

### Content Area
- **Component Type:** Empty state
- **Content:** Blank/empty screen
- **User Interaction:** No interactions available in empty state

### 2b. Search Results

**File:** `Search-1.png`

### Header Section
- **Component Type:** Search header with active search
- **Content:**
  - Back arrow button
  - Search input field populated with "PT. Bank Central Indonesia"
  - Clear search icon (X)
- **User Interaction:** Users can modify search terms, clear search, or go back

### Search Results
- **Component Type:** Institution search results list
- **Content:** Three identical institution cards:
  - Institution icon (bank building symbol)
  - "PT. Bank Central Indonesia" name
  - "Institutional" green badge
  - Three-column layout:
    - Available supply: "$25,000 USDT"
    - Interest Rate: "6.8%"
    - Terms: "3-6 Months"
- **User Interaction:** Users can tap on any institution card to view more details or apply

## 3. Filtering and Sorting

**File:** `Sorting.png`

### Filter Modal
- **Component Type:** Bottom sheet modal overlay
- **Content:**
  - Modal header: "Filter" title with close button (X)
  - Filter sections:

#### Requested Amount Section
- **Component Type:** Range input fields
- **Content:**
  - Section title: "Requested amount"
  - Two input fields side by side:
    - Left: "Min" label with "input amount..." placeholder
    - Right: "Max" label with "input amount..." placeholder
- **User Interaction:** Users can enter minimum and maximum loan amounts

#### Interest Rate Section
- **Component Type:** Percentage range input fields
- **Content:**
  - Section title: "Interest Rate (%)"
  - Two input fields:
    - Left: "Min" with "input amount..." placeholder
    - Right: "Max" with "input amount..." placeholder
- **User Interaction:** Users can specify interest rate range

#### Terms Section
- **Component Type:** Dropdown selector
- **Content:**
  - Section title: "Terms"
  - Dropdown field: "Select Terms" with down arrow
- **User Interaction:** Users can tap dropdown to select loan term options

#### Action Buttons
- **Component Type:** Button group
- **Content:**
  - Primary blue button: "Submit"
  - Secondary grey button: "Reset"
- **User Interaction:** Users can submit filter criteria or reset all filters

## 4. Loan Application Details

**File:** `Details applications.png`

### Header
- **Component Type:** Page header
- **Content:**
  - Back arrow button
  - Page title: "Fund Loan"
  - Share icon button
- **User Interaction:** Users can go back or share the loan details

### Borrower Information
- **Component Type:** User info card
- **Content:**
  - User avatar with username "J*** A*****n"
  - "Verified User" green badge
- **User Interaction:** No direct interaction, displays borrower credibility

### Loan Summary Section
- **Component Type:** Information card
- **Content:**
  - Section title: "Summary"
  - Details list:
    - ID Applications: "#FUND-8A4B2C"
    - Request Amount: "15,000 USDT"
    - Terms: "6 Months"
    - Interest Rate per-month: "6.8%"
  - Calculated field: "Total Interest: 1,020.00 USDT"
- **User Interaction:** Users can review loan terms and calculations

### Collateral Section
- **Component Type:** Collateral information card
- **Content:**
  - Section title: "Collateral"
  - Bitcoin icon with amount: "0.5 BTC (Bitcoin)"
  - Estimated value: "Estimasi amount 17,500 USDT"
  - Explanation text: "The collateral is valued at 70% of the loan amount and is securely held by an independent third-party custodian."
- **User Interaction:** Users can understand collateral security

### Network Selection
- **Component Type:** Network dropdown selector
- **Content:**
  - Section title: "Select Network"
  - Instructions: "Select the blockchain network you'll use to send funds."
  - Dropdown field: "Select network..." with down arrow
- **User Interaction:** Users must select blockchain network for fund transfer

### Apply Button
- **Component Type:** Primary action button
- **Content:** "Apply" button
- **User Interaction:** Users tap to proceed with loan funding application

## 5. Payment Invoice

**File:** `Invoice loan applications.png`

### Header
- **Component Type:** Page header
- **Content:**
  - Back arrow button
  - Page title: "Fund Loan"
- **User Interaction:** Users can navigate back

### Payment Status
- **Component Type:** Status indicator
- **Content:**
  - Clock icon
  - "Payment Status"
  - "Waiting for payment..."
  - Subtitle: "We'll automatically detect your payment"
- **User Interaction:** No interaction, displays current payment status

### Invoice Timer
- **Component Type:** Countdown timer with warning
- **Content:**
  - Warning triangle icon
  - "Invoice Expires In"
  - Countdown timer: "23:59:59" (in blue)
  - Subtitle: "Invoice expires automatically"
- **User Interaction:** Users must complete payment before timer expires

### Funding Instructions
- **Component Type:** Instruction section
- **Content:**
  - Title: "Deposit Principal to Activate"
  - Instructions: "Send USDT to the address below to fund your loan offer"
- **User Interaction:** Users read instructions for payment process

### Summary Section
- **Component Type:** Loan summary card
- **Content:**
  - Section header: "Summary"
  - Invoice ID: "INV-2025-4789" with copy icon
  - Request Amount: "15,000 USDT"
  - Terms: "6 Months"
  - Interest Rate per-month: "6.8%"
  - Total Interest: "1,020.00 USDT"
- **User Interaction:** Users can copy invoice ID and review loan details

### Amount Details
- **Component Type:** Payment amount section
- **Content:**
  - Section header: "Amount Details"
  - "Send Exactly: 15,000 USDT" (prominent display)
  - Warning message: "Sending wrong amount may delay processing"
- **User Interaction:** Users must send exact amount specified

### QR Code Payment
- **Component Type:** QR code section
- **Content:**
  - Section header: "Scan QR Code"
  - Large QR code for payment
- **User Interaction:** Users can scan QR code with crypto wallet

### Payment Address
- **Component Type:** Wallet address section
- **Content:**
  - Section title: "Payment Address"
  - Network: "Bitcoin Network" with "Validated" checkmark
  - Address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p8..." with copy icon
- **User Interaction:** Users can copy payment address for manual transfer

### Back Button
- **Component Type:** Navigation button
- **Content:** "Back" button
- **User Interaction:** Users can return to previous screen

## 6. Application Status Pages

### 6a. Pending Status

**File:** `Apply for loans Pending.png`

### Header
- **Component Type:** Page header
- **Content:**
  - Back arrow button
  - Page title: "Fund Loan"
- **User Interaction:** Users can navigate back

### Status Display
- **Component Type:** Status indicator with icon
- **Content:**
  - Orange circular background with clock icon
  - Status message: "Loan Funding still Pending"
  - Subtitle with hourglass icon: "Your loan application is pending review."
- **User Interaction:** No interaction, informational display

### Summary Section
- **Component Type:** Summary information card
- **Content:**
  - Section title: "Summary"
  - Invoice ID: "INV-2025-4789" with copy icon
  - Request Amount: "15,000 USDT"
  - Terms: "6 Months"
  - Interest Rate per-month: "6.8%"
  - Total Interest: "1,020.00 USDT"
- **User Interaction:** Users can copy invoice ID and review details

### Action Button
- **Component Type:** Primary navigation button
- **Content:** Blue "Back to Home" button
- **User Interaction:** Users can return to main application

### 6b. Success Status

**File:** `Apply for loans success.png`

### Header
- **Component Type:** Page header
- **Content:**
  - Back arrow button
  - Page title: "Fund Loan"
- **User Interaction:** Users can navigate back

### Success Display
- **Component Type:** Success status indicator
- **Content:**
  - Green circular background with checkmark icon
  - Success message: "Loan Funding has been Successful"
  - Celebration subtitle with party icon: "Congratulations! Your loan application was successful."
- **User Interaction:** No interaction, celebratory display

### Summary Section
- **Component Type:** Summary information card
- **Content:**
  - Section title: "Summary"
  - Invoice ID: "INV-2025-4789" with copy icon
  - Request Amount: "15,000 USDT"
  - Terms: "6 Months"
  - Interest Rate per-month: "6.8%"
  - Total Interest: "1,020.00 USDT"
- **User Interaction:** Users can copy invoice ID and review final details

### Action Button
- **Component Type:** Primary navigation button
- **Content:** Blue "Back to Home" button
- **User Interaction:** Users can return to main application

### 6c. Rejected Status

**File:** `Apply for loans rejected.png`

### Header
- **Component Type:** Page header
- **Content:**
  - Back arrow button
  - Page title: "Fund Loan"
- **User Interaction:** Users can navigate back

### Rejection Display
- **Component Type:** Error status indicator
- **Content:**
  - Red circular background with X icon
  - Error message: "Loan Funding has been Rejected"
  - Apologetic subtitle with sad face icon: "We're sorry, your loan application has been declined."
- **User Interaction:** No interaction, displays rejection status

### Summary Section
- **Component Type:** Summary information card
- **Content:**
  - Section title: "Summary"
  - Invoice ID: "INV-2025-4789" with copy icon
  - Request Amount: "15,000 USDT"
  - Terms: "6 Months"
  - Interest Rate per-month: "6.8%"
  - Total Interest: "1,020.00 USDT"
- **User Interaction:** Users can copy invoice ID and review rejected application details

### Action Buttons
- **Component Type:** Button group
- **Content:**
  - Primary blue button: "Back to Home"
  - Secondary grey button: "Reapply"
- **User Interaction:** Users can return home or attempt to reapply for loan funding

## User Journey Flow

1. **Market Browse:** Users start at the main loan applications list to browse available borrowers
2. **Search/Filter:** Users can search for specific institutions or filter by criteria (amount, interest rate, terms)
3. **Application Details:** Users select a loan application to view detailed information and collateral
4. **Apply:** Users select network and apply to fund the loan
5. **Payment:** Users receive invoice with QR code and payment address for funding
6. **Status Tracking:** Users can monitor application status (pending, approved, or rejected)
7. **Completion:** Successful applications show confirmation, rejected applications offer reapply option

## Key UI Patterns

- **Consistent Navigation:** All pages include back navigation and clear page titles
- **Status Indicators:** Color-coded status badges (green for verified/success, orange for pending, red for rejected)
- **Information Cards:** Structured data presentation with clear sections and labels
- **Action Buttons:** Primary blue buttons for main actions, secondary grey for alternatives
- **Copy Functionality:** Important identifiers include copy icons for easy sharing
- **Responsive Design:** Mobile-optimized layout with appropriate touch targets