import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import type { Project } from '../../types'
import { format } from 'date-fns'
import { useUsers } from '../../hooks/useUsers'

interface EventModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    start_time: string
    end_time: string
    project_id: string | null
    all_day: boolean
    description?: string | null
    assignee_user_ids?: string[]
  }) => Promise<void>
  onDelete?: () => Promise<void>
  projects: Project[]
  initialData?: {
    id?: string
    title?: string
    start: Date
    end: Date
    allDay?: boolean
    project_id?: string | null
    description?: string | null
    assignee_user_ids?: string[]
  }
  selectedProjectId: string | null
}

export default function EventModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  projects,
  initialData,
  selectedProjectId,
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
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    initialData?.assignee_user_ids ?? []
  )

  const { users } = useUsers()
  const isEditing = !!initialData?.id

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 bg-white"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
            className="rounded border-gray-300"
          />
          <label htmlFor="allDay" className="text-sm text-gray-700">All day</label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? startDate.split('T')[0] : startDate}
              onChange={(e) => setStartDate(allDay ? `${e.target.value}T00:00` : e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? endDate.split('T')[0] : endDate}
              onChange={(e) => setEndDate(allDay ? `${e.target.value}T23:59` : e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Event details..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 resize-none"
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
