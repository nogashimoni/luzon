import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import type { Project } from '../types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()

    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProjects((prev) => [...prev, payload.new as Project])
          } else if (payload.eventType === 'UPDATE') {
            setProjects((prev) =>
              prev.map((p) => (p.id === (payload.new as Project).id ? (payload.new as Project) : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setProjects((prev) => prev.filter((p) => p.id !== (payload.old as Project).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchProjects() {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setProjects(data)
    setLoading(false)
  }

  async function createProject(project: { title: string; color: string; description?: string; created_by: string }) {
    const { data, error } = await supabase.from('projects').insert(project).select().single()
    if (error) throw error
    return data as Project
  }

  async function updateProject(id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description' | 'status'>>) {
    const { error } = await supabase.from('projects').update(updates).eq('id', id)
    if (error) throw error
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  }

  return { projects, loading, createProject, updateProject, deleteProject }
}
