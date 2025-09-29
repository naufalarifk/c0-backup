# Software Requirements Specification (SRS) - Crypto Gadai Platform

## Document Control
- **Document ID:** SRS-CG-v2.4
- **Document Version:** 2.4
- **Author:** Project Manager
- **Reviewer:** Technical Lead
- **Approver:** Nusatech Development Management

---

## 1. Introduction

### 1.1 Purpose

This document serves as the Software Requirements Specification (SRS) for the Crypto Gadai platform, a peer-to-peer lending platform that connects borrowers and lenders with cryptocurrency collateral. The platform addresses the problem of lost momentum for investors who need liquidity, creates healthy interest rate competition, and stabilizes the market through financial institution participation.

**Target Users:**
- **Borrowers**: Cryptocurrency asset holders who need liquidity without selling assets
- **Individual Lenders**: Individuals seeking passive income with guaranteed risk coverage
- **Financial Institutions**: Institutions serving as market stabilizers with large capital

**Platform Advantages:**
- **100% Guarantee Model**: Platform guarantees full repayment for lenders
- **Order Book System**: Creates natural competition for optimal interest rates
- **Market Stabilization**: Financial institutions serve as supply-demand balancers

This document encompasses general description, project scope, specific requirements, project constraints, functional requirements, and non-functional requirements. **Primary Stakeholders:**
- Product Owner
- End Users
- Company Leadership
- Project Manager
- Technical Lead
- Development Team (UI/UX Designer, Frontend, Backend, DevOps, QA)

### 1.2 Product Scope

#### 1.2.1 Included in Scope:

- **Mobile-based** platform for pledging crypto assets as loan collateral
- **Web-based admin dashboard** for user management, loans, and platform performance
- **Multi-channel notification** system (email, SMS/WhatsApp, push notifications)
- **Binance integration** for automatic liquidation and price feeds
- **Order book system** for matching borrowers and lenders
- **Custodial model** with hot/cold wallet management

**Supported Cryptocurrency Assets (Collateral):**
- **Bitcoin (BTC)** - Network: Bitcoin
- **Ethereum (ETH)** - Network: Ethereum
- **BNB** - Network: BSC (Binance Smart Chain)
- **Solana (SOL)** - Network: Solana

**Loan Currencies:**
- **USDT** on networks:
  - USDT-ETH: ERC-20
  - USDT-BSC: BEP-20
  - USDT-TRC: TRC-20

#### 1.2.2 Not Included in Scope:

- Trading or buying/selling of crypto assets
- Installment or partial payment systems
- Loan term extensions
- Adding collateral after loan activation
- Investment advisory or portfolio management
- Institutions as borrowers (can only serve as lenders)
- Smart contract automation (using traditional custodial model)
- KYC for foreign users

#### 1.2.3 System Constraints

- **Blockchain Integration:**
  - Bitcoin, Ethereum, BSC, Solana Mainnet
  - Does not support testnet or private blockchains
- **Exchange Integration:**
  - Binance as primary liquidity provider
  - DEX as backup if Binance API is down
- **Data Management:**
  - PostgreSQL 17 for transactional records
  - Minio/S3 for document storage
  - Does not store user private keys or seed phrases
- **Security Boundaries:**
  - Rate limiting and DDoS protection
  - Platform custodial (platform manages private keys)

#### 1.2.4 Operating Environment

- **Platform**: Mobile (iOS 13+, Android 9.0+), Web (Admin Dashboard)
- **Browser**: Chrome, Firefox, Safari, Edge (latest versions)
- **Blockchain Network**: Bitcoin, Ethereum, BSC, Solana
- **Deployment**: Cloud infrastructure (AWS/GCP/Azure)
- **Operating System**: Ubuntu 24.04 LTS (Server)

### 1.3 Definitions, Acronyms, and Abbreviations

#### 1.3.1 Platform Business Terms

| Term | Definition | Notes |
|------|------------|-------|
| **LTV (Loan to Value)** | Ratio of loan value to collateral value | Fixed at 70% for over-collateralization |
| **Liquidation** | Automatic sale of collateral when threshold is reached | Platform bears deficit |
| **Risk Premium** | 2% buffer from loan for liquidation threshold | Not platform revenue |
| **Platform Provision** | 3% fee from loan principal | Paid upfront by borrower |
| **Order Book** | Order matching system for borrowers and lenders | P2P model with market pricing |
| **Pre-positioning** | Daily transfer of 50% collateral to Binance | For instant liquidation |
| **Pending Order** | Suspended sell order on Binance | Placed when risk premium is reached |
| **Settlement** | Daily process at 00:00 WIB | Manual transfer to Binance |
| **Platform Guarantee** | 100% repayment guarantee for lenders | Platform covers deficit |
| **Grace Period** | No grace period | Immediate liquidation upon maturity |

#### 1.3.2 Specific Technical Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Hot Wallet** | Platform operational wallet | For daily transactions |
| **Cold Wallet** | Long-term storage wallet | Maximum security |
| **Price Feed** | Real-time price source | Binance API as primary |
| **Circuit Breaker** | Automatic stop mechanism | When volatility >10% |
| **Staleness** | Outdated price data | Requires price feed refresh |

### 1.4 References

- Bank Indonesia Regulations on Financial Technology
- OJK Regulations on Information Technology-Based Money Lending Services
- Binance API Documentation
- CoinGecko API Documentation (backup price feed)
- SendGrid API Documentation

### 1.5 Document Overview

This SRS document consists of:
- **Chapter 1: Introduction** - Document context and purpose
- **Chapter 2: General Description** - Scope and stakeholders
- **Chapter 3: Specific Requirements** - Detailed functional requirements
- **Chapter 4: Non-Functional Requirements** - Performance, security, reliability
- **Chapter 5: Business Requirements** - Business rules and configuration
- **Chapter 6: Risk Management & Liquidation** - Platform guarantee model
- **Chapter 7: Approval** - Approval signatures

**Numbering Conversion:**
- Product Functions: FUNC-xxx
- Functional Requirements: RF-xxx
- Performance Requirements: PERF-xxx
- Security Requirements: SEC-xxx
- Business Requirements: BR-xxx
- Financial Controls: FC-xxx
- System Configuration: CONF-xxx
- Risk Management: RISK-xxx

---

## 2. General Description

### 2.1 Project Perspective

The crypto lending platform is a peer-to-peer lending system with a custodial model that guarantees 100% repayment for lenders. The platform uses monolithic architecture with Binance integration for automatic liquidation.

**System Components:**
- **Mobile Application**: React Native for users (borrowers and lenders)
- **Backend API Server**: Node.js with NestJS for business logic
- **Admin Dashboard**: Angular for operational management
- **Database**: PostgreSQL for transactional data
- **Blockchain Integration**: Direct RPC for Bitcoin, Ethereum, BSC, Solana
- **Exchange Integration**: Binance API for liquidation and price feeds

**Operational Model:**
- **Custodial**: Platform manages all private keys
- **Order Book**: Borrower-lender matching system
- **Daily Settlement**: Manual transfer of 50% assets to Binance at 00:00 WIB
- **Platform Guarantee**: Platform bears all liquidation risks

### 2.2 Product Functions

- **FUNC-001: Order Book System**
  - **Description:** Order matching system for borrowers and lenders with interest rate competition
  - **Priority:** Critical

- **FUNC-002: Platform Guarantee System**
  - **Description:** 100% repayment guarantee mechanism for lenders
  - **Priority:** Critical

- **FUNC-003: Automated Liquidation**
  - **Description:** Automatic liquidation through Binance with pending orders
  - **Priority:** Critical

- **FUNC-004: Daily Settlement Process**
  - **Description:** Manual process to transfer 50% assets to Binance daily at 00:00 WIB
  - **Priority:** Critical

- **FUNC-005: Dual Warning System**
  - **Description:** Price and time-based warning system for borrowers
  - **Priority:** High

- **FUNC-006: Balance Management**
  - **Description:** Internal balance system for asset reuse without blockchain transfers
  - **Priority:** High

- **FUNC-007: KYC Verification**
  - **Description:** Identity verification for individuals and companies
  - **Priority:** Critical

- **FUNC-008: Multi-Asset Collateral**
  - **Description:** Support for BTC, ETH, BNB, SOL as collateral
  - **Priority:** Critical

- **FUNC-009: USDT Multi-Network**
  - **Description:** USDT support on ERC-20, BEP-20, TRC-20
  - **Priority:** High

- **FUNC-010: Institution Management**
  - **Description:** Financial institution management as special lenders
  - **Priority:** Medium

### 2.3 User Characteristics

#### 2.3.1 Borrowers (Individual Users Only)

- **Profile**: Crypto holders needing quick liquidity without selling assets
- **Characteristics:**
  - Own cryptocurrency (BTC/ETH/BNB/SOL)
  - Understand HODL concept and investment momentum
  - Willing to pay interest to retain assets
- **Needs:**
  - Quick access to USDT without selling crypto
  - Transparent fees and interest
  - Flexible repayment options (cash/asset sale)
  - Early warnings to avoid liquidation

#### 2.3.2 Individual Lenders

- **Profile**: Individual investors seeking risk-free passive income
- **Characteristics:**
  - Own idle USDT
  - Risk-averse (avoid risk)
  - Seek predictable returns
- **Needs:**
  - 100% repayment guarantee from platform
  - Competitive interest through order book
  - Transparency and security
  - Easy reinvestment

#### 2.3.3 Financial Institutions (Lenders Only)

- **Profile**: Institutions with large capital serving as market stabilizers
- **Characteristics:**
  - Large volume funding
  - Professional risk management
  - Focus on stable returns
- **Needs:**
  - Preferential fees (2.5% vs 10% for individuals)
  - Priority in order book
  - Reporting and compliance
  - Platform guarantee for all loans

#### 2.3.4 Platform Admin

- **Profile**: Operational staff managing daily operations
- **Characteristics:**
  - Financial/fintech background
  - Understand crypto and risk management
  - Responsible for daily settlement
- **Needs:**
  - Real-time monitoring dashboard
  - Manual settlement tools
  - Automatic alert systems
  - Complete audit trail

### 2.4 Constraints

#### 2.4.1 Operational Constraints

- **No Smart Contracts**: Using traditional custodial model
- **Manual Settlement**: Transfer to Binance done manually daily
- **Fixed LTV**: 70% LTV ratio cannot be changed
- **No Extensions**: No loan extensions or restructuring
- **No Partial Payments**: Payment must be made in full
- **Institution Restrictions**: Institutions can only lend

#### 2.4.2 Financial Constraints

- **Minimum Loan**: 50 USDT
- **Maximum Loan**: 20,000 USDT total per user
- **Minimum Withdrawal**: 20 USDT equivalent
- **Platform Risk**: Platform bears all liquidation risks
- **Fixed Interest**: Interest locked when contract is created

### 2.5 Assumptions and Dependencies

#### 2.5.1 Assumptions

- Binance API will maintain >99% uptime
- Crypto prices will not crash >50% within 1 hour
- Users understand crypto volatility risks
- Platform has reserve funds to cover liquidation deficits
- Manual settlement can be performed on time daily

#### 2.5.2 Dependencies

- **Binance Exchange**: Primary liquidity and execution venue
- **Blockchain Networks**: Bitcoin, Ethereum, BSC, Solana stability
- **Price Feed**: Binance API (primary), CoinGecko (backup)
- **Banking**: Fiat gateway for operations
- **Manual Process**: Admin availability for daily settlement

---

## 3. Functional Requirements

### 3.1 Order Book Management

**RF-001: Create Borrowing Order**
- **Priority**: Critical
- **Description**: Borrower creates loan order in order book
- **Input**: Loan amount, maximum interest rate, duration, collateral type
- **Processing**:
  1. Calculate required collateral (70% LTV)
  2. Add 3% provision to total debt
  3. Generate invoice for collateral
  4. After collateral received, publish to order book
  5. Wait for matching with lender
- **Output**: Active order in order book
- **Actor**: Borrower (Individual User)

**RF-002: Create Lending Order**
- **Priority**: Critical
- **Description**: Lender creates offer in order book
- **Input**: Fund amount, minimum interest rate, maximum duration
- **Processing**:
  1. Generate invoice for USDT deposit
  2. After USDT received, publish to order book
  3. Special label for financial institutions
  4. Wait for matching with borrower
- **Output**: Active offer in order book
- **Actor**: Lender (Individual & Institution)

**RF-003: Order Matching Engine**
- **Priority**: Critical
- **Description**: Automatically matches borrower and lender orders
- **Input**: Active orders from both sides
- **Processing**:
  1. Find compatible orders
  2. Prioritize best rate for borrower
  3. Execute match and create loan contract
  4. Lock interest rate for full duration
  5. Transfer USDT to borrower (minus provision)
- **Output**: Loan contract with fixed terms
- **Actor**: System

**RF-004: Take Existing Order**
- **Priority**: Critical
- **Description**: User directly takes existing order
- **Input**: Order ID, desired amount
- **Processing**:
  1. Validate eligibility
  2. If borrower: deposit collateral
  3. If lender: deposit USDT
  4. Instant execution without negotiation
  5. Create loan contract
- **Output**: Loan contract created
- **Actor**: Borrower or Lender

### 3.2 Collateral Management

**RF-005: Collateral Deposit**
- **Priority**: Critical
- **Description**: Process collateral receipt from borrower
- **Input**: Transaction from blockchain
- **Processing**:
  1. Detect payment to invoice address
  2. Wait for required confirmations
  3. Calculate value in USDT
  4. Verify LTV ratio (must be ≤70%)
  5. Lock collateral for loan duration
- **Output**: Collateral locked, loan can be disbursed
- **Actor**: Blockchain Indexer

**RF-006: Daily Settlement to Binance**
- **Priority**: Critical
- **Description**: Manual transfer of 50% collateral to Binance
- **Input**: Admin action at 00:00 WIB
- **Processing**:
  1. Calculate total collateral per currency
  2. Prepare 50% for transfer
  3. Admin execute manual transfer
  4. Update internal records
  5. Enable pending order capability
- **Output**: Assets positioned at Binance
- **Actor**: Admin

**RF-007: Collateral Release**
- **Priority**: Critical
- **Description**: Return collateral after repayment
- **Input**: Loan repayment completion
- **Processing**:
  1. Verify full payment received
  2. Unlock collateral
  3. Credit to user balance
  4. Available for withdrawal or reuse
- **Output**: Collateral available in balance
- **Actor**: System

### 3.3 Loan Lifecycle

**RF-008: Loan Disbursement**
- **Priority**: Critical
- **Description**: Fund disbursement to borrower
- **Input**: Matched loan contract
- **Processing**:
  1. Calculate net amount (principal without deductions)
  2. Transfer USDT to borrower
  3. Schedule repayment invoice (D-7)
  4. Start LTV monitoring
  5. Set maturity date
- **Output**: USDT transferred, loan active
- **Actor**: System

**RF-009: Interest Calculation**
- **Priority**: Critical
- **Description**: Fixed interest calculation at inception
- **Input**: Principal, rate, duration
- **Processing**:
  1. Calculate: Interest = Principal × Rate × (Months/12)
  2. Lock amount for entire duration
  3. Add to total repayment
  4. No proration for early payment
- **Output**: Fixed interest amount
- **Actor**: System

**RF-010: Loan Repayment**
- **Priority**: Critical
- **Description**: Loan repayment process
- **Input**: Payment from borrower
- **Processing**:
  1. Verify amount = Principal + Interest + Provision
  2. Distribute interest to lender (minus fee)
  3. Allocate provision to platform
  4. Release collateral
  5. Mark loan as concluded
- **Output**: Loan closed, collateral released
- **Actor**: System

**RF-011: Asset Sale Option**
- **Priority**: High
- **Description**: Option to sell collateral for repayment
- **Input**: Borrower request, sale option (full/partial)
- **Processing**:
  1. If full sale: Sell all, return surplus USDT
  2. If partial: Sell enough to pay debt, return remaining assets
  3. Execute via Binance
  4. Settle loan
- **Output**: Loan settled, surplus returned
- **Actor**: Borrower

### 3.4 Risk Management & Liquidation

**RF-012: LTV Monitoring**
- **Priority**: Critical
- **Description**: Monitor LTV ratio real-time
- **Input**: Price feed, active loans
- **Processing**:
  1. Calculate current LTV every 5 minutes
  2. If approaching threshold: send warnings
  3. At risk premium level: place pending order
  4. At liquidation level: execute market order
- **Output**: Actions triggered based on LTV
- **Actor**: Monitoring Worker

**RF-013: Price-Based Warnings**
- **Priority**: Critical
- **Description**: Price-based warning system
- **Input**: LTV calculations
- **Processing**:
  1. Warning 1: Total debt + 15%
  2. Warning 2: Total debt + 10%
  3. Final warning: Total debt + 5%
  4. Pending order: Total debt + 2% (risk premium)
  5. Liquidation: At total debt level
- **Output**: Notifications sent
- **Actor**: System

**RF-014: Time-Based Warnings**
- **Priority**: High
- **Description**: Time-based maturity warnings
- **Input**: Loan maturity dates
- **Processing**:
  1. D-3: Daily reminder
  2. D-2: Daily reminder
  3. D-1: Final reminder
  4. D-0: Liquidation if not paid
- **Output**: Email/SMS/Push notifications
- **Actor**: System

**RF-015: Automatic Liquidation**
- **Priority**: Critical
- **Description**: Automatic liquidation execution
- **Input**: LTV breach or maturity default
- **Processing**:
  1. Execute pre-positioned order on Binance
  2. Sell collateral at market
  3. Pay lender (100% guaranteed)
  4. Return surplus to borrower (if any)
  5. Platform covers deficit (if any)
- **Output**: Loan liquidated and settled
- **Actor**: System

**RF-016: Platform Guarantee Execution**
- **Priority**: Critical
- **Description**: Platform covers liquidation deficit
- **Input**: Liquidation deficit
- **Processing**:
  1. Calculate shortfall
  2. Transfer from platform reserves
  3. Ensure lender receives full payment
  4. Log deficit for accounting
- **Output**: Lender paid in full
- **Actor**: System

### 3.5 Balance & Withdrawal Management

**RF-017: Internal Balance System**
- **Priority**: Critical
- **Description**: Multi-currency internal balance management
- **Input**: User transactions
- **Processing**:
  1. Track BTC, ETH, BNB, SOL, USDT balances
  2. Enable instant reuse without blockchain
  3. Support internal transfers
  4. Aggregate portfolio value
- **Output**: Updated balance display
- **Actor**: System

**RF-018: Withdrawal Request**
- **Priority**: Critical
- **Description**: Fund/asset withdrawal process
- **Input**: Amount, currency, destination address
- **Processing**:
  1. Verify minimum (20 USDT equivalent)
  2. Check balance sufficiency
  3. No withdrawal fee (platform covers)
  4. Queue for processing
  5. Execute blockchain transfer
- **Output**: Assets transferred
- **Actor**: User

**RF-019: Withdrawal Processing**
- **Priority**: Critical
- **Description**: Blockchain withdrawal execution
- **Input**: Pending withdrawals
- **Processing**:
  1. Batch similar transactions
  2. Platform pays all gas fees
  3. Execute transfers
  4. Monitor confirmations
  5. Update user balance
- **Output**: Withdrawal completed
- **Actor**: System

### 3.6 User Management

**RF-020: User Registration**
- **Priority**: Critical
- **Description**: New user registration
- **Input**: Email, password, user type
- **Processing**:
  1. Create account
  2. Select role (Individual/Company)
  3. KYC optional at registration
  4. Create wallets for all currencies
  5. Send verification email
- **Output**: User account created
- **Actor**: New User

**RF-021: KYC Verification**
- **Priority**: Critical
- **Description**: User identity verification
- **Input**:
  - Individual: ID card, selfie
  - Company: Articles of incorporation, tax ID, business license, director ID
- **Processing**:
  1. Upload documents
  2. Admin review
  3. Approve/reject with reason
  4. Update user status
- **Output**: KYC status updated
- **Actor**: User, Admin

**RF-022: Institution Registration**
- **Priority**: Medium
- **Description**: Financial institution registration
- **Input**: Company documents, authorized personnel
- **Processing**:
  1. Submit company KYC
  2. Admin verification
  3. Set preferential fees (2.5%)
  4. Grant lending-only access
  5. Enable priority in order book
- **Output**: Institution account created
- **Actor**: Institution Representative, Admin

### 3.7 Admin Functions

**RF-023: Dashboard Monitoring**
- **Priority**: Critical
- **Description**: Real-time monitoring dashboard
- **Input**: System metrics
- **Processing**:
  1. Display active loans
  2. Show LTV ratios
  3. Platform reserves status
  4. Pending liquidations
  5. Daily settlement checklist
- **Output**: Dashboard view
- **Actor**: Admin

**RF-024: Manual Settlement Execution**
- **Priority**: Critical
- **Description**: Execute daily settlement to Binance
- **Input**: Admin action at 00:00 WIB
- **Processing**:
  1. Generate settlement report
  2. Calculate 50% of each asset
  3. Prepare transfer instructions
  4. Execute manual transfers
  5. Confirm completion
- **Output**: Settlement completed
- **Actor**: Admin

**RF-025: Emergency Liquidation**
- **Priority**: High
- **Description**: Manual liquidation trigger
- **Input**: Loan ID, reason
- **Processing**:
  1. Override automatic checks
  2. Force liquidation
  3. Execute via Binance
  4. Apply platform guarantee
  5. Log admin action
- **Output**: Loan liquidated
- **Actor**: Admin

---

## 4. Non-Functional Requirements

### 4.1 Performance

- **PERF-001: Response Time**
  - All API calls < 1000ms
  - Order book refresh < 500ms
  - Price feed update every 30 seconds

- **PERF-002: Throughput**
  - Handle 100+ concurrent users
  - Process 50+ loans per hour
  - Execute liquidations within 60 seconds

- **PERF-003: Settlement Processing**
  - Daily settlement completed within 2 hours
  - Pending order placement < 5 minutes from trigger
  - Liquidation execution < 10 minutes from breach

### 4.2 Security

- **SEC-001: Custodial Security**
  - Hot wallet maximum 10% of total assets
  - Cold wallet with multi-signature
  - Daily reconciliation

- **SEC-002: Platform Guarantee Security**
  - Maintain reserves 110% of exposure
  - Real-time reserve monitoring
  - Automatic circuit breaker if reserves < 105%

- **SEC-003: Authentication**
  - 2FA mandatory for admin
  - Session-based auth for admin dashboard
  - JWT for mobile apps

### 4.3 Availability

- **AVL-001: Uptime**
  - Platform uptime 99.5%
  - Binance API fallback to DEX
  - Price feed fallback to CoinGecko

- **AVL-002: Disaster Recovery**
  - Daily backup of all data
  - Recovery time < 4 hours
  - Geo-distributed backups

### 4.4 Reliability

- **REL-001: Data Integrity**
  - Blockchain-database reconciliation every hour
  - Immutable audit logs
  - Transaction atomicity guaranteed

- **REL-002: Platform Guarantee Reliability**
  - Reserves audited quarterly
  - Insurance fund from risk premium
  - Transparent deficit reporting

---

## 5. Business Requirements

### 5.1 Platform Business Model

#### 5.1.1 Revenue Structure

- **BR-001: Platform Revenue Sources**
  - **Borrower Provision**: 3% of principal (paid upfront)
  - **Individual Lender Fee**: 10% of interest
  - **Institution Fee**: 2.5% of interest
  - **Risk Premium**: 2% buffer (not revenue)

- **BR-002: Revenue Calculation Example**
  ```
  Loan: 10,000 USDT, 3 months, 1% per month

  With Individual Lender:
  - Borrower provision: 300 USDT
  - Fee from interest (10% × 300): 30 USDT
  - Total revenue: 330 USDT (3.3%)

  With Institution:
  - Borrower provision: 300 USDT
  - Fee from interest (2.5% × 300): 7.50 USDT
  - Total revenue: 307.50 USDT (3.08%)
  ```

#### 5.1.2 Platform Guarantee Model

- **BR-003: 100% Platform Guarantee**
  - Platform guarantees full repayment for lenders
  - Platform bears ALL liquidation risks
  - Lenders have NO market risk
  - Platform covers deficit from own funds

- **BR-004: Risk Buffer Management**
  ```
  Buffer Components:
  - Risk Premium 2%: Liquidation threshold buffer
  - Insurance Fund: 0.8% of provision
  - Platform Reserves: Min 110% of exposure
  ```

### 5.2 Operational Rules

#### 5.2.1 Loan Parameters

- **BR-005: Loan Limits**
  - Minimum: 50 USDT
  - Maximum: 20,000 USDT total per user
  - Fixed LTV: 70% (not adjustable)
  - Duration: 1-12 months

- **BR-006: Interest Calculation**
  ```
  Interest = Principal × Annual Rate × (Months/12)

  Example:
  Principal: 10,000 USDT
  Rate: 12% per year
  Duration: 3 months
  Interest = 10,000 × 0.12 × 3/12 = 300 USDT
  ```

- **BR-007: Fee Structure**
  | Component | Rate | Method | Timing |
  |-----------|------|--------|---------|
  | Provision | 3% | Add to bill | At repayment |
  | Individual Fee | 10% | Deduct from interest | At distribution |
  | Institution Fee | 2.5% | Deduct from interest | At distribution |
  | Gas Fee | 0% | Platform covers | - |

#### 5.2.2 Liquidation Rules

- **BR-008: Liquidation Triggers**
  - LTV reaches 70% (from 5-minute monitoring)
  - Payment default at maturity date
  - Manual trigger by admin

- **BR-009: Liquidation Process**
  ```
  1. Pending order at LTV 68% (risk premium level)
  2. Market order at LTV 70%
  3. Sell via Binance (pre-positioned assets)
  4. Pay lender 100% (guaranteed)
  5. Return surplus to borrower
  6. Platform covers deficit
  ```

- **BR-010: Settlement Distribution**
  | Scenario | Lender | Borrower | Platform |
  |----------|--------|----------|----------|
  | Surplus | 100% paid | Gets surplus | Fee only |
  | Break-even | 100% paid | Nothing | Fee only |
  | Deficit | 100% paid | Nothing | Covers loss |

#### 5.2.3 Warning System

- **BR-011: Price-Based Warnings**
  | Level | Trigger | Action |
  |-------|---------|--------|
  | Warning 1 | Debt + 15% | Email/SMS |
  | Warning 2 | Debt + 10% | Email/SMS |
  | Final | Debt + 5% | All channels |
  | Pending | Debt + 2% | Place order |
  | Liquidate | Debt level | Execute |

- **BR-012: Time-Based Warnings**
  - D-3: Daily reminder
  - D-2: Daily reminder
  - D-1: Final reminder
  - D-0: Auto liquidation if unpaid

### 5.3 System Configuration

- **CONF-001: Fee Configuration**
  | Parameter | Default | Min | Max | Notes |
  |-----------|---------|-----|-----|-------|
  | Provision | 3% | 2% | 5% | Covers all costs |
  | Individual Fee | 10% | 8% | 15% | From interest |
  | Institution Fee | 2.5% | 2% | 5% | Preferential |
  | Withdrawal Fee | 0% | 0% | 0% | Platform covers |

- **CONF-002: Risk Parameters**
  | Parameter | Default | Min | Max | Notes |
  |-----------|---------|-----|-----|-------|
  | Max LTV | 70% | 70% | 70% | Fixed, not configurable |
  | Risk Premium | 2% | 2% | 2% | Buffer for liquidation |
  | Warning Level | 15% | 10% | 20% | Above debt |
  | Monitor Interval | 5 min | 1 min | 10 min | LTV check |

- **CONF-003: Operational Parameters**
  | Parameter | Default | Notes |
  |-----------|---------|-------|
  | Settlement Time | 00:00 WIB | Daily manual process |
  | Binance Allocation | 50% | Of total collateral |
  | Hot Wallet Max | 10% | Security limit |
  | Price Feed Update | 30 sec | From Binance API |

---

## 6. Risk Management & Liquidation

### 6.1 Lender Protection Model

**RISK-001: 100% Capital Protection**
- Platform guarantees full repayment (principal + interest)
- No scenario where lenders experience losses
- Platform acts as guarantor/insurer
- All market risks absorbed by platform

**RISK-002: Risk Absorption Mechanism**
```
Sources of Funds to Cover Deficit:
1. Risk Premium (2% buffer)
2. Insurance Fund (0.8% of provision)
3. Platform operating profits
4. Platform capital reserves
5. Emergency credit facilities
```

### 6.2 Pre-positioning Strategy

**RISK-003: Binance Integration**
- 50% collateral transferred to Binance daily
- Enables instant liquidation orders
- Eliminates transfer delays during crisis
- Manual process at 00:00 WIB

**RISK-004: Pending Order System**
```
Trigger: LTV reaches 68% (risk premium level)
Action: Place limit sell order on Binance
Price: Set at liquidation threshold
Result: Automatic execution when price hits
```

### 6.3 Liquidation Scenarios

**RISK-005: Liquidation Examples**

```
Scenario 1: Market Recovery (Surplus)
Loan: 10,000 USDT
Total Debt: 10,800 USDT
Liquidation Result: 11,500 USDT
- Lender gets: 10,300 USDT (guaranteed)
- Borrower gets: 1,200 USDT (surplus)
- Platform: Fees only

Scenario 2: Break Even
Loan: 10,000 USDT
Total Debt: 10,800 USDT
Liquidation Result: 10,800 USDT
- Lender gets: 10,300 USDT (guaranteed)
- Borrower gets: 500 USDT
- Platform: Fees only

Scenario 3: Market Crash (Deficit)
Loan: 10,000 USDT
Total Debt: 10,800 USDT
Liquidation Result: 8,000 USDT
- Lender gets: 10,300 USDT (platform pays deficit)
- Borrower gets: 0 USDT
- Platform: Loses 2,300 USDT

Scenario 4: Extreme Crash
Loan: 10,000 USDT
Total Debt: 10,800 USDT
Liquidation Result: 5,000 USDT
- Lender gets: 10,300 USDT (platform covers 5,300 USDT)
- Borrower gets: 0 USDT
- Platform: Major loss absorbed
```

### 6.4 Emergency Protocols

**RISK-006: Circuit Breaker**
- Trigger: >10% price drop in 1 hour
- Action: Pause new loans
- Duration: Until market stabilizes
- Override: Admin manual only

**RISK-007: Reserve Depletion**
- <115% reserves: Warning mode
- <110% reserves: Stop new loans
- <105% reserves: Emergency mode
- <100% reserves: Platform halt

**RISK-008: Binance API Failure**
- Primary: Binance spot market
- Backup: Binance P2P
- Emergency: Other DEX integration
- Manual: OTC desk execution

---

## 7. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Client Representative | | | |
| Project Manager | | | |
| Technical Lead | | | |
| Head of Development | | | |

---