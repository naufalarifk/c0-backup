-- Migration 0012: Create loan_documents table for document request tracking
-- This table tracks document generation requests and their status

CREATE TABLE IF NOT EXISTS loan_documents (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(255) UNIQUE NOT NULL,
  loan_id BIGINT NOT NULL,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('LoanAgreement', 'LiquidationNotice', 'RepaymentReceipt')),
  status VARCHAR(20) NOT NULL CHECK (
    status IN (
      'Queued',
      'InProgress',
      'Completed',
      'Failed'
    )
  ) DEFAULT 'Queued',
  document_url TEXT,
  error_message TEXT,
  requested_by VARCHAR(255) NOT NULL,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'normal', 'high')) DEFAULT 'normal',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_loan_documents_loan_id ON loan_documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_documents_request_id ON loan_documents(request_id);
CREATE INDEX IF NOT EXISTS idx_loan_documents_status ON loan_documents(status);
CREATE INDEX IF NOT EXISTS idx_loan_documents_type ON loan_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_loan_documents_created_at ON loan_documents(created_at);

-- Create unique constraint to prevent duplicate requests for same document
CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_documents_unique_active
ON loan_documents(loan_id, document_type)
WHERE status IN ('Queued', 'InProgress', 'Completed');

-- Add foreign key constraint if loans table exists
-- Note: This assumes the loans table has an 'id' column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans') THEN
    ALTER TABLE loan_documents
        ADD CONSTRAINT fk_loan_documents_loan_id
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
  END IF;
END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'loan_documents'
          AND column_name = 'loan_id'
      ) THEN
        ALTER TABLE loan_documents
          ALTER COLUMN loan_id TYPE BIGINT USING loan_id::BIGINT;
      END IF;
    END $$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_loan_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_loan_documents_updated_at
  BEFORE UPDATE ON loan_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_loan_documents_updated_at();