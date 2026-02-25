-- Migration: Multi-user event assignments
-- Adds support for assigning multiple users to calendar events
-- Adds profile picture support for users

-- 1. Add avatar_url column to users table
ALTER TABLE public.users
ADD COLUMN avatar_url TEXT;

-- 2. Create event_assignees junction table for many-to-many relationship
CREATE TABLE public.event_assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 3. Create indexes for performance
CREATE INDEX idx_event_assignees_event ON public.event_assignees(event_id);
CREATE INDEX idx_event_assignees_user ON public.event_assignees(user_id);

-- 4. Enable realtime for event_assignees
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_assignees;

-- 5. Migrate existing data from calendar_events.user_id to event_assignees
-- This preserves existing single-user assignments
INSERT INTO public.event_assignees (event_id, user_id)
SELECT id, user_id
FROM public.calendar_events
WHERE user_id IS NOT NULL;

-- 6. Create storage bucket for avatars
-- Note: This must be done via Supabase dashboard or via the storage API
-- Bucket name: 'avatars'
-- Public: true
-- File size limit: 1MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- For reference, here's the SQL to check if the bucket exists:
-- SELECT * FROM storage.buckets WHERE name = 'avatars';

-- 7. Add comment explaining user_id column is kept for backwards compatibility
COMMENT ON COLUMN public.calendar_events.user_id IS 'Deprecated: Use event_assignees junction table instead. Kept for backwards compatibility.';
