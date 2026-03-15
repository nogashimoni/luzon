ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'one_time'
  CHECK (project_type IN ('retainer', 'one_time'));
