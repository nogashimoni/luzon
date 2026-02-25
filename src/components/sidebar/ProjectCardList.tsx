import { useState } from 'react'
import type { Project, CalendarEvent } from '../../types'
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
  onUpdateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description'>>) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
  userId: string
}

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

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
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

      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          events={events}
          selected={project.id === selectedProjectId}
          onSelect={() => onSelectProject(project.id)}
          onUpdate={onUpdateProject}
          onDelete={onDeleteProject}
        />
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
