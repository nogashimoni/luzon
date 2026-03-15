import { useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Project } from '../../types'

interface CommandBarProps {
  projects: Project[]
  onUpdateProject: (id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description' | 'status' | 'project_type' | 'deadline' | 'sort_order'>>) => Promise<void>
  userId: string
}

type ResultState = { ok: boolean; message: string } | null

const HELP_TEXT = `Commands:
  task [project]: [text]      → add task
  done [project]: [text]      → complete task
  deadline [project]: [date]  → set deadline (YYYY-MM-DD)
  note [project]: [text]      → update notes
  status [project]: [status]  → in_progress | waiting | done`

function findProject(query: string, projects: Project[]): Project | null {
  const q = query.toLowerCase().trim()
  if (!q) return null
  return (
    projects.find((p) => p.title.toLowerCase() === q) ??
    projects.find((p) => p.title.toLowerCase().startsWith(q)) ??
    projects.find((p) => p.title.toLowerCase().includes(q)) ??
    null
  )
}

export default function CommandBar({ projects, onUpdateProject, userId }: CommandBarProps) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ResultState>(null)
  const [showHelp, setShowHelp] = useState(false)

  async function execute(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return

    if (trimmed.toLowerCase() === 'help') {
      setShowHelp(true)
      setInput('')
      setResult(null)
      return
    }

    setShowHelp(false)

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) {
      setResult({ ok: false, message: 'Missing colon. Try: task Project: do something' })
      return
    }

    const beforeColon = trimmed.slice(0, colonIdx).trim()
    const value = trimmed.slice(colonIdx + 1).trim()
    const spaceIdx = beforeColon.indexOf(' ')

    if (spaceIdx === -1) {
      setResult({ ok: false, message: `Unknown command "${beforeColon}". Type "help" for commands.` })
      return
    }

    const command = beforeColon.slice(0, spaceIdx).toLowerCase()
    const projectQuery = beforeColon.slice(spaceIdx + 1)
    const project = findProject(projectQuery, projects)

    if (!project) {
      setResult({ ok: false, message: `Project "${projectQuery}" not found.` })
      return
    }

    try {
      switch (command) {
        case 'task': {
          if (!value) { setResult({ ok: false, message: 'Task text is required.' }); return }
          const { data: existing } = await supabase
            .from('project_checklist_items')
            .select('item_order')
            .eq('project_id', project.id)
            .order('item_order', { ascending: false })
            .limit(1)
          const maxOrder = existing?.[0]?.item_order ?? 0
          await supabase.from('project_checklist_items').insert({ project_id: project.id, text: value, completed: false, item_order: maxOrder + 1 })
          setResult({ ok: true, message: `Added task "${value}" to ${project.title}` })
          break
        }

        case 'done': {
          if (!value) { setResult({ ok: false, message: 'Task text is required.' }); return }
          const { data: items } = await supabase.from('project_checklist_items').select('*').eq('project_id', project.id)
          const match = items?.find((i) => i.text.toLowerCase().includes(value.toLowerCase()))
          if (!match) { setResult({ ok: false, message: `Task "${value}" not found in ${project.title}.` }); return }
          await supabase.from('project_checklist_items').update({ completed: true }).eq('id', match.id)
          setResult({ ok: true, message: `Marked "${match.text}" as done in ${project.title}` })
          break
        }

        case 'deadline': {
          if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            setResult({ ok: false, message: 'Date must be YYYY-MM-DD format.' }); return
          }
          await onUpdateProject(project.id, { deadline: value || null })
          setResult({ ok: true, message: value ? `Deadline set for ${project.title}: ${value}` : `Deadline removed from ${project.title}` })
          break
        }

        case 'note': {
          if (!value) { setResult({ ok: false, message: 'Note text is required.' }); return }
          const { data: existing } = await supabase.from('project_notes').select('*').eq('project_id', project.id).limit(1).single()
          if (existing) {
            await supabase.from('project_notes').update({ content: value, updated_by: userId }).eq('id', existing.id)
          } else {
            await supabase.from('project_notes').insert({ project_id: project.id, content: value, updated_by: userId })
          }
          setResult({ ok: true, message: `Notes updated for ${project.title}` })
          break
        }

        case 'status': {
          const statusMap: Record<string, string> = {
            'in_progress': 'in_progress', 'progress': 'in_progress', 'active': 'in_progress',
            'waiting': 'waiting_payment', 'waiting_payment': 'waiting_payment', 'payment': 'waiting_payment',
            'done': 'completed', 'completed': 'completed', 'complete': 'completed',
          }
          const mapped = statusMap[value.toLowerCase()]
          if (!mapped) { setResult({ ok: false, message: `Unknown status "${value}". Use: in_progress, waiting, done.` }); return }
          await onUpdateProject(project.id, { status: mapped as Project['status'] })
          setResult({ ok: true, message: `${project.title} → ${mapped.replace('_', ' ')}` })
          break
        }

        default:
          setResult({ ok: false, message: `Unknown command "${command}". Type "help".` })
      }
    } catch {
      setResult({ ok: false, message: 'Something went wrong. Try again.' })
    }

    setInput('')
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/80">
      {/* Help text */}
      {showHelp && (
        <div className="px-4 pt-3 pb-1">
          <pre className="text-xs text-gray-500 whitespace-pre-wrap font-mono leading-relaxed">{HELP_TEXT}</pre>
          <button onClick={() => setShowHelp(false)} className="text-xs text-[#007aff] mt-1">Close</button>
        </div>
      )}

      {/* Result feedback */}
      {result && !showHelp && (
        <div className={`px-4 pt-2 pb-1 text-xs font-medium ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
          {result.ok ? '✓' : '✕'} {result.message}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#007aff]/20 focus-within:border-[#007aff] transition-all">
          <span className="text-gray-400 text-sm">{'>'}</span>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (result) setResult(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') execute(input); if (e.key === 'Escape') { setInput(''); setResult(null); setShowHelp(false) } }}
            placeholder='task Project: buy materials'
            className="flex-1 text-sm text-gray-900 outline-none bg-transparent placeholder-gray-400"
          />
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-[#007aff] hover:border-[#007aff] transition-colors text-sm font-bold"
        >
          ?
        </button>
      </div>
    </div>
  )
}
