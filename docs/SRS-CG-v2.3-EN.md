# Software Requirements Specification (SRS) - Crypto Collateral Platform

## Document Control
- **Document ID:** SRS-CG-v2.3
- **Document Version:** 2.3
- **Date:** August 20, 2025
- **Author:** Project Manager
- **Reviewer:** Technical Lead
- **Approver:** Nusatech Development Management

---

## 1. Introduction
### 1.1 Purpose
The purpose of this document is to provide an overview of the software requirements specification (SRS) for the Crypto Collateral platform. Crypto Collateral is a digital platform that enables users to collateralize their crypto assets as security to obtain loans. Target users can be categorized as follows:
- Crypto asset holders who need loans
- Individuals who want to provide funding to earn interest as investment returns
- Companies that want to provide funding to earn interest as investment returns

This document covers general description, project scope, specific requirements, project constraints, functional requirements, and non-functional requirements. The following are the main **stakeholders** involved in this project:
- Product Owner
- End Users
- Company Leadership
- Project Manager
- Technical Lead
- Development Team

This document is intended for technical leads and development teams consisting of:
- **UI/UX Designer**
- **Frontend Developer**
- **Backend Developer**
- **DevOps Engineer**
- **QA Engineer**

### 1.2 Product Scope
#### 1.2.1 Included in Scope:
- **Mobile**-based platform that enables users to collateralize crypto assets as security to obtain loans
- **Web**-based **admin dashboard** for user management, loans, and platform performance management
- **Notification** system for important notifications such as **margin calls**, loan status, and others via email and **push notifications**
- Integration with major **blockchain** networks to ensure transaction security and transparency
- Only supports predetermined crypto assets:
  - **Bitcoin** (**BTC**) - **Network**: Bitcoin
  - **Ethereum** (**ETH**) - **Network**: Ethereum
  - **BNB** - **Network**: **BSC** (Binance Smart Chain)
  - **Solana** (**SOL**) - **Network**: Solana
- Loans only in **USDT** form on specific networks:
  - **USDT-ETH**: **USDT** on **Ethereum Network (ERC-20)**
  - **USDT-BSC**: **USDT** on **BSC Network (BEP-20)**
  - **USDT-SOL**: **USDT** on **Solana Network (SPL Token)**

#### 1.2.2 Not Included in Scope:
- **Trading** or buying/selling crypto assets
- Installment system (payment made in one lump sum approaching due date)
- Loan term extension
- **Investment advisory** or portfolio management
- Institutions/companies can only provide loans (**lender**), cannot borrow (**borrower**)
- Additional **KYC** for Foreign Users
- Partial payments

#### 1.2.3 System Limitations
- **Blockchain Integration**:
  - **Bitcoin Mainnet**
  - **Ethereum Mainnet**
  - **Binance Smart Chain**
  - **Solana Network**
  - Does not support: **Testnet, private blockchain**, or **experimental networks**
- **API Integrations**:
  - **Price Feed APIs**: **CoinGecko/Indodax/Blockchain (TBD) API** for **real-time pricing**
  - **Email Gateway**: **SendGrid** for **email notifications**
  - Does not integrate: **Payment Gateway, Social media APIs, third-party analytics**
- **Data Management**:
  - **Transaction Data**: **PostgreSQL 17** for **transactional records**
  - **KYC Data**: **TBD**
  - Does not store: **User private keys, seed phrases,** or **wallet credentials**
- **Security Boundaries**:
  - **Rate Limiting**: **API throttling** and **DDoS protection**
  - Does not manage: **User's personal wallets** or **private key recovery**

#### 1.2.4 Operating Environment
- **Platform**: **Mobile** (**iOS version 13+**, **Android version 9.0+**), **Web** (**Admin Dashboard**)
- **Browser**: **Chrome, Firefox, Safari, Edge** (**latest versions**)
- **Network Blockchain**: **Bitcoin, Ethereum, BSC, Solana**
- **Deployment**:
  - **Cloud Hosting**: **TBD**
  - **Cloud Storage**: **Minio/S3** for file storage
  - **CDN**: **TBD**
- **Deployment Environment**:
  - **Cloud Hosting**: **TBD**
  - **Cloud Storage**: **TBD**
  - **CDN**: **CloudFlare**
- **Operating System Support**:
  - **Server**: **Ubuntu 24.04 LTS**
  - **Mobile**: **iOS 13+**, **Android 9.0+ (API level 28+)**
  - **Browser**: **Chrome, Firefox, Safari, Edge** (**latest versions**)

### 1.3 Definitions, Acronyms, and Abbreviations
#### 1.3.1 Pawnshop Business Terms

| Term | Definition | Notes |
|---------|----------|------------|
| **LTV** (**Loan to Value**) | Ratio of loan value to collateral value | Example: 70% LTV = loan worth 70% of **collateral** value |
| **Liquidation** | Forced sale of **collateral** when its value drops below **threshold** | Protects **lender** from losses |
| **Margin Call** | Warning to add **collateral** or repay part of the loan | Occurs when **LTV** approaches maximum limit |
| **Collateral** | Crypto assets pledged as loan security | Will be liquidated if default occurs |
| **Principal** | Loan principal (amount of funds borrowed) | Does not include interest and fees |
| **Principal Escrow** | Platform's special account for storing loan funds | Before **disbursement** to **borrower** |
| **Collateral Reserve** | **Collateral** that is **held/frozen** during active loan period | Cannot be withdrawn until paid off |
| **Disbursement** | Process of disbursing loan funds to borrower | After **loan matching** succeeds |
| **Disbursement Fee** | Platform fee when disbursing loan | 1% of loan value (**configurable**) |
| **Maturity Date** | Loan due date | Entire loan + interest must be repaid |
| **Grace Period** | Grace period after due date | Before **liquidation** is executed |
| **Safety Buffer/Margin** | Additional **collateral** above minimum | Anticipating **crypto** price **volatility** |
| **Loan Offer** | Funding offer from **lender** | With specific **terms** (interest, **tenor**) |
| **Full/Partial Liquidation** | **Liquidation** of all or part of **collateral** | Depends on selected **mode** |
| **Surplus/Deficit** | Excess/shortage from **liquidation** results | **Surplus** returned, **deficit** borne by platform |

#### 1.3.2 Blockchain-Specific Terms

| Term | Definition | Notes |
|---------|----------|------------|
| **Gas Fee** | Transaction fee on **blockchain network** | Varies depending on **network congestion** |
| **HD Wallet** | **Hierarchical Deterministic Wallet** | **Generate unlimited addresses** from **single seed** |
| **Derivation Path** | Specific **path** to **generate address** from **HD wallet** | Example: **m/44'/0'/0'/0/0** for Bitcoin |
| **Block Confirmation** | Number of blocks added after transaction | Bitcoin: 6, Ethereum: 12 confirmations |
| **Stablecoin** | **Cryptocurrency** whose value is **pegged** to **USD** | **USDT** = 1:1 with **USD** |
| **Slippage** | Difference between **expected** and **actual execution price** | When **market order** on **exchange** |
| **Circuit Breaker** | Automatic **stop trading** mechanism | When extreme price **volatility** (>10%) |

#### 1.3.3 Platform-Specific Terms

| Term | Definition | Notes |
|---------|----------|------------|
| **Borrower** | Borrower who pledges crypto assets | Gets **USDT** with **crypto** collateral |
| **Lender** | Fund provider/**investor** | Gets **return** from loan interest |
| **Institution Owner** | **User** who registers institution account | Has full institution **privileges** |
| **Institution Member** | **User** invited as institution member | Limited access according to **role** |
| **Beneficiary** | Registered **wallet** address for **withdrawal** | Must be verified before use |
| **Originated** | **Loan status** newly **created** from **matching** | Not yet **disbursed** |
| **Disbursed** | **Loan status** after funds disbursed to **borrower** | **Loan** actively running |
| **Concluded** | Loan completed with **normal completion** | Paid off on time |
| **Liquidated** | **Collateral** sold due to **trigger condition** | **LTV breach** or payment default |
| **Staleness** | Condition of **outdated** **price** data | Needs **refresh** from **price feed** |

### 1.4 References
- Bank Indonesia regulations on Financial Technology
- OJK regulations on Information Technology-Based Money Lending Services
- **API Design Guidelines**
- **JWT Standards**

#### 1.4.1 Related Documents
- **System Architecture** Document
- **API** Documentation

#### 1.4.2 External Documents
- **RPC API** for **blockchain networks**: **BTC, ETH, SOL**
- **CoinGecko API Documentation**
- **SendGrid API Documentation**

### 1.5 Document Overview
This **SRS** document consists of several main chapters:
- **Chapter 1: Introduction:** Provides context and purpose of the document
- **Chapter 2: General Description:** Explains project purpose, scope, and **stakeholders**
- **Chapter 3: Specific Requirements:** Details business requirements, business rules, and **functional** requirements
- **Chapter 4: Non-Functional Requirements:** Provides **performance, security, reliability**, and **usability** requirements

Numbering Convention:
- **Product Functions**: **FUNC-xxx**
- **Functional Requirements**: **RF-xxx**
- **Performance Requirements:** **PERF-xxx**
- **Security Requirements:** **SEC-xxx**
- **Availability:** **AVL-xxx**
- **Interface Requirements:** **INT-xxx**
- **Reliability Requirements:** **REL-xxx**
- **Portability Requirements:** **PORT-xxx**
- **Maintenance Requirements:** **MAIN-xxx**
- **Business Requirements:** **BR-xxx**
- **Financial Controls:** **FC-xxx**
- **System Configuration:** **CONF-xxx**

---

## 2. General Description
### 2.1 Project Perspective
This **crypto collateral** platform is a **standalone** system that operates as an independent financial service within Indonesia's **fintech** ecosystem. The system uses **monolithic architecture** with **blockchain** integration to ensure transaction transparency and security.

The system consists of:
- **Mobile Application**: Based on **React Native** for users enabling them to manage loans, **collateral**, and their accounts.
- **Backend API Server**: Based on **Node.js** with **NestJS** to handle business logic and **database** interactions.
- **Web-based Admin Dashboard**: Based on **Angular** for user management, loans, and platform performance **monitoring**.
- **Database**: **PostgreSQL** for storing user, loan, and transaction data.

External integrations include:
- **Blockchain Networks (BTC, ETH, BNB, SOL)** for transactions
- **CoinGecko** for obtaining **collateral** prices
- **SendGrid** for **email notifications**

### 2.2 Product Functions
Main functions of the Crypto Collateral platform include:

- **FUNC-001: User Authentication**
  - **Description:** Secure **login** and **logout** system using **Google OAuth** to ensure only verified users can access the platform.
  - **Priority:** Critical

- **FUNC-002: User Profile Management**
  - **Description:** Managing user personal data including **update** and delete user information.
  - **Priority:** High

- **FUNC-003: KYC Verification**
  - **Description:** User identity verification process through individual document **upload** (ID card, **selfie**), company (Articles of Incorporation, Company Tax ID, Business License, Director's ID) data validation, and **approval/rejection** by **admin**.
  - **Priority:** Critical

- **FUNC-004: Company Profile Management**
  - **Description:** Specifically for company users, managing company data including Tax ID, articles of incorporation, ownership information, and other legal documents required for business entity verification.
  - **Priority:** Medium

- **FUNC-005: User Account & Balance Management**
  - **Description:** Displaying and managing user **wallet** balances in various **cryptocurrency (BTC, ETH, BNB, SOL)** and **USDT**, including transaction history and **deposit/withdrawal tracking**.
  - **Priority:** Critical

- **FUNC-006: Invoice Management**
  - **Description:** Automatic **invoice** creation and management for every loan transaction, interest payment, and platform fees with complete details for **audit** and taxation purposes.
  - **Priority:** High

- **FUNC-007: Withdrawal Management**
  - **Description:** Process of withdrawing funds/**crypto** assets from platform to user's external **wallet** with multi-layered security validation and **blockchain** confirmation to ensure secure transactions.
  - **Priority:** Critical

- **FUNC-008: Exchange Rate Management**
  - **Description:** System that retrieves and updates **cryptocurrency** exchange rates in **real-time** from **price feed provider (CoinGecko)** for **LTV** calculation and **collateral** value **monitoring**.
  - **Priority:** Critical

- **FUNC-009: Loan Offer Management**
  - **Description:** Feature for **investors** to create **Loan Offers** by determining fund amount, desired interest rate, and borrower criteria who can apply for loans.
  - **Priority:** Critical

- **FUNC-010: Loan Application Management**
  - **Description:** Process for borrowers to apply for loans by selecting **Loan Offers**, determining loan amount, depositing **crypto collateral**, and automatic **LTV ratio** calculation.
  - **Priority:** Critical

- **FUNC-011: Loan Process Management**
  - **Description:** Managing loan **lifecycle** from **approval**, fund disbursement, periodic interest payment, principal repayment, to collateral return or **liquidation** execution if necessary.
  - **Priority:** Critical

- **FUNC-012: Loan Monitoring**
  - **Description:** **Real-time dashboard** for monitoring active loan status, **collateral** value, **LTV ratio**, payment schedule, and automatic **trigger** for **margin call** or **liquidation** when **LTV** exceeds **threshold**.
  - **Priority:** Critical

- **FUNC-013 Admin Authentication & Session Management**
  - **Description:** Security feature to validate and manage **admin sessions** (session-based authentication with httpOnly cookies) and mandatory **2FA**.
  - **Priority:** Critical

- **FUNC-014: Admin KYC Review and Approval**
  - **Description:** Feature for **admin** to **review** and provide approval/rejection for **KYC** documents submitted by users.
  - **Priority:** Critical

- **FUNC-015: Admin Company Application Processing**
  - **Description:** Feature to process and validate company account applications including verification of company legal documents.
  - **Priority:** Critical

- **FUNC-016: Admin Withdrawal Management**
  - **Description:** Feature to handle failed withdrawal cases including investigation, **refund**, and communication with users.
  - **Priority:** Critical

- **FUNC-017: Admin User Account Management**
  - **Description:** Feature for **admin** to manage user accounts including **suspend/unsuspend**, **reset password**, and **2FA reset** assistance.
  - **Priority:** Critical

### 2.3 User Characteristics
#### 2.3.1 Borrower
- **Profile**: **Crypto investor, trader**, or **holder** who needs quick **liquidity**
- Characteristics:
  - Age >21 years, **tech-savvy**
  - Owns **cryptocurrency** as **collateral**
  - **Income level** middle to upper
  - Needs quick access to **liquidity** without selling **crypto**
- Skills: **Basic blockchain knowledge**, familiar with **wallet management**
- Needs:
  - **Loan offers, listing Loan Offers**
  - **KYC verification status**
  - **LTV** calculator
  - **Balance**
  - Loan application
  - **Monitoring** active loan status
  - **Notifications** for **margin call** and **liquidation**
  - **Withdrawal interface**

#### 2.3.2 Lender/Investor
- **Profile**: **Individual** or company owner **investor** who wants to earn **yield**
- Characteristics:
  - Age >21 years, high **financial literacy**
  - Has **excess capital** for investment
  - **Risk-aware** for **crypto-backed lending**
  - Seeking **portfolio diversification** with **fixed income**
- Skills: **Investment analysis, risk assessment, financial planning**
- Needs:
  - **Listing** loan offers
  - **KYC verification status**
  - **Balance**
  - Funding application
  - **Monitoring** active investment status
  - **Notifications** for **margin call** and **liquidation**
  - **Withdrawal interface**

#### 2.3.3 Platform Admin
- **Profile**: **Operational staff** managing **day-to-day operations** with full system **level** access
- Characteristics:
  - Financial or **fintech** **background**
  - Familiar with **risk management**
  - **Experience** in **customer service**
- Skills: Financial analysis, **customer relationship, basic technical knowledge**
- Needs:
  - **Parameter Setting**
  - **LTV** configuration
  - **Collateral liquidation**
  - **User Management**
  - **KYC verification**
  - Loan **monitoring**
  - **Collateral monitoring**
  - **Invoice** management
  - **Withdrawal** management
  - Platform balance **monitoring** (transaction **fees**)
  - **User balance monitoring**
  - **User activity monitoring**
  - **Customer support**

### 2.4 Constraints
#### 2.4.1 Technology Constraints
- **Native mobile apps** for general users
- **Website**-based applications for platform **admin**

#### 2.4.2 Business Constraints
- Platform fees in the form of percentages configurable by **admin**:
  - Disbursement fee (paid by borrower)
  - **Liquidation** fee (paid by borrower)
  - Early **liquidation** fee (paid by borrower for **liquidation** before maturity)
  - Withdrawal fee (**optional**, configurable by **admin**)
- **Crypto tax** 0.1% borne by users according to regulations
- **Blockchain** network fees fully borne by platform

#### 2.4.3 Payment Policy
- Loan payments can exceed **invoice** amount
- Excess payments will be credited to user balance
- Payments less than **invoice** amount will not be applied to loan
- Partial payment funds will **accumulate** in **invoice** until sufficient
- **Liquidation** occurs immediately on due date without grace period
- No early payment, but early **liquidation** available with **liquidation** fee

#### 2.4.4 Performance Constraints
- **Latency** must be < 1000**ms** for all transactions
- Number of users < 25 **online** at the same time

#### 2.4.5 Security Constraints
- **Private keys** stored in single file on **server**
- **HTTPS-only**

### 2.5 Assumptions and Dependencies
#### 2.5.1 Assumptions
- **Users** know basic pawnshop process rules
- **Users** use adequate **devices** to open the application
- **Blockchain networks** will **maintain uptime** minimum 99.0%
- **Cloud infrastructure** will be **scalable** according to **user** growth
- **Internet infrastructure** will support **real-time applications**
- **TBD**

#### 2.5.2 Dependencies
- **Blockchain Networks**: Bitcoin, Ethereum, Binance Smart Chain, Solana **network stability**
- Using **CoinGecko API** for **price provider**
- Using **AWS** as **cloud infrastructure**
- Using **SendGrid** for **email notifications**
- **TBD**

---

## 3. Functional Requirements

### 3.1 User Authentication

**RF-001: App Launch & Auto Login**
- **Priority**: Critical
- **Description**: Automatic authentication when app starts using stored credentials
- **Input**: Stored authentication token
- **Processing**: 
  1. User opens application
  2. System checks stored token
  3. Validate token
  4. Retrieve user profile data
- **Output**: User enters main page or redirected to login page
- **Actor**: User
- **Precondition**: Application installed, user has/doesn't have previous session
- **Postcondition**: User authenticated or must login manually

**RF-002: Email Registration** (Modified)
- **Priority**: Critical
- **Description**: New user registration with email and password
- **Input**: Email, password
- **Processing**:
  1. Validate email format
  2. Check email uniqueness
  3. Send verification email
  4. Hash password
  5. Create user account
  6. **After successful registration, user selects role (Individual/Company)**
  7. Create accounts for all supported currencies
  8. **KYC not mandatory during registration (accessible from dashboard/profile)**
- **Output**: Authentication token, user profile, redirect to role selection
- **Actor**: User
- **Precondition**: Valid email, not already registered
- **Postcondition**: Account created, user selects role

**RF-003: Email Login**
- **Priority**: Critical
- **Description**: Registered user authentication
- **Input**: Email, password
- **Processing**:
  1. Validate credentials
  2. Check 2FA status if active
  3. Create authentication token
- **Output**: User authenticated or error message
- **Actor**: User
- **Precondition**: User registered
- **Postcondition**: User enters application or stays on login page

**RF-004: Google OAuth**
- **Priority**: Critical
- **Description**: Login using Google account
- **Input**: Google access token
- **Processing**:
  1. User selects "Login with Google"
  2. Google authorization
  3. Validate token
  4. Find/create user account
  5. **If new user, redirect to role selection**
- **Output**: Authentication token, user profile
- **Actor**: User
- **Precondition**: Has valid Google account
- **Postcondition**: User authenticated

**RF-005: Password Reset**
- **Priority**: High
- **Description**: Password reset for users who forgot
- **Input**: Email address
- **Processing**:
  1. Send password reset link
  2. User clicks link
  3. Input new password
  4. Update password
- **Output**: Password updated
- **Actor**: User
- **Precondition**: Registered account
- **Postcondition**: Password successfully changed

### 3.2 User Profile Management

**RF-006: User Profile** (Modified)
- **Priority**: Medium
- **Description**: View profile information and access to KYC
- **Input**: Authentication token
- **Processing**:
  1. User opens profile page
  2. Display profile data
  3. **Display option to submit KYC if not yet verified**
- **Output**: User profile data with KYC status
- **Actor**: User
- **Precondition**: User authenticated
- **Postcondition**: User can view profile and KYC status

**RF-007: Link Google Account**
- **Priority**: Medium
- **Description**: Link Google account to profile
- **Input**: Google access token
- **Processing**:
  1. Google authorization
  2. Validate token
  3. Update profile with Google info
- **Output**: Google account linked
- **Actor**: User
- **Precondition**: Authenticated, not yet linked to Google
- **Postcondition**: Can login with Google

**RF-008: Link Email Account**
- **Priority**: Medium
- **Description**: Link email to OAuth profile
- **Input**: Email, password
- **Processing**:
  1. Validate credentials
  2. Update profile with email
  3. Send confirmation
- **Output**: Email linked
- **Actor**: User
- **Precondition**: Login via OAuth, not yet linked to email
- **Postcondition**: Can login with email

**RF-009: Update Profile**
- **Priority**: High
- **Description**: Update profile information
- **Input**: Full name, profile photo
- **Processing**:
  1. Input new data
  2. Upload photo (optional)
  3. Update database
- **Output**: Profile updated
- **Actor**: User
- **Precondition**: Authenticated
- **Postcondition**: Profile information updated

### 3.3 KYC Verification (Modified - Accessed from Dashboard/Profile)

**RF-010: User KYC Submission** (Modified)
- **Priority**: Critical
- **Description**: KYC submission from dashboard/profile page
- **Input**: ID number, full name, date of birth, place of birth, address, gender, phone number, postal code, ID card file, selfie file
- **Processing**:
  1. **User accesses KYC from dashboard/profile settings**
  2. Upload documents
  3. OCR reads ID card data
  4. Preview and revise data
  5. Submit for review
- **Output**: KYC status "Pending"
- **Actor**: Individual User
- **Precondition**: Authenticated, **accessible anytime from dashboard**
- **Postcondition**: KYC awaiting admin review

**RF-011: KYC Admin Review**
- **Priority**: Critical
- **Description**: Admin review KYC submissions
- **Input**: Submission ID, approval/rejection decision, review notes
- **Processing**:
  1. Admin accesses pending KYC list
  2. Review documents
  3. Approve or reject with reason
  4. Notify user
- **Output**: KYC approved or rejected
- **Actor**: Admin
- **Precondition**: Admin authenticated, pending KYC exists
- **Postcondition**: KYC status updated

**RF-012: KYC Status Check**
- **Priority**: High
- **Description**: Check KYC verification status
- **Input**: Authentication token
- **Processing**:
  1. Retrieve KYC status
  2. Display status (None/Pending/Verified/Rejected)
  3. If rejected, display resubmit option
- **Output**: KYC status with details
- **Actor**: User
- **Precondition**: Authenticated
- **Postcondition**: KYC status displayed

### 3.4 Company Profile Management (Selected during Registration)

**RF-013: Company Application** (Modified)
- **Priority**: Critical
- **Description**: Company KYC submission after selecting Company role
- **Input**: Company name, Tax ID, deed number, Business License, director's ID, director's name, company documents
- **Processing**:
  1. **User who selected Company role during registration can submit from dashboard**
  2. Upload company documents
  3. Validate data
  4. Submit for admin review
- **Output**: Company application pending
- **Actor**: Company User
- **Precondition**: Selected Company role during registration
- **Postcondition**: Awaiting admin review

**RF-014: Company KYC Admin Review**
- **Priority**: Critical
- **Description**: Admin review company applications
- **Input**: Application ID, decision, review notes
- **Processing**:
  1. Review company documents
  2. Approve: create company entity, set as Owner
  3. Reject: send rejection reason
- **Output**: Company approved or rejected
- **Actor**: Admin
- **Precondition**: Admin authenticated
- **Postcondition**: Application status updated

**RF-015: Company Add Member**
- **Priority**: Medium
- **Description**: Owner invites members to company
- **Input**: User email, role (Member/Admin)
- **Processing**:
  1. Validate target user
  2. Create invitation
  3. Send notification
- **Output**: Invitation sent
- **Actor**: Institution Owner
- **Precondition**: Authenticated as Owner
- **Postcondition**: Invitation created

**RF-016: Member Invitation Response**
- **Priority**: Medium
- **Description**: User responds to company invitation
- **Input**: Invitation ID, accept/reject decision
- **Processing**:
  1. Accept: join company
  2. Reject: decline invitation
- **Output**: Membership confirmed or rejected
- **Actor**: Invited User
- **Precondition**: Received valid invitation
- **Postcondition**: Membership status updated

### 3.5 Account & Balance Management

**RF-017: Account Balance**
- **Priority**: Critical
- **Description**: Display all account balances
- **Input**: Authentication token
- **Processing**:
  1. Retrieve user account data
  2. Calculate available balance
  3. Calculate pending operations
  4. Aggregate portfolio value
- **Output**: Balance with pending operations
- **Actor**: User
- **Precondition**: Authenticated
- **Postcondition**: Balance information displayed

**RF-018: Account Transaction History**
- **Priority**: High
- **Description**: Account transaction history
- **Input**: Account ID, filter, pagination
- **Processing**:
  1. Validate ownership
  2. Apply filter
  3. Format with descriptions
- **Output**: Paginated transaction list
- **Actor**: User
- **Precondition**: Authenticated, owns account
- **Postcondition**: Transaction history displayed

### 3.6 Invoice Management

**RF-019: Invoice Creation**
- **Priority**: Critical
- **Description**: Platform creates payment invoice with unique blockchain address
- **Input**: Currency, amount, type, due date
- **Processing**:
  1. Validate parameters
  2. Generate payment address
  3. Create invoice record
  4. Send notification
- **Output**: Invoice with payment instructions
- **Actor**: Platform System
- **Precondition**: Valid parameters
- **Postcondition**: Invoice created with unique address

**RF-020: Invoice Payment Detection**
- **Priority**: Critical
- **Description**: Detect cryptocurrency payments to invoice addresses
- **Input**: Transaction data from blockchain
- **Processing**:
  1. Scan blockchain
  2. Match with invoice addresses
  3. Verify confirmations
  4. Update invoice status
  5. Process according to invoice type
- **Output**: Payment detected, status updated
- **Actor**: Blockchain Indexer
- **Precondition**: Active invoice, blockchain accessible
- **Postcondition**: Payment processed, user notified

**RF-021: Invoice Status Management**
- **Priority**: Critical
- **Description**: Monitor invoice lifecycle
- **Input**: Active invoices
- **Processing**:
  1. Monitor due dates
  2. Send reminders
  3. Handle expiry
  4. Process partial payments
- **Output**: Status updated, notifications sent
- **Actor**: Invoice Monitor Worker
- **Precondition**: Active invoices exist
- **Postcondition**: Status maintained, consequences applied

### 3.7 Withdrawal Management

**RF-022: Beneficiary Account Registration**
- **Priority**: High
- **Description**: Register withdrawal addresses
- **Input**: Currency, blockchain address, label
- **Processing**:
  1. Validate address format
  2. Check blacklist
  3. Send verification email
  4. Activate after verification
- **Output**: Beneficiary registered
- **Actor**: User
- **Precondition**: Authenticated, KYC verified
- **Postcondition**: Address available for withdrawal

**RF-023: Request Withdrawal**
- **Priority**: Critical
- **Description**: Process withdrawal requests
- **Input**: Amount, beneficiary ID, currency, 2FA code
- **Processing**:
  1. Validate parameters
  2. Check balance
  3. Calculate fees
  4. Debit account
  5. Queue for processing
- **Output**: Withdrawal request created
- **Actor**: User
- **Precondition**: Sufficient balance, active beneficiary
- **Postcondition**: Request queued, balance updated

**RF-024: Process and Execute Withdrawal**
- **Priority**: Critical
- **Description**: Execute withdrawal on blockchain
- **Input**: Withdrawal requests
- **Processing**:
  1. Prepare transaction
  2. Execute on blockchain
  3. Monitor confirmations
  4. Update status
- **Output**: Withdrawal completed or failed
- **Actor**: Withdrawal Worker
- **Precondition**: Request approved, sufficient wallet balance
- **Postcondition**: Funds transferred or refunded

**RF-025: Handle Failed Withdrawal and Refund**
- **Priority**: High
- **Description**: Manage failed withdrawals
- **Input**: Failed withdrawal ID
- **Processing**:
  1. Detect failure
  2. Admin review
  3. Process refund if approved
  4. Credit user account
- **Output**: Refund processed
- **Actor**: Admin
- **Precondition**: Withdrawal failed
- **Postcondition**: User balance restored

### 3.8 Exchange Rate Management

**RF-026: Exchange Rate**
- **Priority**: High
- **Description**: Provide currency exchange rates
- **Input**: Optional filter
- **Processing**:
  1. Fetch latest rates
  2. Apply filters
  3. Format response
- **Output**: Current exchange rates
- **Actor**: User
- **Precondition**: Authenticated
- **Postcondition**: Rates provided

### 3.9 Loan Offer Management

**RF-027: Loan Offer Creation**
- **Priority**: Critical
- **Description**: Lender creates loan offers
- **Input**: Principal amount, collateral types, interest rate, terms
- **Processing**:
  1. Validate parameters
  2. Generate legal document
  3. Create funding invoice
  4. Process principal payment
  5. Publish offer
- **Output**: Loan offer published
- **Actor**: Lender
- **Precondition**: KYC verified, sufficient balance
- **Postcondition**: Offer visible in marketplace

**RF-028: Loan Offer Matching**
- **Priority**: Critical
- **Description**: Automatically match applications with offers
- **Input**: Active applications and offers
- **Processing**:
  1. Find compatible matches
  2. Calculate match scores
  3. Execute best match
  4. Create loan contract
- **Output**: Loan contract created
- **Actor**: Backend Worker
- **Precondition**: Active applications and offers exist
- **Postcondition**: Matched or remain in queue

**RF-029: Loan Offer Management**
- **Priority**: High
- **Description**: Lender manages active offers
- **Input**: Offer ID, action (close)
- **Processing**:
  1. View portfolio
  2. Update status
  3. Return unused funds if close
- **Output**: Status updated
- **Actor**: Lender
- **Precondition**: Has active offers
- **Postcondition**: Offer status changed

### 3.10 Loan Application Management

**RF-030: Loan Application Creation**
- **Priority**: Critical
- **Description**: Borrower creates loan applications
- **Input**: Collateral type, principal amount, max interest, term
- **Processing**:
  1. Calculate required collateral
  2. Generate deposit invoice
  3. Process collateral payment
  4. Publish application
- **Output**: Application published
- **Actor**: Borrower
- **Precondition**: KYC verified
- **Postcondition**: Application queued for matching

**RF-031: Loan Application Status**
- **Priority**: High
- **Description**: Track application status
- **Input**: Application ID
- **Processing**:
  1. View application list
  2. Check status
  3. Manage actions (cancel/extend)
- **Output**: Status information
- **Actor**: Borrower
- **Precondition**: Has applications
- **Postcondition**: Status displayed

### 3.11 Loan Lifecycle Management

**RF-032: Loan Disbursement**
- **Priority**: Critical
- **Description**: Disburse principal to borrower
- **Input**: Loan ID
- **Processing**:
  1. Calculate amounts and fees
  2. Transfer funds
  3. Schedule repayment
  4. Start monitoring
- **Output**: Funds disbursed
- **Actor**: Platform
- **Precondition**: Loan originated
- **Postcondition**: Loan active

**RF-033: Loan Repayment**
- **Priority**: Critical
- **Description**: Process loan payments
- **Input**: Loan ID, payment amount
- **Processing**:
  1. Generate repayment invoice
  2. Process payment
  3. Release collateral if paid off
  4. Transfer to lender
- **Output**: Repayment processed
- **Actor**: Borrower
- **Precondition**: Loan active
- **Postcondition**: Loan repaid or partial payment

**RF-034: Loan Liquidation**
- **Priority**: Critical
- **Description**: Liquidate collateral when threshold violated
- **Input**: Loan ID, liquidation mode
- **Processing**:
  1. Prepare liquidation
  2. Execute on exchange
  3. Distribute proceeds
  4. Handle surplus/deficit
- **Output**: Collateral liquidated
- **Actor**: Platform
- **Precondition**: LTV exceeded or payment failed
- **Postcondition**: Funds distributed

### 3.12 Loan Monitoring

**RF-035: LTV Monitoring**
- **Priority**: Critical
- **Description**: Monitor loan-to-value ratios
- **Input**: Active loans, exchange rates
- **Processing**:
  1. Calculate current LTV
  2. Check thresholds
  3. Send notifications
  4. Trigger liquidation if necessary
- **Output**: LTV updated, actions triggered
- **Actor**: Monitoring Worker
- **Precondition**: Active loans exist
- **Postcondition**: Appropriate actions taken

**RF-036: Price Feed Integration**
- **Priority**: Critical
- **Description**: Maintain accurate price feeds
- **Input**: Currency pairs
- **Processing**:
  1. Collect from multiple sources
  2. Validate and cross-check
  3. Store and distribute
- **Output**: Validated prices
- **Actor**: Price Feed Worker
- **Precondition**: APIs configured
- **Postcondition**: Accurate prices available

### 3.13 Admin Authentication & Session Management

**RF-037: Admin Login**
- **Priority**: Critical
- **Description**: Admin authentication for admin app access
- **Input**: Email, password, 2FA code (mandatory), Remember Me (optional)
- **Processing**:
  1. Admin enters admin login page
  2. Input email, password, and mandatory 2FA code
  3. Validate credentials and admin role
  4. Check rate limiting and lockout status
  5. Verify 2FA code
  6. Create secure session with httpOnly cookie
  7. Update last login and redirect to dashboard
- **Output**: Secure session cookie, user info with admin permissions
- **Actor**: Admin
- **Precondition**: Has account with admin role
- **Postcondition**: Admin authenticated and enters dashboard

**RF-038: Session Refresh**
- **Priority**: Critical
- **Description**: Maintain session
- **Input**: Valid session cookie
- **Processing**:
  1. Validate session on every API request
  2. Check session expiry
  3. Create new session cookie
  4. Rotate new session cookie
  5. Update session data
- **Output**: Cookie and session data updated
- **Actor**: Admin Web App
- **Precondition**: Admin authenticated with new session
- **Postcondition**: Session updated, no interruption

**RF-039: In-App Password Change**
- **Priority**: High
- **Description**: Admin changes password within application
- **Input**: Current password, new password, 2FA code
- **Processing**:
  1. Validate current password
  2. Verify 2FA for security
  3. Check password requirements
  4. Update password
  5. Invalidate other sessions
  6. Send notification
- **Output**: Password successfully changed
- **Actor**: Admin
- **Precondition**: Admin authenticated
- **Postcondition**: Password changed, other sessions invalidated

**RF-040: Two-Factor Authentication Management**
- **Priority**: High
- **Description**: Manage admin 2FA settings (mandatory enabled)
- **Input**: Password for verification, totp authenticator app
- **Processing**:
  1. Verify password
  2. Generate TOTP secret and URI
  3. Generate backup codes
  4. Display QR code for authenticator app
  5. Verify setup
  6. Activate 2FA
- **Output**: 2FA active with TOTP and backup codes
- **Actor**: Admin
- **Precondition**: Admin authenticated for first time and hasn't activated 2FA
- **Postcondition**: Admin registered with active 2FA

**RF-041: Session Management**
- **Priority**: High
- **Description**: Monitor and control admin sessions
- **Input**: Session ID to revoke, 2FA code
- **Processing**:
  1. Display active sessions
  2. Show details (IP, location, device)
  3. Revoke suspicious sessions
  4. Verify 2FA for revoke
  5. Log session events
- **Output**: Session list or session revoked
- **Actor**: Admin
- **Precondition**: Admin authenticated
- **Postcondition**: Sessions monitored/controlled

### 3.14 Admin KYC Review and Approval

**RF-042: KYC Review Queue System**
- **Priority**: Critical
- **Description**: Display and manage pending KYC queue
- **Input**: Filter parameters, pagination, search query
- **Processing**:
  1. Fetch pending KYC submissions
  2. Apply filters and search
  3. Show preview with user info
  4. Enable bulk actions
  5. Display with pagination
- **Output**: Paginated list of KYC submissions
- **Actor**: Admin
- **Precondition**: Admin with KYC review permissions
- **Postcondition**: Admin can manage KYC queue

**RF-043: Individual KYC Review**
- **Priority**: Critical
- **Description**: Review individual KYC submission details
- **Input**: KYC ID, review decision, notes/rejection reason
- **Processing**:
  1. Load complete KYC details
  2. Display personal info and documents
  3. Show verification checklist
  4. Review and decide:
     - Approve: update status to verified
     - Reject: update status to rejected with reason
  5. Send notification to user
- **Output**: KYC approved or rejected
- **Actor**: Admin
- **Precondition**: KYC submission exists
- **Postcondition**: User KYC status updated

### 3.15 Admin Company Application Processing

**RF-044: Institution Applications Queue**
- **Priority**: Medium
- **Description**: Display pending institution application queue
- **Input**: Filter, pagination, search
- **Processing**:
  1. Fetch pending applications
  2. Apply filters
  3. Show summary cards
  4. Display priority indicators
  5. Enable search
- **Output**: List of pending institution applications
- **Actor**: Admin
- **Precondition**: Admin with institution review permissions
- **Postcondition**: Admin can view application queue

**RF-045: Institution Application Review**
- **Priority**: Medium
- **Description**: Review institution application details
- **Input**: Application ID, decision, notes
- **Processing**:
  1. Load application details
  2. Display business info and documents
  3. Verify applicant KYC
  4. Due diligence checklist
  5. Review actions:
     - Approve: create institution entity, set owner
     - Reject: update rejected with reason
- **Output**: Institution approved or rejected
- **Actor**: Admin
- **Precondition**: Application exists
- **Postcondition**: Institution created or application rejected

### 3.16 Admin Withdrawal Management

**RF-046: Withdrawal Management Queue**
- **Priority**: Critical
- **Description**: Display and manage withdrawal request queue
- **Input**: Filter (status, currency, date, amount), pagination, search
- **Processing**:
  1. Fetch withdrawal requests
  2. Apply filters
  3. Show request details
  4. Display platform wallet balance
  5. Enable bulk processing
  6. Priority indicators
- **Output**: Paginated withdrawal list
- **Actor**: Admin
- **Precondition**: Admin with withdrawal permissions
- **Postcondition**: Admin can manage withdrawal queue

**RF-047: Withdrawal Monitoring Dashboard**
- **Priority**: High
- **Description**: Monitor real-time withdrawal status
- **Input**: Filter by status, currency, time range
- **Processing**:
  1. Fetch active withdrawals
  2. Query blockchain status
  3. Calculate confirmation progress
  4. Identify stuck transactions
  5. Show alerts and statistics
  6. Enable quick actions
- **Output**: Real-time monitoring dashboard
- **Actor**: Admin
- **Precondition**: Active withdrawals exist
- **Postcondition**: Admin can monitor and intervene

### 3.17 Admin User Account Management

**RF-048: User Management Dashboard**
- **Priority**: Critical
- **Description**: Display and manage all platform users
- **Input**: Filter (role, KYC status, account status), search, pagination
- **Processing**:
  1. Fetch all users
  2. Apply filters
  3. Include account statistics
  4. Calculate risk scores
  5. Display with quick actions
  6. Enable bulk actions
- **Output**: Paginated user list with details
- **Actor**: Admin
- **Precondition**: Admin with user management permissions
- **Postcondition**: Admin can manage users

**RF-049: Individual User Profile Management**
- **Priority**: Critical
- **Description**: View and manage individual user profile details
- **Input**: User ID, profile updates, status changes, admin notes
- **Processing**:
  1. Load complete user profile
  2. Display personal info, KYC, finances
  3. Show loan activity
  4. Risk assessment
  5. Admin actions:
     - Edit profile
     - Suspend/lock account
     - Reset password
     - Add notes
- **Output**: Complete profile or action success
- **Actor**: Admin
- **Precondition**: User exists
- **Postcondition**: User profile/status updated

**RF-050: User Activity Monitoring**
- **Priority**: High
- **Description**: Monitor real-time and historical user activities
- **Input**: User ID/filter, date range, activity type
- **Processing**:
  1. Fetch activity logs
  2. Apply filters
  3. Identify suspicious patterns
  4. Generate timeline
  5. Show analytics dashboard
- **Output**: Activity logs with analysis
- **Actor**: Admin
- **Precondition**: Activity logs exist
- **Postcondition**: Admin can monitor activities

**RF-051: User Communication Management**
- **Priority**: Medium
- **Description**: Send communications to users
- **Input**: Recipients, message type, content, schedule
- **Processing**:
  1. Select recipients
  2. Compose message
  3. Choose channel (email/push/in-app)
  4. Queue messages
  5. Track delivery status
- **Output**: Messages sent with delivery report
- **Actor**: Admin
- **Precondition**: Valid recipients selected
- **Postcondition**: Messages delivered

**RF-052: Admin Invitation Creation**
- **Priority**: Critical
- **Description**: Admin creates invitation for regular user to become admin
- **Input**: Target user email, invitation message, 2FA code
- **Processing**:
  1. Verify admin role and 2FA
  2. Validate target user is not admin
  3. Generate invitation token (24 hours)
  4. Send invitation email
  5. Log invitation event
- **Output**: Invitation created and sent
- **Actor**: Admin
- **Precondition**: Target user exists as regular user
- **Postcondition**: Invitation active for 24 hours

**RF-053: Admin Invitation Acceptance**
- **Priority**: Critical
- **Description**: Regular user accepts invitation and sets up mandatory 2FA
- **Input**: Invitation token, password, 2FA verification code
- **Processing**:
  1. Validate invitation token
  2. User accepts terms
  3. Upgrade role to Admin
  4. Setup mandatory 2FA
  5. Scan QR code
  6. Verify 2FA setup
  7. Activate admin account
- **Output**: Admin role granted with active 2FA
- **Actor**: Invited User
- **Precondition**: Valid invitation within 24 hours
- **Postcondition**: User becomes admin with mandatory 2FA

---

## 4. Non-Functional Requirements

### 4.1 Performance
- **PERF-001: API Response Time**
  - **Requirement:** All core **API** requests must have response times less than 1,000 **ms** (1 second) under normal load conditions (up to 25 concurrent users).
  - **Metric:** Average response time for main **API endpoints** (**login, submit loan, fetch balance**).
- **PERF-002: Throughput**
  - **Requirement:** Platform must be able to process at least 100 **blockchain** transactions per minute.
  - **Metric:** Number of transactions processed per minute.
- **PERF-003: Scalability**
  - **Requirement:** System architecture must be scalable to accommodate user growth up to 1,000 daily active users in the first year.
  - **Metric:** Size of **server cluster** used and time required to scale resources (e.g., adding new **server instances**).
- **PERF-004: Blockchain Indexer Efficiency**
  - **Requirement:** **Blockchain indexer** must be able to detect and process new transactions within 10 minutes after **block** confirmation.
  - **Metric:** Average time from **block** confirmation to user balance update.

### 4.2 Security
- **SEC-001: User Authentication**
  - **Requirement:** Admin authentication with session-based authentication using **httpOnly cookies** for optimal security. Regular user authentication can use signed and encrypted **JWT** (**JWE**) with short expiration time.
  - **Metric:** Admin **session** lifespan and regular user **token** lifespan with **token refresh** implementation.
- **SEC-002: KYC Verification**
  - **Requirement:** **KYC** documents must be encrypted when stored (in **transit** and **at rest**) and only accessible by authorized **admins**.
  - **Metric:** Presence of encryption in storage system (**Minio/S3**) and **database**.
- **SEC-003: Brute Force Protection**
  - **Requirement:** All authentication **endpoints** must implement **rate limiting** to prevent **brute-force** attacks.
  - **Metric:** Number of failed **login** attempts before `IP address` is temporarily blocked (e.g., 5 attempts in 5 minutes).
- **SEC-004: Cryptographic Keys**
  - **Requirement:** **Private keys** for platform **wallets** must be stored in secure and isolated environment (**vault** or **hardware encryption**).
  - **Metric:** Security audit for **private key** storage methods.
- **SEC-005: Access Separation**
  - **Requirement:** System must implement **Role-Based Access Control (RBAC)** to ensure users can only access features appropriate to their role.
  - **Metric:** Access table defining permissions for each role (`borrower, lender, admin`).
- **SEC-006: HTTPS**
  - **Requirement:** All communication between client and server must be encrypted using **HTTPS** with **SSL/TLS**.
  - **Metric:** Presence of valid **SSL/TLS** certificate on **server**.
- **SEC-007: Two-Factor Authentication (2FA)**
  - **Requirement:** Time-based **2FA** (**TOTP**) must be mandatory for all **admins** and optional for regular users.
  - **Metric:** **TOTP** implementation that works with standard applications like **Google Authenticator**.

### 4.3 Availability
- **AVL-001: Server Uptime**
  - **Requirement:** System must have minimum **uptime** of 99.5% per month.
  - **Metric:** Percentage of time system is accessible and fully functional.
- **AVL-002: Redundancy**
  - **Requirement:** **Database** must have automatic **failover** to minimize downtime if failure occurs.
  - **Metric:** Time required for automatic **failover** (maximum 5 minutes).
- **AVL-003: Recovery**
  - **Requirement:** System must be able to recover from server failure within 30 minutes.
  - **Metric:** Average time to recovery (Mean Time to Recovery / MTTR).

### 4.4 Interface
- **INT-001: Mobile Application UI**
  - **Requirement:** User interface must be intuitive, responsive, and consistent across **mobile** application (iOS and Android).
  - **Metric:** User reviews and scores in **usability** testing.
- **INT-002: Admin Dashboard UI**
  - **Requirement:** Admin **dashboard** must provide clear visualization of important metrics, **KYC** queues, and loan status.
  - **Metric:** Admin speed in completing operational tasks.
- **INT-003: Notifications**
  - **Requirement:** System must send timely **notifications** via email or **push notification** for important events (**margin call, loan disbursement, etc**).
  - **Metric:** Average time from event to **notification** delivery.
- **INT-004: API Documentation**
  - **Requirement:** **API** must be well-documented using standards like **OpenAPI** (Swagger) to facilitate **frontend** development and future integrations.
  - **Metric:** Presence and completeness of **API** documentation.

### 4.5 Reliability
- **REL-001: Calculation Accuracy**
  - **Requirement:** All financial calculations (**LTV, interest, liquidation**) must be 100% accurate.
  - **Metric:** Automated test results against financial calculation scenarios.
- **REL-002: Data Integrity**
  - **Requirement:** System must ensure integrity of transaction and balance data.
  - **Metric:** Regular consistency checks between **database** and **blockchain** data.
- **REL-003: Logging and Audit**
  - **Requirement:** All important actions, including transactions, **admin logins**, and **parameter** changes, must be recorded with details for audit purposes.
  - **Metric:** Availability and completeness of logs.

### 4.6 Portability
- **PORT-001: Mobile Platform Support**
  - **Requirement:** **Mobile** application must run on **iOS 13+** and **Android 9.0+**.
  - **Metric:** Testing on devices with different **OS** versions.
- **PORT-002: Cloud Portability**
  - **Requirement:** System architecture must be deployable on other **cloud** providers (**GCP, Azure**) without major changes.
  - **Metric:** **Deployments** on various **cloud** providers during testing.

### 4.7 Maintenance
- **MAIN-001: Code Maintainability**
  - **Requirement:** Code must be clean, well-structured, and documented.
  - **Metric:** **Static analysis** scores and **code review** results.
- **MAIN-002: Centralized Configuration**
  - **Requirement:** Key **parameters** such as **LTV ratio** and fees must be configurable through **admin dashboard** without requiring re**deployment**.
  - **Metric:** Ability to update **parameters** from **admin dashboard** and see changes take effect immediately.

---

## 5. Business Requirements
### 5.1 General Business Requirements

#### 5.1.1 Interest Calculation Rules

- **BR-001: Interest Calculation at Matching**
  - **Description**: Interest is calculated when successful matching occurs between loan application and loan offer
  - **Basic Formula**: 
    ```
    Total Interest = Principal × Interest Rate (% per annum) × Term (months) / 12
    Total Payment = Principal + Total Interest
    ```
  - **Calculation Time**: When loan starts (matching confirmed)
  - **Calculation Example**:
    ```
    Loan Amount: 10,000 USDT
    Interest Rate: 12% per annum
    Term: 3 months
    
    Interest = 10,000 × 0.12 × 3/12 = 300 USDT
    Total Payment = 10,000 + 300 = 10,300 USDT
    ```

- **BR-002: Interest Payment**
  - **Description**: Interest is paid in full together with principal at repayment
  - **No Installments**: Platform does not support monthly installment payments
  - **Invoice Creation**: Payment invoice created 7 days before due date

#### 5.1.2 Platform Fee Rules

- **BR-003: Borrower Origination Fee Structure**
  - **Origination Fee**: 3% of loan principal
  - **Charging Method**: Added to total payment (not deducted from disbursement)
  - **Payment Time**: Paid together with loan repayment
  - **Configuration**: See CONF-001 for rate details
  
  - **3% Origination Fee Justification**:
    - **Cost Components**:
      - Gas fee coverage: ~0.5-1% (borne by platform)
      - Insurance fund allocation: 0.8%
      - Operational costs (monitoring, reconciliation, KYC): ~0.5%
      - Technology development costs: ~0.3%
      - Risk buffer & profit margin: ~0.4-0.9%
    - **Total Justified Rate**: 3% for platform sustainability
    - **Reason**: Provides sufficient margin to cover all operational, technology costs, and maintain adequate risk buffer
  
  - **Disbursement and Payment Formula**:
    ```
    Disbursement = Principal Loan (100% without deduction)
    Origination Fee = Principal × 3%
    Total Invoice = Principal + Interest + Origination Fee
    
    Example:
    Principal Loan: 10,000 USDT
    Interest (12% per annum, 3 months): 300 USDT
    Origination Fee (3%): 300 USDT
    
    Disbursement to Borrower: 10,000 USDT
    Total Payment: 10,000 + 300 + 300 = 10,600 USDT
    ```

- **BR-004: Lender Fee Structure**
  - **Fee from Interest Received**:
    - **Individual**: 15% of interest received
    - **Company/Institution**: 5% of interest received
  - **Charging Method**: Deducted from interest when distributed to lender
  - **Deduction Time**: When loan payment is received
  
  - **Lender Fee Justification**:
    
    **A. Individual (15% of interest)**
    - **Reason**: 
      - Individuals generally provide smaller loan amounts
      - Operational cost per transaction relatively higher
      - Need more intensive education and support
      - Rate still competitive compared to other platforms (20-30%)
    
    **B. Company/Institution (5% of interest)**
    - **Reason**:
      - Large transaction volume provides economies of scale
      - Lower operational cost per unit
      - Generally more independent in platform usage
      - Incentive to attract institutional funds
  
  - **Interest Distribution Formula**:
    ```
    Total Interest from Borrower = Principal × Interest Rate × Period
    
    For Individual Lender:
    Platform Fee = Total Interest × 15%
    Net Interest = Total Interest × 85%
    
    For Company Lender:
    Platform Fee = Total Interest × 5%
    Net Interest = Total Interest × 95%
    
    Individual Example:
    Total Interest: 300 USDT
    Platform Fee (15%): 45 USDT
    Lender Receives: 255 USDT
    
    Company Example:
    Total Interest: 300 USDT
    Platform Fee (5%): 15 USDT
    Lender Receives: 285 USDT
    ```

- **BR-005: Minimum Loan Amount**
  - **Purpose**: Ensure economic viability with network and operational costs
  - **Minimum Loan**: Varies by network and user type (see CONF-003)
  - **Minimum Withdrawal**: 100 USDT
  
  - **Minimum Loan Amount Justification**:
    
    **A. BSC/Solana Networks (Low Gas)**
    - **Individual: 500 USDT**
      - Origination fee collected: 15 USDT (3%)
      - Estimated gas cost: 2-5 USDT
      - Insurance fund: 4 USDT
      - Net margin: 6-9 USDT (1.2-1.8%)
      - **Reason**: Minimum viable amount to cover costs with adequate margin
    
    - **Company: 1,000 USDT**
      - Origination fee collected: 30 USDT (3%)
      - Estimated gas cost: 2-5 USDT
      - Insurance fund: 8 USDT
      - Net margin: 17-20 USDT (1.7-2%)
      - **Reason**: Minimum ensuring operational profitability
    
    **B. Ethereum Network (High Gas)**
    - **Individual: 3,000 USDT**
      - Origination fee collected: 90 USDT (3%)
      - Estimated gas cost: 10-20 USDT
      - Insurance fund: 24 USDT
      - Net margin: 46-56 USDT (1.53-1.87%)
      - **Reason**: Ethereum gas very high, minimum must be large enough
    
    - **Company: 6,000 USDT**
      - Origination fee collected: 180 USDT (3%)
      - Estimated gas cost: 10-20 USDT
      - Insurance fund: 48 USDT
      - Net margin: 112-122 USDT (1.87-2.03%)
      - **Reason**: Ensure profitability despite high gas costs

- **BR-006: Blockchain Network Fees**
  - **Description**: All gas/network fees borne by platform
  - **Coverage**: Includes deposits, withdrawals, disbursements, payments, liquidations
  - **User Experience**: Users don't need to worry about gas fees
  - **Justification**: Simplifies user experience, costs already factored into origination fee structure

- **BR-007: Crypto Tax (Tax)**
  - **Rate**: 0.1% of transaction value (according to Indonesian regulations)
  - **Bearer**: Borne by users (automatically deducted)
  - **Application**: Applies to liquidations and crypto to fiat trading

#### 5.1.3 Early Payment and Liquidation Rules

- **BR-008: Early Payment (Accelerated Repayment)**
  - **Description**: Borrower can repay earlier than due date
  - **Interest Calculation**: Still pay full interest (no deduction/pro-rata)
  - **Origination Fee**: Still 3% of principal (no deduction)
  - **Additional Early Payment Fee**: NONE
  - **Justification**: Full interest and origination provide adequate compensation
  - **Early Payment Simulation**:
    ```
    Loan Amount: 10,000 USDT
    Interest Rate: 12% per annum
    Original Term: 6 months
    Early Payment: Month 3
    
    Principal: 10,000 USDT
    Fixed Interest = 10,000 × 0.12 × 6/12 = 600 USDT
    Origination Fee = 10,000 × 0.03 = 300 USDT
    Total Payment = 10,000 + 600 + 300 = 10,900 USDT
    
    Note: Even if paid off in month 3, still pay full 6-month interest + full origination
    ```

- **BR-009: Early Liquidation**
  - **Description**: Borrower can request liquidation before maturity
  - **Early Liquidation Fee**: 1% of outstanding loan
  - **1% Fee Justification**:
    - Cover additional operational costs for unscheduled liquidation
    - Platform compensation for potential revenue loss
    - Discourage frequent early liquidation that disrupts liquidity planning
    - Still reasonable and not overly burdensome to borrowers
  - **Process**: 
    1. Liquidate collateral to USDT
    2. Pay outstanding loan + full interest + origination fee
    3. Deduct early liquidation fee
    4. Return surplus to borrower (in USDT)
  - **Simulation**:
    ```
    Outstanding Loan: 10,000 USDT
    Interest (6 months): 600 USDT
    Origination Fee: 300 USDT
    Early Liquidation Fee (1%): 109 USDT (1% of 10,900)
    
    Total Deductions: 11,009 USDT
    
    If liquidation proceeds 12,000 USDT:
    Surplus to borrower: 991 USDT
    ```

- **BR-010: Forced Liquidation**
  - **Trigger**: LTV ratio reaches maximum threshold or payment default
  - **Liquidation Fee**: 2% of liquidated amount
  - **2% Fee Justification**:
    - Higher fee because forced liquidation has urgency and market risk
    - Cover potential spread in quick liquidation
    - Platform compensation for emergency handling and monitoring
    - Provides incentive for borrowers to maintain healthy LTV
  - **Payment Priority**:
    1. Pay principal + interest + origination fee to lender (in USDT)
    2. Platform liquidation fee
    3. Return surplus to borrower (in USDT if any)
  - **Deficit Handling**: Platform absorbs losses

#### 5.1.4 Payment Rules

- **BR-011: Overpayment Handling**
  - **Description**: Payment exceeding invoice amount
  - **Treatment**: Excess goes to user balance (in USDT)
  - **Usage**: Can be used for next transactions or withdrawal

- **BR-012: Underpayment Handling**
  - **Description**: Payment less than invoice amount
  - **Treatment**: Funds accumulate in invoice until sufficient
  - **Status**: Invoice remains unpaid until paid in full

- **BR-013: Payment Window**
  - **Invoice Creation**: 7 days before due date
  - **Payment Deadline**: Due date (no grace period)
  - **Late Payment**: Triggers automatic liquidation
  - **No Grace Period Justification**: Protects lender interests and maintains platform credibility

#### 5.1.5 LTV (Loan-to-Value) Rules

- **BR-014: LTV Calculation**
  - **Formula**: 
    ```
    LTV = (Outstanding USDT Loan / Collateral Value in USDT) × 100%
    ```
  - **Configuration**: See CONF-002 for thresholds
  - **Monitoring Frequency**: Every 5 minutes
  - **5-minute Monitoring Justification**: Balance between real-time risk management and resource consumption

- **BR-015: LTV Threshold Actions Per Collateral Currency**
  
  **BTC as Collateral:**
  - **Warning Level (48%)**: Send notification
    - **Justification**: 80% of max LTV (60% × 0.8), provides early warning
  - **Critical Level (57%)**: Liquidation preparation
    - **Justification**: 95% of max LTV (60% × 0.95), last chance for action
  - **Liquidation Level (60%)**: Execute liquidation
    - **Justification**: BTC lower volatility, tighter LTV for security
  
  **ETH as Collateral:**
  - **Warning Level (56%)**: Send notification
    - **Justification**: 80% of max LTV (70% × 0.8)
  - **Critical Level (66.5%)**: Liquidation preparation
    - **Justification**: 95% of max LTV (70% × 0.95)
  - **Liquidation Level (70%)**: Execute liquidation
    - **Justification**: Industry standard for crypto-backed loans
  
  **BNB as Collateral:**
  - **Warning Level (40%)**: Send notification
    - **Justification**: 80% of max LTV (50% × 0.8)
  - **Critical Level (47.5%)**: Liquidation preparation
    - **Justification**: 95% of max LTV (50% × 0.95)
  - **Liquidation Level (50%)**: Execute liquidation
    - **Justification**: BNB high volatility, more conservative LTV
  
  **SOL as Collateral:**
  - **Warning Level (40%)**: Send notification
    - **Justification**: 80% of max LTV (50% × 0.8)
  - **Critical Level (47.5%)**: Liquidation preparation
    - **Justification**: 95% of max LTV (50% × 0.95)
  - **Liquidation Level (50%)**: Execute liquidation
    - **Justification**: SOL high volatility, more conservative LTV

- **BR-016: Initial Collateral Calculation**
  - **Safety Buffer**: Recommended additional 20%
  - **20% Buffer Justification**: Cover potential crypto price volatility, reduce liquidation probability
  - **Formula Per Collateral Currency**:
    ```
    Required Collateral = (USDT Loan / Max LTV) × Safety Factor
    
    Example with ETH as collateral:
    Loan: 10,000 USDT
    ETH Price: 2,000 USDT
    Max LTV: 70%
    Safety Factor: 1.2 (20% buffer)
    
    Base Collateral Value = 10,000 / 0.7 = 14,286 USDT
    With Buffer = 14,286 × 1.2 = 17,143 USDT
    ETH Required = 17,143 / 2,000 = 8.57 ETH
    
    Example with BTC as collateral:
    Loan: 10,000 USDT
    BTC Price: 40,000 USDT
    Max LTV: 60%
    Safety Factor: 1.2
    
    Base Collateral Value = 10,000 / 0.6 = 16,667 USDT
    With Buffer = 16,667 × 1.2 = 20,000 USDT
    BTC Required = 20,000 / 40,000 = 0.5 BTC
    ```

#### 5.1.6 Interest Rate Determination Rules

- **BR-017: P2P Interest Rate Determination Mechanism**
  - **Model**: Interest rates determined through negotiation between Borrower and Lender
  - **Basic Principles**:
    - **Borrower**: Sets MAXIMUM interest rate willing to pay
    - **Lender**: Sets MINIMUM interest rate desired
    - **Platform**: Facilitates matching and provides rate guidance
  
  - **Determination Process**:
    ```
    1. Borrower posts: "I'm willing to pay maximum 15% p.a."
    2. Lender posts: "I want minimum 12% p.a."
    3. System matching: Deal occurs at 12-15% (usually midpoint)
    4. Final rate: Agreement or automatically take lender rate (more favorable to borrower)
    ```
  
  - **Platform Suggested Rate**:
    ```
    Platform provides "Suggested Rate" based on:
    - Last 30-day market average
    - Risk assessment (LTV, collateral, tenor)
    - Current supply-demand
    
    Users free to follow or deviate from suggested rate
    ```

- **BR-018: Interest Rate Limits Table (According to OJK Regulations)**
  
  | **Category** | **LTV** | **Collateral** | **Min Rate** | **Suggested** | **Max Rate** | **Justification** |
  |--------------|---------|-------------|--------------|---------------|--------------|-----------------|
  | **VERY SAFE** | <30% | BTC/ETH | 6% p.a. | 8% p.a. | 10% p.a. | Minimal risk, very strong collateral |
  | **SAFE** | 30-50% | BTC/ETH | 8% p.a. | 10% p.a. | 12% p.a. | Low risk, DeFi standard |
  | **SAFE** | 30-50% | BNB/SOL | 9% p.a. | 11% p.a. | 13% p.a. | Low risk, medium volatility |
  | **MODERATE** | 50-60% | BTC/ETH | 10% p.a. | 12% p.a. | 14% p.a. | Medium risk, needs monitoring |
  | **MODERATE** | 50-60% | BNB/SOL | 11% p.a. | 13% p.a. | 16% p.a. | Medium-high risk |
  | **RISKY** | 60-70% | BTC/ETH | 12% p.a. | 14% p.a. | 18% p.a. | High risk, strict monitoring |
  | **RISKY** | 60-70% | BNB/SOL | 13% p.a. | 16% p.a. | 20% p.a. | High risk, high volatility |
  | **VERY RISKY** | >70% | All | 15% p.a. | 18% p.a. | 24% p.a. | Very high risk, near liquidation |
  
  **Regulatory Notes:**
  - Absolute maximum: 24% p.a. (OJK recommendation for P2P Lending)
  - Must not exceed: 0.8% per day (POJK 77/2016)
  - Platform reserves right to reject rates outside range to protect ecosystem

#### 5.1.7 Matching Rules

- **BR-019: Automatic Matching Criteria**
  - **Matching Requirements**:
    - Loan currency must be USDT
    - Lender rate ≤ Borrower maximum rate
    - Loan amount within lender min/max range
    - LTV still within safe limits
  
  - **Matching Priority**:
    ```
    1. Best Rate Match: Lender with lowest rate prioritized
    2. Amount Match: Lender who can fulfill full amount
    3. Time Priority: First-come-first-served if same rate
    ```
  
  - **Matching Example**:
    ```
    Borrower Request:
    - Need: 10,000 USDT
    - Max Rate: 14% p.a.
    - Collateral: 5 ETH
    
    Available Lenders:
    - Lender A: 5,000 USDT @ 11% p.a.
    - Lender B: 8,000 USDT @ 12% p.a.
    - Lender C: 10,000 USDT @ 13% p.a.
    - Lender D: 3,000 USDT @ 15% p.a. (NO MATCH - rate too high)
    
    System Action:
    - Priority to Lender C (full amount, best rate)
    - Alternative: Combine A+B if partial allowed
    ```

- **BR-020: Rate Negotiation Mechanism**
  - **Auto-Negotiation**: System automatically takes midpoint rate if overlap exists
    ```
    Borrower max: 15%
    Lender min: 12%
    Auto-settle: 13.5% (midpoint)
    ```
  
  - **Manual Negotiation**: Users can counter-offer within reasonable limits
    ```
    Max 3 counter-offers
    Timeout: 24 hours
    Fallback: Return to market
    ```
  
  - **Instant Match**: If borrower accepts exact lender rate
    ```
    Lender ask: 12%
    Borrower accept: 12%
    Instant execution
    ```

- **BR-021: Rate Display Transparency**
  - **Market Dashboard**:
    ```
    ╔══════════════════════════════════════════╗
    ║         CURRENT MARKET RATES             ║
    ╠══════════════════════════════════════════╣
    ║ Average Rate (30d):    12.5% p.a.        ║
    ║ Average Rate (7d):     13.1% p.a.        ║
    ║ Average Rate (24h):    13.8% p.a.        ║
    ║                                          ║
    ║ BY COLLATERAL TYPE:                      ║
    ║ BTC-backed avg:        11.2% p.a.        ║
    ║ ETH-backed avg:        12.5% p.a.        ║
    ║ BNB-backed avg:        14.1% p.a.        ║
    ║ SOL-backed avg:        15.3% p.a.        ║
    ║                                          ║
    ║ ACTIVE ORDERS:                           ║
    ║ Best Lender Rate:      10.5% p.a.        ║
    ║ Best Borrower Offer:   14.0% p.a.        ║
    ║ Spread:                3.5%              ║
    ╚══════════════════════════════════════════╝
    ```

- **BR-022: Post-Matching Processing**
  - **Application**: Auto-publish after collateral confirmed
  - **Offer**: Auto-publish after USDT payment confirmed
  - **Matching**: Automatic whenever new application/offer available
  - **Notification**: Both parties notified immediately with final rate
  - **Lock Period**: Rate locked after deal, cannot be changed

#### 5.1.8 Institution Rules

- **BR-023: Institution Limitations**
  - **Role**: Institutions can only be Lenders
  - **Restriction**: Cannot be Borrowers
  - **Minimum Amount**: Follows company rules
  - **Fee**: 5% of interest received (same as company)
  - **Justification**: Institutions have capital for lending, borrowing more complex legally/compliance-wise

- **BR-024: Institution Member Management**
  - **Roles**: Owner, Admin, Member
  - **Invitation**: Requires email verification
  - **Permissions**: Configurable per role

### 5.2 Financial Controls

#### 5.2.1 Balance Reconciliation

- **FC-001: Blockchain-Database Reconciliation**
  - **Description**: Matching on-chain balances with database records
  - **Check Frequency**:
    - Active accounts: Every 1 hour
    - Inactive accounts: Every 24 hours
    - High-value accounts (>10,000 USDT): Every 30 minutes
  - **Frequency Justification**:
    - Active accounts need frequent monitoring for quick discrepancy detection
    - High-value accounts have high risk exposure, need tighter monitoring
    - Inactive accounts low risk, daily checks sufficient for resource efficiency
  - **Reconciliation Process**:
    ```
    1. Get on-chain balance for each wallet address
    2. Calculate database balance from sum(account_mutations)
    3. Compare both values
    4. Flag if difference > 0.01%
    ```
  - **Discrepancy Handling**:
    - Minor (<0.01%): Auto-correct with adjustment entry
    - Major (>0.01%): Flag for manual investigation
    - Critical (>1%): Suspend account, immediate alert
  - **Threshold Justification**: 0.01% tolerance for rounding errors, >1% indicates serious issue

- **FC-002: Daily Balance Report**
  - **Creation Time**: 00:00 WIB daily
  - **Components**:
    ```
    Platform Holdings Report:
    - Total BTC: On-chain vs Database (collateral)
    - Total ETH: On-chain vs Database (collateral)
    - Total BNB: On-chain vs Database (collateral)
    - Total SOL: On-chain vs Database (collateral)
    - Total USDT: On-chain vs Database (loans)
    
    User Balance Summary:
    - Total collateral deposits per currency
    - Total USDT locked in loans
    - Total pending USDT withdrawals
    - Available platform USDT reserves
    
    Revenue Summary:
    - Total origination fees collected
    - Total interest fees from individuals (15%)
    - Total interest fees from companies (5%)
    ```
  - **Distribution**: Auto-email to finance team & management

- **FC-003: Real-time Balance Monitoring**
  - **Hot Wallet Threshold**: Maximum 10% of total holdings
  - **10% Justification**: Balance between operational liquidity and security risk
  - **Alert Triggers**:
    - Hot wallet > 8%: Warning
    - Hot wallet > 10%: Auto-rebalance to cold wallet
    - Any wallet < expected: Immediate investigation

#### 5.2.2 Transaction Reconciliation

- **FC-004: Invoice Payment Reconciliation**
  - **Process**:
    ```
    1. Detect USDT blockchain payment to invoice address
    2. Wait for required confirmations
    3. Update invoice amount_paid (principal + interest + origination)
    4. Distribute interest to lender (after fee deduction)
    5. Allocate origination fee to platform account
    6. Create account_mutation records
    7. Verify mutation balance = blockchain transaction
    ```
  - **Mismatch Handling**: Queue for manual review

- **FC-005: Withdrawal Reconciliation**
  - **Pre-withdrawal Check**: Verify sufficient USDT balance
  - **Post-withdrawal Verification**:
    - Confirm transaction on blockchain
    - Verify amount sent = amount requested
    - Update withdrawal status
    - Reconcile user balance

#### 5.2.3 Audit Trail

- **FC-006: Comprehensive Transaction Recording**
  - **Required Fields**:
    ```
    - Transaction ID (UUID)
    - Timestamp (with timezone)
    - User ID
    - Transaction Type
    - Currency (USDT/BTC/ETH/BNB/SOL)
    - Amount
    - Balance Before
    - Balance After
    - Related Entity (loan_id, withdrawal_id, etc)
    - Blockchain TX Hash (if applicable)
    - Associated Fees (origination, interest fees, etc)
    ```
  - **Retention**: Minimum 7 years
  - **Justification**: Compliance with Indonesian financial regulations
  - **Immutability**: Logs cannot be modified or deleted

- **FC-007: Admin Action Audit**
  - **Recorded Actions**:
    - KYC approval/rejection
    - Manual liquidation
    - Account suspension/activation
    - Fee adjustments
    - Manual balance corrections
  - **Required Information**:
    - Admin ID
    - Action type
    - Affected user
    - Reason/justification
    - Supporting documents

#### 5.2.4 Reserve Management

- **FC-008: Platform Reserve Requirements**
  - **Minimum Reserve Ratio**: 110% of total user USDT deposits
  - **110% Justification**: Provides 10% buffer to handle market volatility and withdrawal spikes
  - **Calculation**:
    ```
    Required USDT Reserve = Total User USDT Deposits × 1.1
    Available USDT Reserve = Platform USDT Holdings - Locked in Loans
    Reserve Health = Available Reserve / Required Reserve
    ```
  - **Monitoring**: Real-time dashboard
  - **Actions**:
    - Reserve < 115%: Warning
    - Reserve < 110%: Suspend new loan disbursements
    - Reserve < 105%: Emergency mode, suspend all operations

- **FC-009: Segregated Fund Management**
  - **User Funds**: Separate wallets from operational funds
  - **Fee Collection**: Dedicated fee collection addresses
  - **Insurance Fund**: 0.8% of origination fees for risk buffer
  - **0.8% Insurance Justification**: Historical default rate analysis + 2x safety factor
  - **Quarterly Audit**: External audit for segregation verification

#### 5.2.5 Risk Management

- **FC-010: Exposure Limits**
  - **Per-User Limit**: Maximum 5% of total platform USDT funds
    - **Justification**: Prevent concentration risk from single user default
  - **Per-Loan Limit**: Maximum 2% of total platform USDT funds
    - **Justification**: Limit impact from single loan failure
  - **Collateral Concentration**: Maximum 40% in one collateral type
    - **Justification**: Diversification to reduce currency-specific risk
  - **Monitoring**: Real-time risk dashboard

- **FC-011: Liquidation Risk Buffer**
  - **Reserve Fund**: Maintain 5% of total USDT loans as buffer
  - **5% Justification**: Based on stress testing with 30% price drop scenarios
  - **Usage**: Cover deficits from failed liquidations
  - **Replenishment**: From platform fee collection

### 5.3. System Configuration

- **CONF-001: Platform Fee Configuration**
  | Parameter | Default | Min | Max | Configurable By | Storage | Notes | Justification |
  |-----------|---------|-----|------|-------------------------|-------------|---------|-------------|
  | Borrower Origination Fee | 3% | 2% | 5% | Admin | DB | Added to invoice | Cover gas + insurance + ops + margin |
  | Individual Interest Fee | 15% | 10% | 25% | Admin | DB | Deducted from interest | Higher ops cost for small volume |
  | Company Interest Fee | 5% | 3% | 10% | Admin | DB | Deducted from interest | Economies of scale for large volume |
  | Liquidation Fee | 2% | 1% | 5% | Admin | DB | From liquidated USDT amount | Higher for emergency handling + spread risk |
  | Early Liquidation Fee | 1% | 0.5% | 5% | Admin | DB | From outstanding USDT loan | Discourage frequent early liquidation |
  | Withdrawal Fee | 0% | 0% | 2% | Admin | DB | Optional, default no fee | User-friendly, cost absorbed in origination |

- **CONF-002: LTV Configuration Per Collateral Currency**
  | Parameter | Default | Min | Max | Configurable By | Storage | Notes | Justification |
  |-----------|---------|-----|------|-------------------------|-------------|---------|-------------|
  | **BTC as Collateral** |
  | Max LTV | 60% | 50% | 70% | Admin | DB | Bitcoin | Lower volatility but still conservative |
  | Warning Threshold | 48% | - | - | Calculated | - | 80% of max | Early warning to prevent liquidation |
  | Critical Threshold | 57% | - | - | Calculated | - | 95% of max | Last chance before liquidation |
  | Liquidation Threshold | 60% | - | - | Same as Max | - | Auto liquidation trigger | Protect lenders from further losses |
  | **ETH as Collateral** |
  | Max LTV | 70% | 50% | 80% | Admin | DB | Ethereum | Industry standard for crypto loans |
  | Warning Threshold | 56% | - | - | Calculated | - | 80% of max | Early warning |
  | Critical Threshold | 66.5% | - | - | Calculated | - | 95% of max | Last chance |
  | Liquidation Threshold | 70% | - | - | Same as Max | - | Liquidation trigger | Protect lenders |
  | **BNB as Collateral** |
  | Max LTV | 50% | 40% | 60% | Admin | DB | Binance Coin | High volatility, more conservative |
  | Warning Threshold | 40% | - | - | Calculated | - | 80% of max | Early warning |
  | Critical Threshold | 47.5% | - | - | Calculated | - | 95% of max | Last chance |
  | Liquidation Threshold | 50% | - | - | Same as Max | - | Liquidation trigger | Protect lenders |
  | **SOL as Collateral** |
  | Max LTV | 50% | 40% | 60% | Admin | DB | Solana | High volatility, more conservative |
  | Warning Threshold | 40% | - | - | Calculated | - | 80% of max | Early warning |
  | Critical Threshold | 47.5% | - | - | Calculated | - | 95% of max | Last chance |
  | Liquidation Threshold | 50% | - | - | Same as Max | - | Liquidation trigger | Protect lenders |
  | LTV Monitoring Interval | 5 minutes | 1 minute | 15 minutes | Env Var | Config | LTV check frequency | Balance real-time monitoring vs resource usage |

- **CONF-003: Minimum Amount Configuration (in USDT)**
  | Parameter | Default | Min | Max | Configurable By | Storage | Notes | Justification |
  |-----------|---------|-----|------|-------------------------|-------------|---------|-------------|
  | **Minimum Loan (BSC/SOL)** |
  | - Individual | 500 USDT | 500 USDT | - | Admin | DB | Low gas networks | Viable minimum with 3% origination = 15 USDT |
  | - Company | 1,000 USDT | 1,000 USDT | - | Admin | DB | Low gas networks | Viable minimum with 3% origination = 30 USDT |
  | **Minimum Loan (Ethereum)** |
  | - Individual | 3,000 USDT | 3,000 USDT | - | Admin | DB | High gas network | 3% origination = 90 USDT, covers high gas |
  | - Company | 6,000 USDT | 6,000 USDT | - | Admin | DB | High gas network | 3% origination = 180 USDT for profitability |
  | **Minimum Withdrawal** |
  | - USDT | 100 USDT | 100 USDT | - | Admin | DB | Stablecoin | Standard minimum for withdrawal |

- **CONF-004: Blockchain Configuration**
  | Parameter | Default | Min | Max | Configurable By | Storage | Notes | Justification |
  |-----------|---------|-----|------|-------------------------|-------------|---------|-------------|
  | BTC Block Confirmations | 3 | 1 | 6 | Env Var | Config | ~30 minutes | Balance security vs speed |
  | ETH Block Confirmations | 12 | 6 | 20 | Env Var | Config | ~3 minutes | Standard for medium values |
  | BSC Block Confirmations | 12 | 6 | 20 | Env Var | Config | ~1 minute | Fast finality |
  | SOL Block Confirmations | 32 | 16 | 64 | Env Var | Config | ~20 seconds | Solana consensus model |
  | Gas Price Multiplier | 1.2x | 1.1x | 2x | Env Var | Config | For faster confirmation | 20% premium for priority |

- **CONF-005: Time Configuration**
  | Parameter | Default | Min | Max | Configurable By | Storage | Notes | Justification |
  |-----------|---------|-----|------|-------------------------|-------------|---------|-------------|
  | Invoice Creation Time | 09:00 WIB | - | - | Env Var | Config | Daily cron job | Business hours for notifications |
  | Days Before Due Date for Invoice | 7 days | 3 days | 14 days | Admin | DB | Before maturity | Adequate time for payment preparation |
  | Payment Grace Period | 0 days | 0 days | 3 days | Admin | DB | After due date | No grace to protect lenders |
  | Price Feed Update Interval | 30 seconds | 10 seconds | 60 seconds | Env Var | Config | API polling rate | Balance accuracy vs API limits |
  | Price Staleness Threshold | 15 minutes | 5 minutes | 30 minutes | Env Var | Config | Max age for prices | Prevent using stale prices |
  | Withdrawal Processing | 5 minutes | 2 minutes | 15 minutes | Env Var | Config | Check interval | Balance speed vs efficiency |

- **CONF-006: Limit Configuration**
  | Parameter | Default | Min | Max | Configurable By | Storage | Notes | Justification |
  |-----------|---------|-----|------|-------------------------|-------------|---------|-------------|
  | Max Active Loans (Borrower) | 5 | 1 | 10 | Admin | DB | Per user | Prevent excessive leverage |
  | Max Active Offers (Lender) | 10 | 5 | 50 | Admin | DB | Per user | Allow diversification |
  | Max Daily USDT Withdrawal | 100,000 USDT | - | - | Admin | DB | Per user | Anti-money laundering |
  | Max Single USDT Transaction | 50,000 USDT | - | - | Admin | DB | Per transaction | Risk management |

- **CONF-007: Circuit Breaker Configuration**
  | Parameter | Default | Min | Max | Configurable By | Storage | Notes | Justification |
  |-----------|---------|-----|------|-------------------------|-------------|---------|-------------|
  | Price Drop Warning | 10% / hour | 5% | 15% | Admin | DB | Pause new loans | Early market volatility detection |
  | Critical Price Drop | 20% / hour | 15% | 25% | Admin | DB | Trigger margin calls | Protect existing positions |
  | Emergency Price Drop | 30% / hour | 25% | 40% | Admin | DB | Force liquidation | Prevent catastrophic losses |
  | Stability Period | 1 hour | 30 minutes | 2 hours | Admin | DB | Before resumption | Ensure market stabilization |
  | Max Liquidation Spread | 2% | 1% | 5% | Admin | DB | For liquidation | Acceptable loss in execution |

---
## 6. Approval

| Role                  | Name | Signature | Date |
|-----------------------|------|-----------|------|
| Client Representative |      |           |      |
| Project Manager       |      |           |      |
| Technical Lead        |      |           |      |