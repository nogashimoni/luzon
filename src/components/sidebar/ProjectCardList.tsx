import { useState } from 'react'
import type { Project, CalendarEvent, ProjectStatus, ProjectType } from '../../types'
import ProjectCard from './ProjectCard'
import ProjectPanel from './ProjectPanel'
import ProjectForm from './ProjectForm'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'

interface ProjectCardListProps {
  projects: Project[]
  events: CalendarEvent[]
  loading: boolean
  selectedProjectId: string | null
  onSelectProject: (id: string) => void
  onCreateProject: (data: { title: string; color: string; description?: string; deadline?: string | null; project_type?: ProjectType; created_by: string }) => Promise<Project>
  onUpdateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description' | 'status' | 'project_type' | 'deadline' | 'sort_order' | 'hours_tracking' | 'hours_reset_at'>>) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
  userId: string
}

const STATUS_SECTIONS = [
  { id: 'in_progress' as ProjectStatus, title: 'In Progress' },
  { id: 'waiting_payment' as ProjectStatus, title: 'Waiting for Payment' },
  { id: 'completed' as ProjectStatus, title: 'Completed & Paid' },
]

function sortProjectsInSection(projects: Project[]): Project[] {
  const hasManualOrder = projects.some((p) => p.sort_order !== null)
  if (hasManualOrder) {
    return [...projects].sort((a, b) => {
      if (a.sort_order === null && b.sort_order === null) return 0
      if (a.sort_order === null) return 1
      if (b.sort_order === null) return -1
      return a.sort_order - b.sort_order
    })
  }
  return [...projects].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  })
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
  const [typeFilter, setTypeFilter] = useState<'all' | ProjectType>('all')
  const [panelProjectId, setPanelProjectId] = useState<string | null>(null)
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
  const [draggedFromSection, setDraggedFromSection] = useState<ProjectStatus | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)

  if (loading) return <LoadingSpinner />

  const panelProject = panelProjectId ? projects.find((p) => p.id === panelProjectId) ?? null : null

  const filteredProjects = typeFilter === 'all'
    ? projects
    : projects.filter((p) => (p.project_type ?? 'one_time') === typeFilter)

  const projectsByStatus = STATUS_SECTIONS.map((section) => ({
    ...section,
    projects: sortProjectsInSection(
      filteredProjects.filter((p) => (p.status || 'in_progress') === section.id)
    ),
  }))

  function handleDragStart(projectId: string, sectionId: ProjectStatus) {
    setDraggedProjectId(projectId)
    setDraggedFromSection(sectionId)
  }

  function handleDragEnd() {
    setDraggedProjectId(null)
    setDraggedFromSection(null)
    setDragOverProjectId(null)
  }

  async function handleDropOnProject(targetProjectId: string, targetSectionId: ProjectStatus) {
    if (!draggedProjectId || draggedProjectId === targetProjectId) return

    if (draggedFromSection === targetSectionId) {
      const sectionProjects = projectsByStatus.find((s) => s.id === targetSectionId)?.projects ?? []
      const reordered = [...sectionProjects]
      const fromIndex = reordered.findIndex((p) => p.id === draggedProjectId)
      const toIndex = reordered.findIndex((p) => p.id === targetProjectId)
      if (fromIndex === -1 || toIndex === -1) return
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)
      await Promise.all(reordered.map((p, i) => onUpdateProject(p.id, { sort_order: i + 1 })))
    } else {
      await onUpdateProject(draggedProjectId, { status: targetSectionId })
    }
    handleDragEnd()
  }

  async function handleDropOnSection(sectionId: ProjectStatus) {
    if (!draggedProjectId) return
    if (dragOverProjectId) return
    if (draggedFromSection !== sectionId) {
      await onUpdateProject(draggedProjectId, { status: sectionId })
    }
    handleDragEnd()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Projects</h3>
        <Button size="sm" onClick={() => setCreating(true)}>+ New</Button>
      </div>

      <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-1">
        {([['all', 'All'], ['retainer', 'Retainer'], ['one_time', 'One-time']] as [string, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTypeFilter(val as 'all' | ProjectType)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${typeFilter === val ? 'bg-[#007aff] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
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
          onDrop={() => handleDropOnSection(section.id)}
          onDragOver={(e) => e.preventDefault()}
        >
          <h4 className="text-xs font-semibold text-gray-600 px-2 py-1 bg-gray-50 rounded-lg">
            {section.title}
          </h4>
          <div className="space-y-2 min-h-[60px] rounded-lg">
            {section.projects.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-400 bg-gray-50/50 rounded-lg border-2 border-dashed border-gray-200">
                Drag projects here
              </div>
            ) : (
              section.projects.map((project) => (
                <div
                  key={project.id}
                  draggable
                  onDragStart={() => handleDragStart(project.id, section.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => { e.preventDefault(); if (project.id !== draggedProjectId) setDragOverProjectId(project.id) }}
                  onDragLeave={() => setDragOverProjectId(null)}
                  onDrop={() => handleDropOnProject(project.id, section.id)}
                  className={`cursor-move transition-all ${
                    draggedProjectId === project.id ? 'opacity-40' : ''
                  } ${
                    dragOverProjectId === project.id && draggedProjectId !== project.id
                      ? 'ring-2 ring-[#007aff] ring-offset-1 rounded-xl'
                      : ''
                  }`}
                >
                  <ProjectCard
                    project={project}
                    events={events}
                    selected={project.id === selectedProjectId}
                    onSelect={() => onSelectProject(project.id)}
                    onOpenPanel={() => setPanelProjectId(project.id)}
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
          onSubmit={async (data) => { await onCreateProject({ ...data, created_by: userId }) }}
        />
      )}

      {panelProject && (
        <ProjectPanel
          project={panelProject}
          events={events}
          onClose={() => setPanelProjectId(null)}
          onUpdate={onUpdateProject}
          onDelete={onDeleteProject}
        />
      )}
    </div>
  )
}
