import type { CalendarEvent } from '../types'

export function calculateEventHours(event: CalendarEvent): number {
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)
  const diffMs = end.getTime() - start.getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60))
}

export function calculateProjectHours(events: CalendarEvent[]): number {
  return events.reduce((total, event) => total + calculateEventHours(event), 0)
}

export function formatHours(hours: number): string {
  if (hours === 0) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
