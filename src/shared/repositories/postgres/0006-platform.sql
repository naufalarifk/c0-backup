CREATE TABLE IF NOT EXISTS platform_configs (
  effective_date TIMESTAMP PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  loan_disbursement_fee_rate DECIMAL(8, 4) NOT NULL,
  loan_redelivery_fee_rate DECIMAL(8, 4) NOT NULL,
  loan_max_ltv_ratio DECIMAL(8, 4) NOT NULL,
  loan_repayment_duration_in_days INT NOT NULL,
  loan_liquidation_mode VARCHAR(32) NOT NULL DEFAULT 'Partial' CHECK (loan_liquidation_mode IN ('Partial', 'Full')),
  loan_liquidation_fee_rate DECIMAL(8, 4) NOT NULL DEFAULT 0,
  -- Additional configuration parameters
  admin_invitation_expiry_hours INT NOT NULL DEFAULT 24,
  max_withdrawal_daily_limit BIGINT DEFAULT 100000.00,
  max_withdrawal_monthly_limit BIGINT DEFAULT 1000000.00,
  kyc_document_retention_days INT NOT NULL DEFAULT 2555, -- 7 years
  admin_session_timeout_minutes INT NOT NULL DEFAULT 30,
  price_feed_staleness_threshold_minutes INT NOT NULL DEFAULT 10,
  liquidation_fee_rate DECIMAL(8, 4) NOT NULL DEFAULT 1, -- 1% of total collateral value
  liquidation_slippage_tolerance DECIMAL(8, 4) NOT NULL DEFAULT 0.02 -- 2%
);

--- PLATFORM FIXED DATA ---

-- Insert default platform configuration as defined in SRS-CD-v2.3-EN.md Section 5.3 CONF-001
INSERT INTO platform_configs (
  effective_date, admin_user_id,
  loan_disbursement_fee_rate, loan_redelivery_fee_rate, loan_max_ltv_ratio, loan_repayment_duration_in_days,
  loan_liquidation_fee_rate, liquidation_fee_rate, liquidation_slippage_tolerance,
  admin_invitation_expiry_hours, max_withdrawal_daily_limit, max_withdrawal_monthly_limit,
  kyc_document_retention_days, admin_session_timeout_minutes, price_feed_staleness_threshold_minutes
) VALUES (
  '2024-01-01T00:00:00Z', 1,
  0.03, 0.02, 0.70, 30, -- 3% origination, 2% redelivery (BR-003, BR-004)
  0.02, 0.01, 0.02, -- 2% forced liquidation, 1% early liquidation, 2% slippage (BR-009, BR-010)
  24, 10000000000, 100000000000, -- 24h admin invite, 100k/1M USDT limits (micro-units)
  2555, 30, 15 -- 7 years retention, 30min session, 15min price staleness
) ON CONFLICT (effective_date) DO UPDATE SET
  loan_disbursement_fee_rate = EXCLUDED.loan_disbursement_fee_rate,
  loan_redelivery_fee_rate = EXCLUDED.loan_redelivery_fee_rate,
  loan_liquidation_fee_rate = EXCLUDED.loan_liquidation_fee_rate,
  liquidation_fee_rate = EXCLUDED.liquidation_fee_rate;
