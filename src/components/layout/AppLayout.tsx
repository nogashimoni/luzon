import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import ProjectCardList from '../sidebar/ProjectCardList'
import CommandBar from '../sidebar/CommandBar'
import CalendarView from '../calendar/CalendarView'
import FinanceView from '../finance/FinanceView'
import { useProjects } from '../../hooks/useProjects'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { useUserContext } from '../../contexts/UserContext'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [mainView, setMainView] = useState<'calendar' | 'finance'>('calendar')
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

  const filteredEvents = events

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          footer={<CommandBar projects={projects} onUpdateProject={updateProject} onCreateEvent={createEvent} userId={user?.id ?? ''} />}
        >
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

        <main className="flex-1 overflow-hidden p-2 sm:p-4 flex flex-col gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden self-center bg-white shadow-sm">
            <button
              onClick={() => setMainView('calendar')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${mainView === 'calendar' ? 'bg-[#007aff] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setMainView('finance')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${mainView === 'finance' ? 'bg-[#007aff] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Finance
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {mainView === 'calendar' ? (
              <CalendarView
                events={filteredEvents}
                projects={projects}
                selectedProjectId={selectedProjectId}
                userId={user?.id ?? ''}
                onCreateEvent={createEvent}
                onUpdateEvent={updateEvent}
                onDeleteEvent={deleteEvent}
                onCreateProject={createProject}
              />
            ) : (
              <FinanceView projects={projects} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
