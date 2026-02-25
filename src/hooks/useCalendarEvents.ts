import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import type { CalendarEvent } from '../types'

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()

    const channel = supabase
      .channel('calendar-events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEvents((prev) => [...prev, payload.new as CalendarEvent])
          } else if (payload.eventType === 'UPDATE') {
            setEvents((prev) =>
              prev.map((e) =>
                e.id === (payload.new as CalendarEvent).id ? (payload.new as CalendarEvent) : e
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setEvents((prev) => prev.filter((e) => e.id !== (payload.old as CalendarEvent).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchEvents() {
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .order('start_time', { ascending: true })
    if (data) setEvents(data)
    setLoading(false)
  }

  async function createEvent(event: {
    title: string
    start_time: string
    end_time: string
    project_id?: string | null
    user_id: string
    all_day?: boolean
    color?: string | null
    description?: string | null
  }) {
    const { data, error } = await supabase.from('calendar_events').insert(event).select().single()
    if (error) throw error
    return data as CalendarEvent
  }

  async function updateEvent(
    id: string,
    updates: Partial<Pick<CalendarEvent, 'title' | 'start_time' | 'end_time' | 'project_id' | 'all_day' | 'color' | 'description'>>
  ) {
    const { error } = await supabase.from('calendar_events').update(updates).eq('id', id)
    if (error) throw error
  }

  async function deleteEvent(id: string) {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) throw error
  }

  return { events, loading, createEvent, updateEvent, deleteEvent }
}
