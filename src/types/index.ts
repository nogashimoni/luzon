export interface User {
  id: string
  name: string
  avatar_url: string | null
  created_at: string
}

export type ProjectStatus = 'in_progress' | 'waiting_payment' | 'completed'

export interface Project {
  id: string
  title: string
  color: string
  description: string | null
  status: ProjectStatus
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

export interface EventAssignee {
  id: string
  event_id: string
  user_id: string
  user?: User
  created_at: string
}

export interface CalendarEvent {
  id: string
  project_id: string | null
  user_id: string // Deprecated: kept for backwards compatibility
  title: string
  description: string | null
  start_time: string
  end_time: string
  all_day: boolean
  color: string | null
  created_at: string
  updated_at: string
  assignees?: EventAssignee[] // Multi-user assignments via junction table
}
