import { useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Project, ProjectStatus, ProjectType } from '../../types'

interface CommandBarProps {
  projects: Project[]
  onUpdateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description' | 'status' | 'project_type' | 'deadline' | 'sort_order'>>) => Promise<void>
  onCreateEvent?: (event: {
    title: string
    start_time: string
    end_time: string
    project_id?: string | null
    user_id: string
    all_day?: boolean
  }) => Promise<unknown>
  userId: string
}

type AIAction = {
  action: string
  project_id?: string
  project_name?: string
  task_text?: string
  deadline_date?: string | null
  note_content?: string
  status?: string
  project_type?: string
  event_title?: string
  event_date?: string
  event_start_time?: string
  event_end_time?: string
  event_all_day?: boolean
  message?: string
}

type ResultState = { ok: boolean; message: string } | null

function findProject(nameHint: string | undefined, id: string | undefined, projects: Project[]): Project | null {
  if (id) {
    const byId = projects.find((p) => p.id === id)
    if (byId) return byId
  }
  if (!nameHint) return null
  const q = nameHint.toLowerCase().trim()
  return (
    projects.find((p) => p.title.toLowerCase() === q) ??
    projects.find((p) => p.title.toLowerCase().startsWith(q)) ??
    projects.find((p) => p.title.toLowerCase().includes(q)) ??
    null
  )
}

async function executeAction(
  action: AIAction,
  projects: Project[],
  onUpdateProject: CommandBarProps['onUpdateProject'],
  onCreateEvent: CommandBarProps['onCreateEvent'],
  userId: string
): Promise<{ ok: boolean; message: string }> {
  const project = findProject(action.project_name, action.project_id, projects)

  switch (action.action) {
    case 'add_task': {
      if (!project) return { ok: false, message: `Project not found: "${action.project_name}"` }
      if (!action.task_text) return { ok: false, message: 'No task text provided.' }
      const { data: existing } = await supabase
        .from('project_checklist_items')
        .select('item_order')
        .eq('project_id', project.id)
        .order('item_order', { ascending: false })
        .limit(1)
      const maxOrder = (existing?.[0]?.item_order ?? 0)
      await supabase.from('project_checklist_items').insert({
        project_id: project.id,
        text: action.task_text,
        completed: false,
        item_order: maxOrder + 1,
      })
      return { ok: true, message: `Added task "${action.task_text}" to ${project.title}` }
    }

    case 'complete_task': {
      if (!project) return { ok: false, message: `Project not found: "${action.project_name}"` }
      if (!action.task_text) return { ok: false, message: 'No task text provided.' }
      const { data: items } = await supabase
        .from('project_checklist_items')
        .select('*')
        .eq('project_id', project.id)
      const match = items?.find((i) => i.text.toLowerCase().includes(action.task_text!.toLowerCase()))
      if (!match) return { ok: false, message: `Task "${action.task_text}" not found in ${project.title}.` }
      await supabase.from('project_checklist_items').update({ completed: true }).eq('id', match.id)
      return { ok: true, message: `Marked "${match.text}" as done in ${project.title}` }
    }

    case 'set_deadline': {
      if (!project) return { ok: false, message: `Project not found: "${action.project_name}"` }
      await onUpdateProject(project.id, { deadline: action.deadline_date ?? null })
      return {
        ok: true,
        message: action.deadline_date
          ? `Deadline for ${project.title} set to ${action.deadline_date}`
          : `Deadline removed from ${project.title}`,
      }
    }

    case 'update_note': {
      if (!project) return { ok: false, message: `Project not found: "${action.project_name}"` }
      if (!action.note_content) return { ok: false, message: 'No note content provided.' }
      const { data: existing } = await supabase
        .from('project_notes')
        .select('*')
        .eq('project_id', project.id)
        .limit(1)
        .single()
      if (existing) {
        await supabase.from('project_notes').update({ content: action.note_content, updated_by: userId }).eq('id', existing.id)
      } else {
        await supabase.from('project_notes').insert({ project_id: project.id, content: action.note_content, updated_by: userId })
      }
      return { ok: true, message: `Notes updated for ${project.title}` }
    }

    case 'change_status': {
      if (!project) return { ok: false, message: `Project not found: "${action.project_name}"` }
      if (!action.status) return { ok: false, message: 'No status provided.' }
      await onUpdateProject(project.id, { status: action.status as ProjectStatus })
      return { ok: true, message: `${project.title} → ${action.status.replace('_', ' ')}` }
    }

    case 'change_type': {
      if (!project) return { ok: false, message: `Project not found: "${action.project_name}"` }
      await onUpdateProject(project.id, { project_type: action.project_type as ProjectType })
      return { ok: true, message: `${project.title} changed to ${action.project_type === 'retainer' ? 'Retainer' : 'One-time'}` }
    }

    case 'create_event': {
      if (!onCreateEvent) return { ok: false, message: 'Event creation not available.' }
      if (!action.event_title || !action.event_date) return { ok: false, message: 'Event title and date are required.' }
      const allDay = action.event_all_day ?? !action.event_start_time
      const startTime = allDay
        ? `${action.event_date}T00:00:00`
        : `${action.event_date}T${action.event_start_time}:00`
      const endTime = allDay
        ? `${action.event_date}T23:59:59`
        : `${action.event_date}T${action.event_end_time ?? action.event_start_time}:00`
      await onCreateEvent({
        title: action.event_title,
        start_time: startTime,
        end_time: endTime,
        project_id: project?.id ?? null,
        user_id: userId,
        all_day: allDay,
      })
      const projectLabel = project ? ` (${project.title})` : ''
      return { ok: true, message: `Event "${action.event_title}" created on ${action.event_date}${projectLabel}` }
    }

    case 'message':
      return { ok: true, message: action.message ?? 'Done.' }

    default:
      return { ok: false, message: `Unknown action: ${action.action}` }
  }
}

export default function CommandBar({ projects, onUpdateProject, onCreateEvent, userId }: CommandBarProps) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ResultState>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    const text = input.trim()
    if (!text || loading) return

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/.netlify/functions/ai-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          projects: projects.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            project_type: p.project_type,
            deadline: p.deadline,
          })),
          currentDate: new Date().toISOString().slice(0, 10),
        }),
      })

      const action: AIAction = await response.json()
      const result = await executeAction(action, projects, onUpdateProject, onCreateEvent, userId)
      setResult(result)
      if (result.ok) setInput('')
    } catch {
      setResult({ ok: false, message: 'Failed to connect to AI. Check your network.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/80">
      {result && (
        <div className={`px-4 pt-2 pb-1 text-xs font-medium ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
          {result.ok ? '✓' : '✕'} {result.message}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#007aff]/20 focus-within:border-[#007aff] transition-all">
          {loading ? (
            <svg className="w-4 h-4 text-[#007aff] animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (result) setResult(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') { setInput(''); setResult(null) } }}
            placeholder="Ask AI to do anything…"
            disabled={loading}
            className="flex-1 text-sm text-gray-900 outline-none bg-transparent placeholder-gray-400 disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#007aff] text-white hover:bg-[#0062cc] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
