CREATE TABLE IF NOT EXISTS platform_configs (
  effective_date TIMESTAMP PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  loan_provision_rate DECIMAL(8, 4) NOT NULL,
  loan_individual_redelivery_fee_rate DECIMAL(8, 4) NOT NULL,
  loan_institution_redelivery_fee_rate DECIMAL(8, 4) NOT NULL,
  loan_min_ltv_ratio DECIMAL(8, 4) NOT NULL,
  loan_max_ltv_ratio DECIMAL(8, 4) NOT NULL,
  loan_repayment_duration_in_days INT NOT NULL,
  loan_liquidation_mode VARCHAR(32) NOT NULL DEFAULT 'Partial' CHECK (loan_liquidation_mode IN ('Partial', 'Full')),
  loan_liquidation_premi_rate DECIMAL(8, 4) NOT NULL DEFAULT 2.0,
  loan_liquidation_fee_rate DECIMAL(8, 4) NOT NULL DEFAULT 2.0
);

--- PLATFORM FIXED DATA ---

-- Insert default platform configuration as defined in SRS-CD-v2.3-EN.md Section 5.3 CONF-001
INSERT INTO platform_configs (
  effective_date, admin_user_id, loan_provision_rate,
  loan_individual_redelivery_fee_rate, loan_institution_redelivery_fee_rate,
  loan_min_ltv_ratio, loan_max_ltv_ratio, loan_repayment_duration_in_days,
  loan_liquidation_mode, loan_liquidation_premi_rate, loan_liquidation_fee_rate
) VALUES (
  '2024-01-01T00:00:00Z', 1, 3.0,
  10.0, 2.5, -- 10% individual, 2.5% institution
  60.0, 75.0, 3, -- 60% LTV when collateral deposit, 75% LTV when loan application fails, 3 days repayment duration
  'Partial', 2.0, 2.0 -- Partial liquidation mode, 2% premi, 2% fee
) ON CONFLICT (effective_date) DO UPDATE SET
  loan_provision_rate = EXCLUDED.loan_provision_rate,
  loan_liquidation_premi_rate = EXCLUDED.loan_liquidation_premi_rate,
  loan_liquidation_fee_rate = EXCLUDED.loan_liquidation_fee_rate;
