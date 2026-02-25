import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import ProjectCardList from '../sidebar/ProjectCardList'
import CalendarView from '../calendar/CalendarView'
import { useProjects } from '../../hooks/useProjects'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { useUserContext } from '../../contexts/UserContext'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const { user } = useUserContext()
  const [searchParams] = useSearchParams()

  const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects()
  const { events, createEvent, updateEvent, deleteEvent } = useCalendarEvents()

  // Handle shared project link
  useEffect(() => {
    const projectId = searchParams.get('project')
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [searchParams])

  const filteredEvents = selectedProjectId
    ? events.filter((e) => e.project_id === selectedProjectId)
    : events

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
          <ProjectCardList
            projects={projects}
            events={events}
            loading={projectsLoading}
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => {
              setSelectedProjectId(id === selectedProjectId ? null : id)
              setSidebarOpen(false)
            }}
            onCreateProject={createProject}
            onUpdateProject={updateProject}
            onDeleteProject={deleteProject}
            userId={user?.id ?? ''}
          />
        </Sidebar>

        <main className="flex-1 overflow-hidden p-2 sm:p-4">
          <CalendarView
            events={filteredEvents}
            projects={projects}
            selectedProjectId={selectedProjectId}
            userId={user?.id ?? ''}
            onCreateEvent={createEvent}
            onUpdateEvent={updateEvent}
            onDeleteEvent={deleteEvent}
          />
        </main>
      </div>
    </div>
  )
}
