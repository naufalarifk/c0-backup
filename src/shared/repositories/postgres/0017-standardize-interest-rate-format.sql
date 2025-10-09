-- Migration 0017: Standardize interest rate format to 0-1 decimal range
-- This migration updates interest rate constraints to use 0-1 decimal format for consistency
-- with all other rate/ratio fields in the system.
--
-- BEFORE: interest_rate can be 0-100 (e.g., 5.0 = 5%)
-- AFTER:  interest_rate must be 0-1 (e.g., 0.05 = 5%)

-- Step 1: Convert existing data from 0-100 to 0-1 range in loan_offers (only for values > 1)
UPDATE loan_offers
SET interest_rate = interest_rate / 100.0
WHERE interest_rate > 1;

-- Step 2: Convert existing data from 0-100 to 0-1 range in loan_applications (only for values > 1)
UPDATE loan_applications
SET max_interest_rate = max_interest_rate / 100.0
WHERE max_interest_rate > 1;

-- Step 3: Update CHECK constraints for loan_offers.interest_rate
ALTER TABLE loan_offers
  DROP CONSTRAINT IF EXISTS loan_offers_interest_rate_check,
  ADD CONSTRAINT loan_offers_interest_rate_check
    CHECK (interest_rate >= 0 AND interest_rate <= 1);

-- Step 4: Update CHECK constraints for loan_applications.max_interest_rate
ALTER TABLE loan_applications
  DROP CONSTRAINT IF EXISTS loan_applications_max_interest_rate_check,
  ADD CONSTRAINT loan_applications_max_interest_rate_check
    CHECK (max_interest_rate >= 0 AND max_interest_rate <= 1);

-- Step 5: Update column comments to reflect the new decimal format
COMMENT ON COLUMN loan_offers.interest_rate IS 'Interest rate as decimal (e.g., 0.05 = 5% annual)';
COMMENT ON COLUMN loan_applications.max_interest_rate IS 'Maximum interest rate borrower is willing to accept as decimal (e.g., 0.10 = 10% annual)';
