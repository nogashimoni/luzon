import type { CalendarEvent } from '../types'

export function calculateEventHours(event: CalendarEvent): number {
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
