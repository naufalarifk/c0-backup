-- Migration 0016: Fix LTV values in currencies table
-- This migration fixes LTV values that were incorrectly stored in 0-100 format instead of 0-1 decimal format
--
-- BEFORE: max_ltv = 60.0 means 60 (incorrect, 6000%)
-- AFTER:  max_ltv = 0.60 means 60% (correct)

-- Step 1: Convert existing data from 0-100 to 0-1 range (only for values > 1)
UPDATE currencies
SET
  max_ltv = max_ltv / 100.0,
  ltv_warning_threshold = ltv_warning_threshold / 100.0,
  ltv_critical_threshold = ltv_critical_threshold / 100.0,
  ltv_liquidation_threshold = ltv_liquidation_threshold / 100.0
WHERE max_ltv > 1;

-- Step 2: Add CHECK constraints to ensure values are in 0-1 range
ALTER TABLE currencies
  DROP CONSTRAINT IF EXISTS currencies_max_ltv_check,
  ADD CONSTRAINT currencies_max_ltv_check
    CHECK (max_ltv >= 0 AND max_ltv <= 1);

ALTER TABLE currencies
  DROP CONSTRAINT IF EXISTS currencies_ltv_warning_threshold_check,
  ADD CONSTRAINT currencies_ltv_warning_threshold_check
    CHECK (ltv_warning_threshold >= 0 AND ltv_warning_threshold <= 1);

ALTER TABLE currencies
  DROP CONSTRAINT IF EXISTS currencies_ltv_critical_threshold_check,
  ADD CONSTRAINT currencies_ltv_critical_threshold_check
    CHECK (ltv_critical_threshold >= 0 AND ltv_critical_threshold <= 1);

ALTER TABLE currencies
  DROP CONSTRAINT IF EXISTS currencies_ltv_liquidation_threshold_check,
  ADD CONSTRAINT currencies_ltv_liquidation_threshold_check
    CHECK (ltv_liquidation_threshold >= 0 AND ltv_liquidation_threshold <= 1);

-- Step 3: Update column comments to reflect the decimal format
COMMENT ON COLUMN currencies.max_ltv IS 'Maximum LTV ratio as decimal (e.g., 0.60 = 60%)';
COMMENT ON COLUMN currencies.ltv_warning_threshold IS 'LTV warning threshold as decimal (e.g., 0.48 = 48%)';
COMMENT ON COLUMN currencies.ltv_critical_threshold IS 'LTV critical threshold as decimal (e.g., 0.57 = 57%)';
COMMENT ON COLUMN currencies.ltv_liquidation_threshold IS 'LTV liquidation threshold as decimal (e.g., 0.60 = 60%)';
