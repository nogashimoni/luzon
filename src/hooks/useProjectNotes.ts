import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../config/supabase'
import type { ProjectNote } from '../types'

export function useProjectNotes(projectId: string) {
  const [note, setNote] = useState<ProjectNote | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchNote()

    const channel = supabase
      .channel(`project-notes-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_notes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setNote(payload.new as ProjectNote)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [projectId])

  async function fetchNote() {
    const { data } = await supabase
      .from('project_notes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) setNote(data)
    setLoading(false)
  }

  const saveNote = useCallback(
    (content: string, userId: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        if (note) {
          await supabase
            .from('project_notes')
            .update({ content, updated_by: userId })
            .eq('id', note.id)
        } else {
          const { data } = await supabase
            .from('project_notes')
            .insert({ project_id: projectId, content, updated_by: userId })
            .select()
            .single()
          if (data) setNote(data)
        }
      }, 500)
    },
    [note, projectId]
  )

  return { note, loading, saveNote }
}
