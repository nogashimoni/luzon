import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import ColorWheelPicker from '../ui/ColorWheelPicker'
import type { Project } from '../../types'
import { PROJECT_COLORS } from '../../utils/colors'

interface ProjectFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { title: string; color: string; description?: string; deadline?: string | null; project_type: string }) => Promise<void>
  initialData?: Project | null
}

export default function ProjectForm({ open, onClose, onSubmit, initialData }: ProjectFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [color, setColor] = useState(initialData?.color ?? PROJECT_COLORS[0])
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [deadline, setDeadline] = useState(initialData?.deadline ?? '')
  const [projectType, setProjectType] = useState<'retainer' | 'one_time'>(initialData?.project_type ?? 'one_time')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setTitle(initialData?.title ?? '')
    setColor(initialData?.color ?? PROJECT_COLORS[0])
    setDescription(initialData?.description ?? '')
    setDeadline(initialData?.deadline ?? '')
    setProjectType(initialData?.project_type ?? 'one_time')
  }, [initialData?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Project name is required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ title: title.trim(), color, description: description.trim() || undefined, deadline: deadline || null, project_type: projectType })
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
          <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">
            Project Name
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Kitchen Renovation"
            autoFocus
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight">
            Project Type
          </label>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setProjectType('one_time')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${projectType === 'one_time' ? 'bg-[#007aff] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              One-time
            </button>
            <button
              type="button"
              onClick={() => setProjectType('retainer')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${projectType === 'retainer' ? 'bg-[#007aff] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Retainer
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief project description..."
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 resize-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">
            Deadline (optional)
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2.5 tracking-tight">
            Color
          </label>
          <ColorWheelPicker value={color} onChange={setColor} />
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
