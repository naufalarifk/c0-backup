# Enhanced Loan Matcher - Lender Rules Demo

## Overview

The loan matcher now supports enhanced lender rules that provide more sophisticated matching capabilities:

### 1. Multiple Duration Options
Lenders can now specify multiple duration choices instead of just one fixed duration.

```typescript
// Example: Lender offers 12, 24, or 36-month terms
const lenderOffer = {
  id: 'offer123',
  lenderUserId: 'lender1',
  termInMonthsOptions: [12, 24, 36], // Multiple choices
  interestRate: 8.5,
  minLoanPrincipalAmount: '10000',
  maxLoanPrincipalAmount: '100000',
  // ... other fields
};

// Usage in queue service
await loanMatcherQueueService.queueLoanMatchingWithLenderCriteria({
  durationOptions: [12, 24], // Only match lenders offering these terms
});
```

### 2. Fixed Interest Rate
Lenders set non-negotiable fixed interest rates that borrowers must accept.

```typescript
// Example: Lender sets fixed 8.5% rate
const lenderOffer = {
  id: 'offer123',
  interestRate: 8.5, // Fixed rate - non-negotiable
  // ... other fields
};

// Borrower application
const borrowerApplication = {
  maxAcceptableInterestRate: 10.0, // Must be >= 8.5% to match
  // ... other fields
};

// Usage in queue service
await loanMatcherQueueService.queueLoanMatchingWithLenderCriteria({
  fixedInterestRate: 8.5, // Only match offers with exactly this rate
});
```

### 3. Principal Amount Range (Min/Max)
Lenders specify minimum and maximum loan amounts they're willing to offer.

```typescript
// Example: Lender willing to lend between $10k and $100k
const lenderOffer = {
  id: 'offer123',
  minLoanPrincipalAmount: '10000', // Won't lend less than $10k
  maxLoanPrincipalAmount: '100000', // Won't lend more than $100k
  availablePrincipalAmount: '500000', // Has $500k available
  // ... other fields
};

// Borrower requesting $25k - this would match
const borrowerApplication = {
  requestedPrincipalAmount: '25000', // Within the $10k-$100k range
  // ... other fields
};

// Usage in queue service
await loanMatcherQueueService.queueLoanMatchingWithLenderCriteria({
  minPrincipalAmount: '20000', // Find lenders who can cover at least $20k
  maxPrincipalAmount: '50000',  // Don't need more than $50k capacity
});
```

## Combined Rules Example

```typescript
// Complex matching scenario
await loanMatcherQueueService.queueLoanMatchingWithLenderCriteria({
  // Rule 1: Duration flexibility
  durationOptions: [12, 24, 36], // Match lenders offering any of these terms
  
  // Rule 2: Fixed interest rate
  fixedInterestRate: 7.5, // Only 7.5% rate offers
  
  // Rule 3: Principal amount range
  minPrincipalAmount: '15000', // Need at least $15k coverage
  maxPrincipalAmount: '75000', // Don't need more than $75k
  
  // Additional filters
  collateralType: 'ETH',
  principalCurrency: 'USDC',
});
```

## Matching Logic Flow

1. **Pre-filtering**: Apply lender criteria to reduce candidate offers
   - Filter by duration option overlap
   - Filter by exact interest rate match
   - Filter by principal amount range overlap

2. **Application matching**: For each borrower application:
   - Check if requested amount is within lender's min/max range
   - Check if requested duration is in lender's available options
   - Check if lender's fixed rate is acceptable to borrower
   - Validate offer hasn't expired

3. **Sorting**: Prioritize offers by:
   - Lower interest rates (better for borrowers)
   - More duration flexibility (more options)
   - Higher available amounts (future capacity)
   - Lower minimum amounts (accessibility)

## Real-World Benefits

### For Lenders
- **Flexibility**: Offer multiple term options to attract more borrowers
- **Risk Management**: Set precise min/max loan amounts based on risk appetite  
- **Rate Control**: Set fixed, non-negotiable rates for predictable returns

### For Borrowers
- **Choice**: Access lenders with flexible term options
- **Transparency**: Clear understanding of fixed rates upfront
- **Accessibility**: Find lenders whose amount ranges match their needs

### For Platform
- **Efficiency**: Faster matching through intelligent pre-filtering
- **Quality**: Better matches based on comprehensive criteria
- **Scalability**: Handles complex matching scenarios automatically

## API Usage Examples

### Queue Immediate Matching for New Application
```typescript
// When a borrower publishes a new loan application
await loanMatcherQueueService.queueMatchingForNewApplication('app-123');
```

### Queue Immediate Matching for New Offer
```typescript
// When a lender publishes a new loan offer
await loanMatcherQueueService.queueMatchingForNewOffer('offer-456');
```

### Queue Advanced Criteria Matching
```typescript
// Custom matching with specific lender rules
await loanMatcherQueueService.queueLoanMatchingWithLenderCriteria({
  durationOptions: [12, 24],
  fixedInterestRate: 8.0,
  minPrincipalAmount: '25000',
  maxPrincipalAmount: '100000',
}, {
  priority: 1, // High priority
  delay: 0,    // Process immediately
});
```

## Migration from Legacy System

The enhanced system replaced the old simple criteria format:

```typescript
// OLD WAY (deprecated - removed)
// await loanMatcherQueueService.queueLoanMatchingWithCriteria({
//   duration: 12,
//   interest: 8.5,
//   principalAmount: '50000',
// });

// NEW WAY (enhanced features)
await loanMatcherQueueService.queueLoanMatchingWithLenderCriteria({
  durationOptions: [12],      // Multiple duration options supported
  fixedInterestRate: 8.5,     // Fixed interest rate
  minPrincipalAmount: '50000', // Minimum principal amount
  maxPrincipalAmount: '50000', // Maximum principal amount
});
```

## Testing

The system includes comprehensive tests for all lender rules:

- Multiple duration options validation
- Fixed interest rate matching
- Principal amount range filtering  
- Combined rules application
- Edge cases and error handling

See `loan-matcher.service.test.ts` for detailed test cases.