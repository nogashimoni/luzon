import { useState } from 'react'
import type { Project, CalendarEvent } from '../../types'
import { calculateProjectHours, formatHours } from '../../utils/hours'
import { getContrastColor } from '../../utils/colors'
import ProjectNotes from './ProjectNotes'
import ProjectForm from './ProjectForm'
import ShareModal from './ShareModal'

interface ProjectCardProps {
  project: Project
  events: CalendarEvent[]
  selected: boolean
  onSelect: () => void
  onUpdate: (id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function ProjectCard({
  project,
  events,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const projectEvents = events.filter((e) => e.project_id === project.id)
  const hours = calculateProjectHours(projectEvents)

  return (
    <>
      <div
        className={`rounded-lg border transition-colors ${
          selected ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        {/* Header row */}
        <button
          onClick={onSelect}
          className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
        >
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">
              {project.title}
            </div>
            {project.description && (
              <div className="text-xs text-gray-500 truncate">{project.description}</div>
            )}
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: project.color,
              color: getContrastColor(project.color),
            }}
          >
            {formatHours(hours)}
          </span>
        </button>

        {/* Expand toggle */}
        <div className="px-3 pb-1 flex gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            {expanded ? 'Less' : 'More'}
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setSharing(true)}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Share
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Edit
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
          >
            Delete
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-gray-100 mt-1">
            <div className="text-xs text-gray-500 mb-2">
              {projectEvents.length} event{projectEvents.length !== 1 ? 's' : ''}
            </div>
            <ProjectNotes projectId={project.id} />
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="px-3 pb-3 border-t border-gray-100 mt-1 pt-2">
            <p className="text-xs text-gray-600 mb-2">
              Delete "{project.title}"? Events will be unassigned.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDelete(project.id)
                  setConfirmDelete(false)
                }}
                className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {editing && (
        <ProjectForm
          open={editing}
          onClose={() => setEditing(false)}
          initialData={project}
          onSubmit={async (data) => {
            await onUpdate(project.id, data)
          }}
        />
      )}

      <ShareModal
        open={sharing}
        onClose={() => setSharing(false)}
        projectId={project.id}
        projectTitle={project.title}
      />
    </>
  )
}
