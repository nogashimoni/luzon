import type { CalendarEvent, Project, HoursTracking } from '../types'

export function getHoursWindowStart(tracking: HoursTracking, resetAt: string | null): Date | null {
  if (tracking === 'monthly') {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  if (tracking === 'since_reset' && resetAt) {
    return new Date(resetAt)
  }
  return null // all_time — no filter
}

export function filterEventsForHours(events: CalendarEvent[], project: Pick<Project, 'hours_tracking' | 'hours_reset_at'>): CalendarEvent[] {
  const from = getHoursWindowStart(project.hours_tracking ?? 'all_time', project.hours_reset_at)
  if (!from) return events
  return events.filter((e) => new Date(e.start_time) >= from)
}

export function calculateEventHours(event: CalendarEvent): number {
  if (event.exclude_from_hours) return 0

  const start = new Date(event.start_time)
  const end = new Date(event.end_time)
  const diffMs = end.getTime() - start.getTime()
  const hours = Math.max(0, diffMs / (1000 * 60 * 60))

  // Multiply by number of assignees (critical: if 2 users, hours count TWICE)
  const assigneeCount = event.assignees?.length || 1
  return hours * assigneeCount
}

export function calculateProjectHours(events: CalendarEvent[]): number {
  return events.reduce((total, event) => total + calculateEventHours(event), 0)
}

// Calculate total user-hours for a project (sum of all user assignments)
export function calculateProjectUserHours(events: CalendarEvent[]): number {
  return events.reduce((total, event) => {
    if (event.exclude_from_hours) return total

    const start = new Date(event.start_time)
    const end = new Date(event.end_time)
    const diffMs = end.getTime() - start.getTime()
    const hours = Math.max(0, diffMs / (1000 * 60 * 60))
    const assigneeCount = event.assignees?.length || 1
    return total + (hours * assigneeCount)
  }, 0)
}

// Calculate hours for a specific user across events
export function calculateUserHours(events: CalendarEvent[], userId: string): number {
  return events.reduce((total, event) => {
    if (event.exclude_from_hours) return total

    // Check if user is assigned to this event
    const isAssigned = event.assignees?.some(assignee => assignee.user_id === userId) ||
                       event.user_id === userId // Backwards compatibility

    if (!isAssigned) return total

    const start = new Date(event.start_time)
    const end = new Date(event.end_time)
    const diffMs = end.getTime() - start.getTime()
    const hours = Math.max(0, diffMs / (1000 * 60 * 60))

    return total + hours
  }, 0)
}

export function formatHours(hours: number): string {
  if (hours === 0) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
