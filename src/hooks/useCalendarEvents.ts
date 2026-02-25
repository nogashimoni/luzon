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
          console.log('Calendar event changed:', payload)
          // Refetch all events when calendar_events changes
          fetchEvents()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_assignees' },
        (payload) => {
          console.log('Event assignee changed:', payload)
          // Refetch all events when assignees change
          fetchEvents()
        }
      )
      .subscribe((status) => {
        console.log('Supabase subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchEvents() {
    const { data } = await supabase
      .from('calendar_events')
      .select(`
        *,
        assignees:event_assignees(
          id,
          event_id,
          user_id,
          created_at,
          user:users(*)
        )
      `)
      .order('start_time', { ascending: true })
    if (data) setEvents(data as CalendarEvent[])
    setLoading(false)
  }

  async function createEvent(event: {
    title: string
    start_time: string
    end_time: string
    project_id?: string | null
    user_id: string
    assignee_user_ids?: string[] // New: array of user IDs to assign
    all_day?: boolean
    color?: string | null
    description?: string | null
  }) {
    const { assignee_user_ids, ...eventData } = event

    // Create the calendar event
    const { data: newEvent, error } = await supabase
      .from('calendar_events')
      .insert(eventData)
      .select()
      .single()

    if (error) throw error

    // Create assignee relationships if provided
    if (assignee_user_ids && assignee_user_ids.length > 0) {
      const assignees = assignee_user_ids.map(userId => ({
        event_id: newEvent.id,
        user_id: userId,
      }))

      const { error: assigneeError } = await supabase
        .from('event_assignees')
        .insert(assignees)

      if (assigneeError) throw assigneeError
    }

    // Fetch the complete event with assignees
    const { data: completeEvent } = await supabase
      .from('calendar_events')
      .select(`
        *,
        assignees:event_assignees(
          id,
          event_id,
          user_id,
          created_at,
          user:users(*)
        )
      `)
      .eq('id', newEvent.id)
      .single()

    // Manually refetch all events to update the UI immediately
    fetchEvents()

    return completeEvent as CalendarEvent
  }

  async function updateEvent(
    id: string,
    updates: Partial<Pick<CalendarEvent, 'title' | 'start_time' | 'end_time' | 'project_id' | 'all_day' | 'color' | 'description'>> & {
      assignee_user_ids?: string[]
    }
  ) {
    const { assignee_user_ids, ...eventUpdates } = updates

    // Update the calendar event
    const { error } = await supabase.from('calendar_events').update(eventUpdates).eq('id', id)
    if (error) throw error

    // Update assignees if provided
    if (assignee_user_ids !== undefined) {
      // Delete existing assignees
      await supabase.from('event_assignees').delete().eq('event_id', id)

      // Insert new assignees
      if (assignee_user_ids.length > 0) {
        const assignees = assignee_user_ids.map(userId => ({
          event_id: id,
          user_id: userId,
        }))

        const { error: assigneeError } = await supabase
          .from('event_assignees')
          .insert(assignees)

        if (assigneeError) throw assigneeError
      }
    }

    // Manually refetch all events to update the UI immediately
    fetchEvents()
  }

  async function deleteEvent(id: string) {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) throw error

    // Manually refetch all events to update the UI immediately
    fetchEvents()
  }

  return { events, loading, createEvent, updateEvent, deleteEvent }
}
