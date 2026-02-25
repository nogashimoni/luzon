import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import ColorPicker from './ColorPicker'
import type { Project } from '../../types'
import { PROJECT_COLORS } from '../../utils/colors'

interface ProjectFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { title: string; color: string; description?: string }) => Promise<void>
  initialData?: Project | null
}

export default function ProjectForm({ open, onClose, onSubmit, initialData }: ProjectFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [color, setColor] = useState(initialData?.color ?? PROJECT_COLORS[0])
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Project name is required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ title: title.trim(), color, description: description.trim() || undefined })
      onClose()
    } catch {
      setError('Failed to save project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initialData ? 'Edit Project' : 'New Project'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Name
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Kitchen Renovation"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color
          </label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief project description..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
