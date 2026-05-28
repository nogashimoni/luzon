-- Add hours tracking mode and reset timestamp to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS hours_tracking TEXT NOT NULL DEFAULT 'all_time',
  ADD COLUMN IF NOT EXISTS hours_reset_at TIMESTAMPTZ;

-- Store history of each reset period so no data is ever lost
CREATE TABLE IF NOT EXISTS project_hours_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_label TEXT,          -- e.g. "May 2026" or "Manual reset"
  period_start TIMESTAMPTZ,   -- NULL means "from the beginning"
  period_end TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hours NUMERIC NOT NULL DEFAULT 0,
  reset_type TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'monthly_auto'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_hours_history_project_id_idx
  ON project_hours_history (project_id, created_at DESC);
