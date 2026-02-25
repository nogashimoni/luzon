import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectTitle: string
}

export default function ShareModal({ open, onClose, projectId, projectTitle }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}?project=${projectId}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share Project">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Share <strong>{projectTitle}</strong> with collaborators. Anyone with this link can view and add events to the project.
        </p>

        <div className="flex gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 select-all"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button onClick={handleCopy} size="md">
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
