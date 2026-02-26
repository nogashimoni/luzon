import { useState } from 'react'
import type { Project, CalendarEvent, ProjectStatus } from '../../types'
import ProjectCard from './ProjectCard'
import ProjectForm from './ProjectForm'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'

interface ProjectCardListProps {
  projects: Project[]
  events: CalendarEvent[]
  loading: boolean
  selectedProjectId: string | null
  onSelectProject: (id: string) => void
  onCreateProject: (data: { title: string; color: string; description?: string; created_by: string }) => Promise<Project>
  onUpdateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description' | 'status'>>) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
  userId: string
}

const STATUS_SECTIONS = [
  { id: 'in_progress' as ProjectStatus, title: '🔨 בעבודה', titleEn: 'In Progress' },
  { id: 'waiting_payment' as ProjectStatus, title: '⏳ מחכים לתשלום', titleEn: 'Waiting Payment' },
  { id: 'completed' as ProjectStatus, title: '✅ סיימנו ושולמו', titleEn: 'Completed' },
]

export default function ProjectCardList({
  projects,
  events,
  loading,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  userId,
}: ProjectCardListProps) {
  const [creating, setCreating] = useState(false)
  const [draggedProject, setDraggedProject] = useState<string | null>(null)

  if (loading) return <LoadingSpinner />

  const projectsByStatus = STATUS_SECTIONS.map(section => ({
    ...section,
    projects: projects.filter(p => (p.status || 'in_progress') === section.id)
  }))

  function handleDragStart(projectId: string) {
    setDraggedProject(projectId)
  }

  function handleDragEnd() {
    setDraggedProject(null)
  }

  async function handleDrop(status: ProjectStatus) {
    if (draggedProject) {
      await onUpdateProject(draggedProject, { status })
      setDraggedProject(null)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Projects
        </h3>
        <Button size="sm" onClick={() => setCreating(true)}>
          + New
        </Button>
      </div>

      {projects.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-2">No projects yet</p>
          <p className="text-xs text-gray-400">Create a project to start tracking hours</p>
        </div>
      )}

      {projectsByStatus.map((section) => (
        <div
          key={section.id}
          className="space-y-2"
          onDrop={() => handleDrop(section.id)}
          onDragOver={handleDragOver}
        >
          <h4 className="text-xs font-semibold text-gray-600 px-2 py-1 bg-gray-50 rounded-lg">
            {section.title}
          </h4>

          <div className="space-y-2 min-h-[60px] rounded-lg transition-colors">
            {section.projects.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-400 bg-gray-50/50 rounded-lg border-2 border-dashed border-gray-200">
                Drag projects here
              </div>
            ) : (
              section.projects.map((project) => (
                <div
                  key={project.id}
                  draggable
                  onDragStart={() => handleDragStart(project.id)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-move ${draggedProject === project.id ? 'opacity-50' : ''}`}
                >
                  <ProjectCard
                    project={project}
                    events={events}
                    selected={project.id === selectedProjectId}
                    onSelect={() => onSelectProject(project.id)}
                    onUpdate={onUpdateProject}
                    onDelete={onDeleteProject}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      ))}

      {creating && (
        <ProjectForm
          open={creating}
          onClose={() => setCreating(false)}
          onSubmit={async (data) => {
            await onCreateProject({ ...data, created_by: userId })
          }}
        />
      )}
    </div>
  )
}
