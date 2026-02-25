import { useState, useEffect } from 'react'
import { useProjectNotes } from '../../hooks/useProjectNotes'
import { useUserContext } from '../../contexts/UserContext'

interface ProjectNotesProps {
  projectId: string
}

export default function ProjectNotes({ projectId }: ProjectNotesProps) {
  const { note, loading, saveNote } = useProjectNotes(projectId)
  const { user } = useUserContext()
  const [content, setContent] = useState('')

  useEffect(() => {
    if (note) setContent(note.content)
  }, [note])

  function handleChange(value: string) {
    setContent(value)
    if (user) saveNote(value, user.id)
  }

  if (loading) {
    return <div className="text-xs text-gray-400 py-1">Loading notes...</div>
  }

  return (
    <textarea
      value={content}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Add notes..."
      rows={3}
      className="w-full text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-gray-400"
    />
  )
}
