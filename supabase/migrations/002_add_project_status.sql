-- Add status column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_progress'
CHECK (status IN ('in_progress', 'waiting_payment', 'completed'));

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Update existing projects to have default status
UPDATE projects
SET status = 'in_progress'
WHERE status IS NULL;

-- Comment the column
COMMENT ON COLUMN projects.status IS 'Project status: in_progress, waiting_payment, or completed';
