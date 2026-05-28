-- Add retainer monthly amount to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS retainer_amount NUMERIC(10,2);

-- Payment tracking table
CREATE TABLE IF NOT EXISTS project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date DATE,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'expected', -- 'expected' | 'paid' | 'overdue'
  invoice_ref TEXT,
  month TEXT, -- YYYY-MM, used for retainer monthly entries
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_payments_project_id_idx ON project_payments(project_id);
CREATE INDEX IF NOT EXISTS project_payments_month_idx ON project_payments(month);
CREATE INDEX IF NOT EXISTS project_payments_status_idx ON project_payments(status);

ALTER TABLE project_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON project_payments
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER set_updated_at_payments
  BEFORE UPDATE ON project_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE project_payments;
