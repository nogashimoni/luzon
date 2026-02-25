export interface User {
  id: string
  name: string
  created_at: string
}

export interface Project {
  id: string
  title: string
  color: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectNote {
  id: string
  project_id: string
  content: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  project_id: string | null
  user_id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  all_day: boolean
  color: string | null
  created_at: string
  updated_at: string
}
