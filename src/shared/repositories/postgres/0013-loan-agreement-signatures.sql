-- Migration 0013: Create loan_agreement_signatures table for tracking loan document signatures
-- This table tracks which users have signed loan agreements

CREATE TABLE IF NOT EXISTS loan_agreement_signatures (
  id SERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL,
  user_id INTEGER NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'LoanAgreement',
  signature_hash VARCHAR(255),
  signature_method VARCHAR(50) DEFAULT 'digital',
  ip_address INET,
  user_agent TEXT,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_loan_agreement_signatures_loan_id ON loan_agreement_signatures(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_agreement_signatures_user_id ON loan_agreement_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_agreement_signatures_signed_at ON loan_agreement_signatures(signed_at);

-- Create unique constraint to prevent duplicate signatures
CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_agreement_signatures_unique
ON loan_agreement_signatures(loan_id, user_id, document_type);

-- Add foreign key constraints if tables exist
DO $$
BEGIN
  -- Foreign key to loans table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans') THEN
    ALTER TABLE loan_agreement_signatures
    ADD CONSTRAINT fk_loan_agreement_signatures_loan_id
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
  END IF;

  -- Foreign key to users table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE loan_agreement_signatures
    ADD CONSTRAINT fk_loan_agreement_signatures_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;