import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import type { Project } from '../../types'
import { format } from 'date-fns'
import { useUsers } from '../../hooks/useUsers'
import { PROJECT_COLORS } from '../../utils/colors'
import ColorWheelPicker from '../ui/ColorWheelPicker'

interface EventModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    start_time: string
    end_time: string
    project_id: string | null
    all_day: boolean
    exclude_from_hours: boolean
    description?: string | null
    assignee_user_ids?: string[]
  }) => Promise<void>
  onDelete?: () => Promise<void>
  onCreateProject?: (project: { title: string; color: string; description?: string; deadline?: string; created_by: string }) => Promise<Project>
  projects: Project[]
  initialData?: {
    id?: string
    title?: string
    start: Date
    end: Date
    allDay?: boolean
    exclude_from_hours?: boolean
    project_id?: string | null
    description?: string | null
    assignee_user_ids?: string[]
  }
  selectedProjectId: string | null
  userId: string
}

export default function EventModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  onCreateProject,
  projects,
  initialData,
  selectedProjectId,
  userId,
}: EventModalProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [startDate, setStartDate] = useState(
    format(initialData?.start ?? new Date(), "yyyy-MM-dd'T'HH:mm")
  )
  const [endDate, setEndDate] = useState(
    format(initialData?.end ?? new Date(), "yyyy-MM-dd'T'HH:mm")
  )
  const [projectId, setProjectId] = useState<string>(
    initialData?.project_id ?? selectedProjectId ?? ''
  )
  const [allDay, setAllDay] = useState(initialData?.allDay ?? false)
  const [excludeFromHours, setExcludeFromHours] = useState(initialData?.exclude_from_hours ?? false)
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    initialData?.assignee_user_ids ?? []
  )

  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0])
  const [creatingProjectLoading, setCreatingProjectLoading] = useState(false)
  const [newProjectError, setNewProjectError] = useState('')

  const { users } = useUsers()
  const isEditing = !!initialData?.id

  async function handleCreateProject() {
    if (!newProjectTitle.trim()) {
      setNewProjectError('Project name is required')
      return
    }
    if (!onCreateProject) return
    setCreatingProjectLoading(true)
    setNewProjectError('')
    try {
      const newProject = await onCreateProject({
        title: newProjectTitle.trim(),
        color: newProjectColor,
        created_by: userId,
      })
      setProjectId(newProject.id)
      setCreatingProject(false)
      setNewProjectTitle('')
      setNewProjectColor(PROJECT_COLORS[0])
    } catch {
      setNewProjectError('Failed to create project')
    } finally {
      setCreatingProjectLoading(false)
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Event title is required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        title: title.trim(),
        start_time: new Date(startDate).toISOString(),
        end_time: new Date(endDate).toISOString(),
        project_id: projectId || null,
        all_day: allDay,
        exclude_from_hours: excludeFromHours,
        description: description.trim() || null,
        assignee_user_ids: selectedUserIds,
      })
      onClose()
    } catch {
      setError('Failed to save event')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Event' : 'New Event'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            autoFocus
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">Project</label>
          {!creatingProject ? (
            <div className="flex gap-2">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 bg-white transition-all"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {onCreateProject && (
                <button
                  type="button"
                  onClick={() => setCreatingProject(true)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-black hover:bg-gray-50 transition-all text-sm font-medium whitespace-nowrap"
                >
                  + New
                </button>
              )}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl p-3 space-y-3">
              <input
                type="text"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Project name"
                autoFocus
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-sm text-gray-900 transition-all"
              />
              <ColorWheelPicker value={newProjectColor} onChange={setNewProjectColor} />
              {newProjectError && <p className="text-xs text-red-500">{newProjectError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCreatingProject(false); setNewProjectTitle(''); setNewProjectError('') }}
                  className="flex-1 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateProject}
                  disabled={creatingProjectLoading}
                  className="flex-1 py-1.5 text-sm text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-all"
                >
                  {creatingProjectLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight">
            Assign to (select 1 or 2 users)
          </label>
          <div className="flex gap-3">
            {users.map((user) => (
              <Avatar
                key={user.id}
                user={user}
                size="lg"
                clickable
                selected={selectedUserIds.includes(user.id)}
                onClick={() => toggleUserSelection(user.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="rounded border-gray-300 text-[#007aff] focus:ring-[#007aff]"
          />
          <label htmlFor="allDay" className="text-sm font-medium text-gray-700 tracking-tight">All day</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="excludeFromHours"
            checked={excludeFromHours}
            onChange={(e) => setExcludeFromHours(e.target.checked)}
            className="rounded border-gray-300 focus:ring-gray-400"
          />
          <label htmlFor="excludeFromHours" className="text-sm font-medium text-gray-700 tracking-tight">Don't count hours</label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">Start</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? startDate.split('T')[0] : startDate}
              onChange={(e) => setStartDate(allDay ? `${e.target.value}T00:00` : e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 text-sm transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">End</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? endDate.split('T')[0] : endDate}
              onChange={(e) => setEndDate(allDay ? `${e.target.value}T23:59` : e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 text-sm transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Event details..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 resize-none transition-all"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 justify-between">
          <div>
            {isEditing && onDelete && (
              <Button
                variant="danger"
                type="button"
                onClick={async () => {
                  await onDelete()
                  onClose()
                }}
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : isEditing ? 'Save' : 'Create Event'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
