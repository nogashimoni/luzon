ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS exclude_from_hours BOOLEAN DEFAULT FALSE;
