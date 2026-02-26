-- Create project checklist items table
CREATE TABLE IF NOT EXISTS project_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_checklist_project_id ON project_checklist_items(project_id);
CREATE INDEX IF NOT EXISTS idx_checklist_order ON project_checklist_items(project_id, item_order);

-- Add realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE project_checklist_items;

-- Add update trigger
CREATE TRIGGER set_updated_at_checklist_items
  BEFORE UPDATE ON project_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Comment
COMMENT ON TABLE project_checklist_items IS 'Todo checklist items for each project';
