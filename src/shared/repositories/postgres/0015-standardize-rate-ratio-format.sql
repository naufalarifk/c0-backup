-- Migration 0015: Standardize rate and ratio format to 0-1 decimal range
-- This migration converts all rate and ratio fields in platform_configs from 0-100 percentage format to 0-1 decimal format
-- for consistency across the application.
--
-- BEFORE: loan_provision_rate = 3.0 means 3%
-- AFTER:  loan_provision_rate = 0.03 means 3%

-- Step 1: Convert existing data from 0-100 to 0-1 range
UPDATE platform_configs
SET
  loan_provision_rate = loan_provision_rate / 100.0,
  loan_individual_redelivery_fee_rate = loan_individual_redelivery_fee_rate / 100.0,
  loan_institution_redelivery_fee_rate = loan_institution_redelivery_fee_rate / 100.0,
  loan_min_ltv_ratio = loan_min_ltv_ratio / 100.0,
  loan_max_ltv_ratio = loan_max_ltv_ratio / 100.0,
  loan_liquidation_premi_rate = loan_liquidation_premi_rate / 100.0,
  loan_liquidation_fee_rate = loan_liquidation_fee_rate / 100.0;

-- Step 2: Add CHECK constraints to ensure values are in 0-1 range
-- First drop the table and recreate with proper constraints
-- Note: This is safe because we just converted the data above

-- We need to preserve existing data, so we'll use ALTER TABLE to add constraints
ALTER TABLE platform_configs
  DROP CONSTRAINT IF EXISTS platform_configs_loan_provision_rate_check,
  ADD CONSTRAINT platform_configs_loan_provision_rate_check
    CHECK (loan_provision_rate >= 0 AND loan_provision_rate <= 1);

ALTER TABLE platform_configs
  DROP CONSTRAINT IF EXISTS platform_configs_loan_individual_redelivery_fee_rate_check,
  ADD CONSTRAINT platform_configs_loan_individual_redelivery_fee_rate_check
    CHECK (loan_individual_redelivery_fee_rate >= 0 AND loan_individual_redelivery_fee_rate <= 1);

ALTER TABLE platform_configs
  DROP CONSTRAINT IF EXISTS platform_configs_loan_institution_redelivery_fee_rate_check,
  ADD CONSTRAINT platform_configs_loan_institution_redelivery_fee_rate_check
    CHECK (loan_institution_redelivery_fee_rate >= 0 AND loan_institution_redelivery_fee_rate <= 1);

ALTER TABLE platform_configs
  DROP CONSTRAINT IF EXISTS platform_configs_loan_min_ltv_ratio_check,
  ADD CONSTRAINT platform_configs_loan_min_ltv_ratio_check
    CHECK (loan_min_ltv_ratio >= 0 AND loan_min_ltv_ratio <= 1);

ALTER TABLE platform_configs
  DROP CONSTRAINT IF EXISTS platform_configs_loan_max_ltv_ratio_check,
  ADD CONSTRAINT platform_configs_loan_max_ltv_ratio_check
    CHECK (loan_max_ltv_ratio >= 0 AND loan_max_ltv_ratio <= 1);

ALTER TABLE platform_configs
  DROP CONSTRAINT IF EXISTS platform_configs_loan_liquidation_premi_rate_check,
  ADD CONSTRAINT platform_configs_loan_liquidation_premi_rate_check
    CHECK (loan_liquidation_premi_rate >= 0 AND loan_liquidation_premi_rate <= 1);

ALTER TABLE platform_configs
  DROP CONSTRAINT IF EXISTS platform_configs_loan_liquidation_fee_rate_check,
  ADD CONSTRAINT platform_configs_loan_liquidation_fee_rate_check
    CHECK (loan_liquidation_fee_rate >= 0 AND loan_liquidation_fee_rate <= 1);

-- Step 3: Update column comments to reflect the new format
COMMENT ON COLUMN platform_configs.loan_provision_rate IS 'Loan provision rate as decimal (e.g., 0.03 = 3%)';
COMMENT ON COLUMN platform_configs.loan_individual_redelivery_fee_rate IS 'Individual redelivery fee rate as decimal (e.g., 0.10 = 10%)';
COMMENT ON COLUMN platform_configs.loan_institution_redelivery_fee_rate IS 'Institution redelivery fee rate as decimal (e.g., 0.025 = 2.5%)';
COMMENT ON COLUMN platform_configs.loan_min_ltv_ratio IS 'Minimum LTV ratio as decimal (e.g., 0.60 = 60%)';
COMMENT ON COLUMN platform_configs.loan_max_ltv_ratio IS 'Maximum LTV ratio as decimal (e.g., 0.75 = 75%)';
COMMENT ON COLUMN platform_configs.loan_liquidation_premi_rate IS 'Liquidation premium rate as decimal (e.g., 0.02 = 2%)';
COMMENT ON COLUMN platform_configs.loan_liquidation_fee_rate IS 'Liquidation fee rate as decimal (e.g., 0.02 = 2%)';

-- Step 4: Also update withdrawal_fee_rate in currencies table if not already in 0-1 range
-- Check if the currencies table needs updating
DO $$
BEGIN
  -- Only update if there are values > 1 (indicating they're in 0-100 format)
  IF EXISTS (SELECT 1 FROM currencies WHERE withdrawal_fee_rate > 1) THEN
    UPDATE currencies
    SET withdrawal_fee_rate = withdrawal_fee_rate / 100.0
    WHERE withdrawal_fee_rate > 1;
  END IF;
END $$;

-- Add constraint to currencies.withdrawal_fee_rate
ALTER TABLE currencies
  DROP CONSTRAINT IF EXISTS currencies_withdrawal_fee_rate_check,
  ADD CONSTRAINT currencies_withdrawal_fee_rate_check
    CHECK (withdrawal_fee_rate >= 0 AND withdrawal_fee_rate <= 1);

COMMENT ON COLUMN currencies.withdrawal_fee_rate IS 'Withdrawal fee rate as decimal (e.g., 0.001 = 0.1%)';
