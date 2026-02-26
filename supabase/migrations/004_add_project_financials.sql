-- Create project financials table for monthly income/expenses tracking
CREATE TABLE IF NOT EXISTS project_financials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format: YYYY-MM (e.g., '2026-02')
  income DECIMAL(10, 2) DEFAULT 0,
  expenses DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, month)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_financials_project_id ON project_financials(project_id);
CREATE INDEX IF NOT EXISTS idx_financials_month ON project_financials(month);

-- Add realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE project_financials;

-- Add update trigger
CREATE TRIGGER set_updated_at_financials
  BEFORE UPDATE ON project_financials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Comment
COMMENT ON TABLE project_financials IS 'Monthly income and expenses tracking for projects';
COMMENT ON COLUMN project_financials.month IS 'Month in YYYY-MM format';
COMMENT ON COLUMN project_financials.income IS 'Total income for the month';
COMMENT ON COLUMN project_financials.expenses IS 'Total expenses for the month';
