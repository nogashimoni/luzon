import { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import type { EventClickArg, DateSelectArg, EventDropArg, EventContentArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import type { CalendarEvent, Project } from '../../types'
import EventModal from './EventModal'

interface CalendarViewProps {
  events: CalendarEvent[]
  projects: Project[]
  selectedProjectId: string | null
  userId: string
  onCreateEvent: (event: {
    title: string
    start_time: string
    end_time: string
    project_id?: string | null
    user_id: string
    assignee_user_ids?: string[]
    all_day?: boolean
    color?: string | null
    description?: string | null
  }) => Promise<CalendarEvent>
  onUpdateEvent: (
    id: string,
    updates: Partial<Pick<CalendarEvent, 'title' | 'start_time' | 'end_time' | 'project_id' | 'all_day' | 'color' | 'description'>> & {
      assignee_user_ids?: string[]
    }
  ) => Promise<void>
  onDeleteEvent: (id: string) => Promise<void>
}

export default function CalendarView({
  events,
  projects,
  selectedProjectId,
  userId,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: CalendarViewProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [creating, setCreating] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const calendarRef = useRef<FullCalendar>(null)

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      const api = calendarRef.current?.getApi()
      if (api) {
        api.changeView(mobile ? 'listWeek' : 'timeGridWeek')
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const projectMap = new Map(projects.map((p) => [p.id, p]))

  const fcEvents = events.map((event) => {
    const project = event.project_id ? projectMap.get(event.project_id) : null
    return {
      id: event.id,
      title: event.title,
      start: event.start_time,
      end: event.end_time,
      allDay: event.all_day,
      backgroundColor: project?.color ?? event.color ?? '#6B7280',
      borderColor: 'transparent',
      extendedProps: { calendarEvent: event },
    }
  })

  function handleDateSelect(info: DateSelectArg) {
    setCreating({ start: info.start, end: info.end, allDay: info.allDay })
  }

  function handleEventClick(info: EventClickArg) {
    const calEvent = info.event.extendedProps.calendarEvent as CalendarEvent
    setEditing(calEvent)
  }

  async function handleEventDrop(info: EventDropArg) {
    const calEvent = info.event.extendedProps.calendarEvent as CalendarEvent
    await onUpdateEvent(calEvent.id, {
      start_time: info.event.start!.toISOString(),
      end_time: info.event.end!.toISOString(),
      all_day: info.event.allDay,
    })
  }

  async function handleEventResize(info: EventResizeDoneArg) {
    const calEvent = info.event.extendedProps.calendarEvent as CalendarEvent
    await onUpdateEvent(calEvent.id, {
      start_time: info.event.start!.toISOString(),
      end_time: info.event.end!.toISOString(),
    })
  }

  function renderEventContent(eventInfo: EventContentArg) {
    const calEvent = eventInfo.event.extendedProps.calendarEvent as CalendarEvent
    const assignees = calEvent.assignees || []

    return (
      <div className="p-1 overflow-hidden">
        <div className="flex items-center gap-1">
          {assignees.length > 0 && (
            <div className="flex -space-x-1">
              {assignees.slice(0, 2).map((assignee) => {
                const user = assignee.user
                if (!user) return null

                const firstLetter = user.name.charAt(0).toUpperCase()
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500']
                const colorIndex = user.id.charCodeAt(0) % colors.length
                const colorClass = colors[colorIndex]

                return (
                  <div
                    key={assignee.id}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-white ${colorClass}`}
                    title={user.name}
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      firstLetter
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="text-xs font-medium truncate">{eventInfo.event.title}</div>
        </div>
        {eventInfo.timeText && (
          <div className="text-xs opacity-75">{eventInfo.timeText}</div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView={isMobile ? 'listWeek' : 'timeGridWeek'}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: isMobile
            ? 'listWeek,timeGridDay'
            : 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        }}
        height="100%"
        events={fcEvents}
        editable
        selectable
        selectMirror
        dayMaxEvents
        nowIndicator
        select={handleDateSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot
        eventDisplay="block"
        eventContent={renderEventContent}
        longPressDelay={200}
      />

      {/* Create event modal */}
      {creating && (
        <EventModal
          open
          onClose={() => setCreating(null)}
          projects={projects}
          selectedProjectId={selectedProjectId}
          initialData={{
            start: creating.start,
            end: creating.end,
            allDay: creating.allDay,
          }}
          onSubmit={async (data) => {
            const project = data.project_id ? projectMap.get(data.project_id) : null
            await onCreateEvent({
              title: data.title,
              start_time: data.start_time,
              end_time: data.end_time,
              project_id: data.project_id,
              user_id: userId,
              assignee_user_ids: data.assignee_user_ids,
              all_day: data.all_day,
              color: project?.color ?? null,
              description: data.description,
            })
          }}
        />
      )}

      {/* Edit event modal */}
      {editing && (
        <EventModal
          open
          onClose={() => setEditing(null)}
          projects={projects}
          selectedProjectId={selectedProjectId}
          initialData={{
            id: editing.id,
            title: editing.title,
            start: new Date(editing.start_time),
            end: new Date(editing.end_time),
            allDay: editing.all_day,
            project_id: editing.project_id,
            description: editing.description,
            assignee_user_ids: editing.assignees?.map(a => a.user_id) ?? [],
          }}
          onSubmit={async (data) => {
            const project = data.project_id ? projectMap.get(data.project_id) : null
            await onUpdateEvent(editing.id, {
              title: data.title,
              start_time: data.start_time,
              end_time: data.end_time,
              project_id: data.project_id,
              assignee_user_ids: data.assignee_user_ids,
              all_day: data.all_day,
              color: project?.color ?? null,
              description: data.description,
            })
          }}
          onDelete={async () => {
            await onDeleteEvent(editing.id)
          }}
        />
      )}
    </div>
  )
}
