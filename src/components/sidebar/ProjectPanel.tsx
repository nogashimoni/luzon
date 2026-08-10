import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../config/supabase'
import type { Project, CalendarEvent, ChecklistItem, ProjectFinancials, ProjectHoursHistory, HoursTracking } from '../../types'
import { calculateProjectHours, formatHours, filterEventsForHours } from '../../utils/hours'
import { getContrastColor } from '../../utils/colors'
import ProjectForm from './ProjectForm'
import ProjectNotes from './ProjectNotes'
import Button from '../ui/Button'
import { usePayments } from '../../hooks/usePayments'

type Tab = 'tasks' | 'notes' | 'financials' | 'hours'

interface ProjectPanelProps {
  project: Project
  events: CalendarEvent[]
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description' | 'status' | 'project_type' | 'deadline' | 'sort_order' | 'hours_tracking' | 'hours_reset_at' | 'retainer_amount'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function formatDeadline(deadline: string): { label: string; color: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(deadline + 'T00:00:00')
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  let label: string
  if (diffDays < 0) label = `${Math.abs(diffDays)}d overdue`
  else if (diffDays === 0) label = 'Due today'
  else if (diffDays === 1) label = 'Due tomorrow'
  else if (diffDays <= 7) label = `${diffDays}d left`
  else label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const color = diffDays < 0 ? 'text-red-500' : diffDays <= 3 ? 'text-orange-500' : 'text-gray-500'
  return { label, color }
}


export default function ProjectPanel({ project, events, onClose, onUpdate, onDelete }: ProjectPanelProps) {
  const [tab, setTab] = useState<Tab>('tasks')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Checklist state
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [newItemText, setNewItemText] = useState('')
  const [checklistLoading, setChecklistLoading] = useState(true)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemText, setEditItemText] = useState('')
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  // Payments state
  const { payments, loading: paymentsLoading, addPayment, updatePayment, deletePayment, markPaid } = usePayments(project.id)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [newPayment, setNewPayment] = useState({ description: '', amount: '', work_deadline: '', due_date: '', invoice_ref: '' })
  const [paymentError, setPaymentError] = useState('')
  const [retainerAmountEdit, setRetainerAmountEdit] = useState(project.retainer_amount?.toString() ?? '')
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editPayment, setEditPayment] = useState({ description: '', amount: '', work_deadline: '', due_date: '', invoice_ref: '' })

  // Legacy financials (project_financials table)
  const [legacyMonths, setLegacyMonths] = useState<ProjectFinancials[]>([])
  const [editingLegacyId, setEditingLegacyId] = useState<string | null>(null)
  const [editLegacy, setEditLegacy] = useState({ income: '', expenses: '', notes: '', expected_date: '' })

  // Hours tracking state
  const [hoursHistory, setHoursHistory] = useState<ProjectHoursHistory[]>([])
  const [resetting, setResetting] = useState(false)


  const allProjectEvents = events.filter((e) => e.project_id === project.id)
  const projectEvents = filterEventsForHours(allProjectEvents, project)
  const hours = calculateProjectHours(projectEvents)

  useEffect(() => {
    fetchHoursHistory()
    const ch = supabase
      .channel(`panel-hours-history-${project.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_hours_history', filter: `project_id=eq.${project.id}` }, () => fetchHoursHistory())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [project.id])

  useEffect(() => {
    fetchChecklistItems()
    const ch = supabase
      .channel(`panel-checklist-${project.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_checklist_items', filter: `project_id=eq.${project.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') setItems((prev) => [...prev, payload.new as ChecklistItem].sort((a, b) => a.item_order - b.item_order))
        else if (payload.eventType === 'UPDATE') setItems((prev) => prev.map((i) => i.id === (payload.new as ChecklistItem).id ? payload.new as ChecklistItem : i).sort((a, b) => a.item_order - b.item_order))
        else if (payload.eventType === 'DELETE') setItems((prev) => prev.filter((i) => i.id !== (payload.old as ChecklistItem).id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [project.id])


  useEffect(() => {
    supabase.from('project_financials').select('*').eq('project_id', project.id).order('month', { ascending: false })
      .then(({ data }) => { if (data) setLegacyMonths(data) })
  }, [project.id])

  async function fetchHoursHistory() {
    const { data } = await supabase
      .from('project_hours_history')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
    if (data) setHoursHistory(data)
  }

  async function handleResetHours(type: 'manual' | 'monthly_auto') {
    setResetting(true)
    const now = new Date().toISOString()

    // Determine period_start: the previous reset time, or null (beginning of time)
    const periodStart = project.hours_reset_at ?? null

    // Determine period label
    let periodLabel: string
    if (type === 'monthly_auto') {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      periodLabel = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    } else {
      periodLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    // Save history record with accumulated hours up to now
    const hoursToSave = calculateProjectHours(filterEventsForHours(allProjectEvents, project))
    await supabase.from('project_hours_history').insert({
      project_id: project.id,
      period_label: periodLabel,
      period_start: periodStart,
      period_end: now,
      hours: hoursToSave,
      reset_type: type,
    })

    // Reset the project counter
    await onUpdate(project.id, { hours_reset_at: now })
    setResetting(false)
  }

  async function handleTrackingChange(mode: HoursTracking) {
    await onUpdate(project.id, { hours_tracking: mode, hours_reset_at: mode === 'since_reset' ? new Date().toISOString() : null })
  }

  async function fetchChecklistItems() {
    setChecklistLoading(true)
    const { data } = await supabase.from('project_checklist_items').select('*').eq('project_id', project.id).order('item_order')
    if (data) setItems(data)
    setChecklistLoading(false)
  }


  async function addChecklistItem() {
    if (!newItemText.trim()) return
    const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) : 0
    await supabase.from('project_checklist_items').insert({ project_id: project.id, text: newItemText.trim(), completed: false, item_order: maxOrder + 1 })
    setNewItemText('')
  }

  async function toggleItem(id: string, completed: boolean) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, completed: !completed } : i))
    await supabase.from('project_checklist_items').update({ completed: !completed }).eq('id', id)
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase.from('project_checklist_items').delete().eq('id', id)
  }

  async function saveItemEdit(id: string) {
    if (!editItemText.trim()) return
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, text: editItemText.trim() } : i))
    await supabase.from('project_checklist_items').update({ text: editItemText.trim() }).eq('id', id)
    setEditingItemId(null)
  }

  async function handleChecklistDrop(targetId: string) {
    if (!draggedItem || draggedItem === targetId) return
    const fromIdx = items.findIndex((i) => i.id === draggedItem)
    const toIdx = items.findIndex((i) => i.id === targetId)
    const reordered = [...items]
    const [removed] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, removed)
    const updated = reordered.map((item, i) => ({ ...item, item_order: i }))
    setItems(updated)
    setDraggedItem(null)
    for (const item of updated) await supabase.from('project_checklist_items').update({ item_order: item.item_order }).eq('id', item.id)
  }

  const completedCount = items.filter((i) => i.completed).length

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100" style={{ borderLeft: `4px solid ${project.color}` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="font-bold text-gray-900 text-lg tracking-tight">{project.title}</h2>
              <span
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: project.color, color: getContrastColor(project.color) }}
              >
                {formatHours(hours)}
              </span>
            </div>
            {project.description && <p className="text-sm text-gray-500 mb-1">{project.description}</p>}
            {project.deadline && (() => {
              const { label, color } = formatDeadline(project.deadline)
              return <span className={`text-xs font-semibold ${color}`}>{label}</span>
            })()}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-2.5 py-1.5 text-gray-600 hover:text-[#007aff] hover:bg-blue-50 rounded-lg transition-colors font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs px-2.5 py-1.5 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              Delete
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors ml-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-700 mb-2">Delete "{project.title}"? Events will be unassigned.</p>
            <div className="flex gap-2">
              <button
                onClick={async () => { await onDelete(project.id); onClose() }}
                className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50 shrink-0">
          {(['tasks', 'notes', 'financials', 'hours'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                tab === t ? 'text-[#007aff] border-b-2 border-[#007aff] bg-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'tasks'
                ? `Tasks${items.length > 0 ? ` (${completedCount}/${items.length})` : ''}`
                : t === 'notes' ? 'Notes'
                : t === 'financials' ? 'Financials'
                : 'Hours'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Tasks */}
          {tab === 'tasks' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                  placeholder="Add new task..."
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-sm text-gray-900 transition-all"
                />
                <Button onClick={addChecklistItem} disabled={!newItemText.trim()}>Add</Button>
              </div>
              {checklistLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No tasks yet. Add one above!</div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedItem(item.id)}
                      onDragEnd={() => setDraggedItem(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleChecklistDrop(item.id)}
                      className={`flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group cursor-move ${draggedItem === item.id ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => toggleItem(item.id, item.completed)}
                        className="mt-0.5 rounded border-gray-300 text-[#007aff] cursor-pointer"
                      />
                      {editingItemId === item.id ? (
                        <input
                          type="text"
                          value={editItemText}
                          onChange={(e) => setEditItemText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveItemEdit(item.id); if (e.key === 'Escape') setEditingItemId(null) }}
                          onBlur={() => saveItemEdit(item.id)}
                          autoFocus
                          className="flex-1 px-2 py-1 text-sm border border-[#007aff] rounded-lg outline-none"
                        />
                      ) : (
                        <span
                          onDoubleClick={() => { setEditingItemId(item.id); setEditItemText(item.text) }}
                          className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}
                        >
                          {item.text}
                        </span>
                      )}
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {editingItemId !== item.id && (
                          <button onClick={() => { setEditingItemId(item.id); setEditItemText(item.text) }} className="text-[#007aff] text-xs font-medium">Edit</button>
                        )}
                        <button onClick={() => deleteItem(item.id)} className="text-red-500 text-xs font-medium">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hours */}
          {tab === 'hours' && (
            <div className="space-y-5">
              {/* Current period summary */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">
                    {project.hours_tracking === 'monthly'
                      ? 'This month'
                      : project.hours_tracking === 'since_reset'
                      ? 'Since last reset'
                      : 'All time'}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{formatHours(hours)}</div>
                </div>
                {(project.hours_tracking === 'since_reset' || project.hours_tracking === 'monthly') && (
                  <button
                    onClick={() => handleResetHours('manual')}
                    disabled={resetting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:text-[#007aff] hover:border-[#007aff] transition-colors disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset now
                  </button>
                )}
              </div>

              {/* Tracking mode selector */}
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2">Tracking mode</div>
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  {([
                    ['all_time', 'All time'],
                    ['monthly', 'Monthly'],
                    ['since_reset', 'Manual'],
                  ] as [HoursTracking, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => handleTrackingChange(mode)}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${
                        (project.hours_tracking ?? 'all_time') === mode
                          ? 'bg-[#007aff] text-white'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {project.hours_tracking === 'monthly'
                    ? 'Counter resets automatically on the 1st of each month.'
                    : project.hours_tracking === 'since_reset'
                    ? 'Counter resets only when you press "Reset now".'
                    : 'Counts all hours ever logged to this project.'}
                </p>
              </div>

              {/* History */}
              {hoursHistory.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">History</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {hoursHistory.map((h) => (
                      <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-800">{h.period_label ?? 'Period'}</div>
                          <div className="text-xs text-gray-400">
                            {h.reset_type === 'monthly_auto' ? 'Auto reset' : 'Manual reset'} · {new Date(h.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-700">{formatHours(h.hours)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hoursHistory.length === 0 && project.hours_tracking === 'all_time' && (
                <p className="text-xs text-gray-400 text-center py-4">Switch to Monthly or Manual mode to start tracking periods.</p>
              )}

              {/* Monthly breakdown from events */}
              {(() => {
                const byMonth: Record<string, number> = {}
                for (const event of allProjectEvents) {
                  if (event.exclude_from_hours) continue
                  const start = new Date(event.start_time)
                  const end = new Date(event.end_time)
                  const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60))
                  const assigneeCount = event.assignees?.length || 1
                  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
                  byMonth[key] = (byMonth[key] ?? 0) + hours * assigneeCount
                }
                const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]))
                if (months.length === 0) return null
                return (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">By month</div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {months.map(([month, h]) => {
                        const [y, m] = month.split('-')
                        const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                        const isCurrentMonth = month === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                        return (
                          <div key={month} className={`flex items-center justify-between rounded-xl px-4 py-3 ${isCurrentMonth ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                            <span className={`text-sm font-medium ${isCurrentMonth ? 'text-blue-700' : 'text-gray-700'}`}>{label}</span>
                            <span className={`text-sm font-bold ${isCurrentMonth ? 'text-blue-700' : 'text-gray-700'}`}>{formatHours(h)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Notes */}
          {tab === 'notes' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Saved automatically.</p>
              <ProjectNotes projectId={project.id} />
            </div>
          )}

          {/* Financials / Payments */}
          {tab === 'financials' && (
            <div className="space-y-4">
              {paymentsLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
              ) : (
                <>
                  {/* Retainer: monthly amount setting */}
                  {project.project_type === 'retainer' && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="text-xs font-semibold text-blue-700 mb-2">Monthly retainer fee</div>
                      <div className="flex gap-2 items-center">
                        <span className="text-sm text-gray-500">₪</span>
                        <input
                          type="number"
                          value={retainerAmountEdit}
                          onChange={(e) => setRetainerAmountEdit(e.target.value)}
                          onBlur={() => onUpdate(project.id, { retainer_amount: parseFloat(retainerAmountEdit) || null })}
                          placeholder="0"
                          className="w-28 px-3 py-1.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none text-sm font-semibold text-gray-900 bg-white"
                        />
                        <button
                          onClick={async () => {
                            const now = new Date()
                            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                            const exists = payments.some((p) => p.month === month)
                            if (exists) return
                            const amount = parseFloat(retainerAmountEdit) || project.retainer_amount || 0
                            const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                            await addPayment({ project_id: project.id, description: `Retainer – ${now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`, amount, work_deadline: null, due_date: dueDate, paid_date: null, status: 'expected', invoice_ref: null, month })
                          }}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                        >
                          + This month
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {payments.length > 0 && (() => {
                    const totalExpected = payments.reduce((s, p) => s + p.amount, 0)
                    const totalPaid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
                    const outstanding = totalExpected - totalPaid
                    return (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <div className="text-xs text-gray-500 mb-0.5">Expected</div>
                          <div className="text-sm font-bold text-gray-800">₪{totalExpected.toFixed(0)}</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3">
                          <div className="text-xs text-gray-500 mb-0.5">Collected</div>
                          <div className="text-sm font-bold text-green-700">₪{totalPaid.toFixed(0)}</div>
                        </div>
                        <div className={`rounded-xl p-3 ${outstanding > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                          <div className="text-xs text-gray-500 mb-0.5">Outstanding</div>
                          <div className={`text-sm font-bold ${outstanding > 0 ? 'text-orange-600' : 'text-green-700'}`}>₪{outstanding.toFixed(0)}</div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Payment list */}
                  {(() => {
                    type P = typeof payments[number]
                    const pendingPayments = payments
                      .filter((p) => p.status !== 'paid')
                      .sort((a, b) => {
                        if (!a.due_date && !b.due_date) return 0
                        if (!a.due_date) return 1
                        if (!b.due_date) return -1
                        return a.due_date.localeCompare(b.due_date)
                      })
                    const paidPayments = payments
                      .filter((p) => p.status === 'paid')
                      .sort((a, b) => (b.paid_date ?? '').localeCompare(a.paid_date ?? ''))

                    // Group pending by month key
                    const monthGroups: { key: string; label: string; items: P[] }[] = []
                    for (const p of pendingPayments) {
                      const key = p.due_date ? p.due_date.slice(0, 7) : 'none'
                      const label = p.due_date
                        ? new Date(p.due_date.slice(0, 7) + '-01').toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
                        : 'ללא תאריך'
                      const existing = monthGroups.find((g) => g.key === key)
                      if (existing) existing.items.push(p)
                      else monthGroups.push({ key, label, items: [p] })
                    }

                    const renderPaymentRow = (p: P) => {
                      const effectiveStatus: 'paid' | 'overdue' | 'expected' =
                        p.status === 'paid' ? 'paid'
                        : p.due_date && new Date(p.due_date) < new Date() ? 'overdue'
                        : 'expected'

                      if (editingPaymentId === p.id) {
                        return (
                          <div key={p.id} className="border border-[#007aff] rounded-xl p-3 space-y-2">
                            <input
                              type="text"
                              value={editPayment.description}
                              onChange={(e) => setEditPayment((prev) => ({ ...prev, description: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                            />
                            <input
                              type="number"
                              value={editPayment.amount}
                              onChange={(e) => setEditPayment((prev) => ({ ...prev, amount: e.target.value }))}
                              placeholder="Amount (₪)"
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">Deadline</label>
                                <input
                                  type="date"
                                  value={editPayment.work_deadline}
                                  onChange={(e) => setEditPayment((prev) => ({ ...prev, work_deadline: e.target.value }))}
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">Expected payment</label>
                                <input
                                  type="date"
                                  value={editPayment.due_date}
                                  onChange={(e) => setEditPayment((prev) => ({ ...prev, due_date: e.target.value }))}
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                                />
                              </div>
                            </div>
                            <input
                              type="text"
                              value={editPayment.invoice_ref}
                              onChange={(e) => setEditPayment((prev) => ({ ...prev, invoice_ref: e.target.value }))}
                              placeholder="Invoice # (optional)"
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={async () => {
                                  await updatePayment(p.id, {
                                    description: editPayment.description.trim(),
                                    amount: parseFloat(editPayment.amount) || p.amount,
                                    work_deadline: editPayment.work_deadline || null,
                                    due_date: editPayment.due_date || null,
                                    month: editPayment.due_date ? editPayment.due_date.slice(0, 7) : null,
                                    invoice_ref: editPayment.invoice_ref.trim() || null,
                                  })
                                  setEditingPaymentId(null)
                                }}
                              >Save</Button>
                              <Button variant="secondary" onClick={() => setEditingPaymentId(null)}>Cancel</Button>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${effectiveStatus === 'paid' ? 'bg-green-50 border-green-100' : effectiveStatus === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{p.description}</div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs font-bold text-gray-700">₪{p.amount.toFixed(0)}</span>
                              {p.work_deadline && (
                                <span className="text-xs text-gray-400">deadline {new Date(p.work_deadline + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                              )}
                              <label className="relative cursor-pointer">
                                <span className="text-xs text-gray-400 hover:text-[#007aff] transition-colors">
                                  {p.due_date ? `payment ${new Date(p.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : '+ payment date'}
                                </span>
                                <input
                                  type="date"
                                  value={p.due_date ?? ''}
                                  onChange={async (e) => {
                                    const val = e.target.value
                                    try {
                                      await updatePayment(p.id, { due_date: val || null, month: val ? val.slice(0, 7) : null })
                                    } catch (err) {
                                      setPaymentError(err instanceof Error ? err.message : 'Failed to update date')
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                />
                              </label>
                              {p.invoice_ref && <span className="text-xs text-gray-400">#{p.invoice_ref}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${effectiveStatus === 'paid' ? 'bg-green-100 text-green-700' : effectiveStatus === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                              {effectiveStatus === 'paid' ? 'Paid' : effectiveStatus === 'overdue' ? 'Overdue' : 'Pending'}
                            </span>
                            <button
                              onClick={() => { setEditingPaymentId(p.id); setEditPayment({ description: p.description, amount: p.amount.toString(), work_deadline: p.work_deadline ?? '', due_date: p.due_date ?? '', invoice_ref: p.invoice_ref ?? '' }) }}
                              className="text-xs text-[#007aff] hover:underline font-medium"
                            >Edit</button>
                            {effectiveStatus !== 'paid' && (
                              <button onClick={() => markPaid(p.id)} className="text-xs px-2 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium">✓</button>
                            )}
                            <button onClick={() => deletePayment(p.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">✕</button>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div className="space-y-2">
                        {payments.length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-sm">No payments yet. Add one below.</div>
                        )}

                        {/* Pending — grouped by month */}
                        {monthGroups.map((group) => (
                          <details key={group.key} open className="group rounded-xl border border-gray-200 overflow-hidden">
                            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden bg-gray-50 hover:bg-gray-100 transition-colors">
                              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              <span className="text-xs font-semibold text-gray-600">{group.label}</span>
                              <span className="ml-auto text-xs text-gray-400">₪{group.items.reduce((s, p) => s + p.amount, 0).toFixed(0)}</span>
                            </summary>
                            <div className="p-2 space-y-2">
                              {group.items.map(renderPaymentRow)}
                            </div>
                          </details>
                        ))}

                        {/* Paid section */}
                        {paidPayments.length > 0 && (
                          <details className="group rounded-xl border border-green-100 overflow-hidden">
                            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden bg-green-50 hover:bg-green-100 transition-colors">
                              <svg className="w-3.5 h-3.5 text-green-400 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              <span className="text-xs font-semibold text-green-700">Paid</span>
                              <span className="ml-auto text-xs text-green-500">₪{paidPayments.reduce((s, p) => s + p.amount, 0).toFixed(0)}</span>
                            </summary>
                            <div className="p-2 space-y-2">
                              {paidPayments.map(renderPaymentRow)}
                            </div>
                          </details>
                        )}
                      </div>
                    )
                  })()}

                  {/* Add payment */}
                  {showAddPayment ? (
                    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-semibold text-gray-700">New payment</div>
                      <input
                        type="text"
                        placeholder="Description"
                        value={newPayment.description}
                        onChange={(e) => setNewPayment((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                      />
                      <input
                        type="number"
                        placeholder="Amount (₪)"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment((prev) => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Deadline (project)</label>
                          <input
                            type="date"
                            value={newPayment.work_deadline}
                            onChange={(e) => setNewPayment((prev) => ({ ...prev, work_deadline: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Expected payment</label>
                          <input
                            type="date"
                            value={newPayment.due_date}
                            onChange={(e) => setNewPayment((prev) => ({ ...prev, due_date: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Invoice # (optional)"
                        value={newPayment.invoice_ref}
                        onChange={(e) => setNewPayment((prev) => ({ ...prev, invoice_ref: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]"
                      />
                      {paymentError && <p className="text-xs text-red-500">{paymentError}</p>}
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            if (!newPayment.description.trim() || !newPayment.amount) return
                            setPaymentError('')
                            try {
                              await addPayment({ project_id: project.id, description: newPayment.description.trim(), amount: parseFloat(newPayment.amount), work_deadline: newPayment.work_deadline || null, due_date: newPayment.due_date || null, paid_date: null, status: 'expected', invoice_ref: newPayment.invoice_ref.trim() || null, month: newPayment.due_date ? newPayment.due_date.slice(0, 7) : null })
                              setNewPayment({ description: '', amount: '', work_deadline: '', due_date: '', invoice_ref: '' })
                              setShowAddPayment(false)
                            } catch (e) {
                              setPaymentError(e instanceof Error ? e.message : 'Failed to save. Make sure migration 009 was run in Supabase.')
                            }
                          }}
                          disabled={!newPayment.description.trim() || !newPayment.amount}
                        >
                          Add
                        </Button>
                        <Button variant="secondary" onClick={() => { setShowAddPayment(false); setPaymentError('') }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddPayment(true)}
                      className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[#007aff] hover:text-[#007aff] transition-colors"
                    >
                      + Add payment
                    </button>
                  )}

                  {/* Legacy monthly data */}
                  {legacyMonths.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Previous records</div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {legacyMonths.map((m) => {
                          const [y, mo] = m.month.split('-')
                          const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                          const profit = m.income - m.expenses

                          if (editingLegacyId === m.id) {
                            return (
                              <div key={m.id} className="border border-[#007aff] rounded-xl p-3 space-y-2">
                                <div className="text-xs font-semibold text-gray-700">{label}</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Income</label>
                                    <input type="number" value={editLegacy.income} onChange={(e) => setEditLegacy((p) => ({ ...p, income: e.target.value }))} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Expenses</label>
                                    <input type="number" value={editLegacy.expenses} onChange={(e) => setEditLegacy((p) => ({ ...p, expenses: e.target.value }))} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]" />
                                  </div>
                                </div>
                                <input type="text" value={editLegacy.notes} onChange={(e) => setEditLegacy((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]" />
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">Expected receipt date</label>
                                  <input type="date" value={editLegacy.expected_date} onChange={(e) => setEditLegacy((p) => ({ ...p, expected_date: e.target.value }))} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#007aff]" />
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={async () => {
                                    const updates = { income: parseFloat(editLegacy.income) || 0, expenses: parseFloat(editLegacy.expenses) || 0, notes: editLegacy.notes.trim() || null, expected_date: editLegacy.expected_date || null }
                                    await supabase.from('project_financials').update(updates).eq('id', m.id)
                                    setLegacyMonths((prev) => prev.map((r) => r.id === m.id ? { ...r, ...updates } : r))
                                    setEditingLegacyId(null)
                                  }}>Save</Button>
                                  <Button variant="secondary" onClick={() => setEditingLegacyId(null)}>Cancel</Button>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                              <div>
                                <div className="text-sm font-medium text-gray-700">{label}</div>
                                <div className="text-xs text-gray-400">Income ₪{m.income.toFixed(0)} · Exp ₪{m.expenses.toFixed(0)}{m.notes ? ` · ${m.notes}` : ''}{m.expected_date ? ` · expected ${new Date(m.expected_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>₪{profit.toFixed(0)}</span>
                                <button onClick={() => { setEditingLegacyId(m.id); setEditLegacy({ income: m.income.toString(), expenses: m.expenses.toString(), notes: m.notes ?? '', expected_date: m.expected_date ?? '' }) }} className="text-xs text-[#007aff] hover:underline font-medium">Edit</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <ProjectForm
          open={editing}
          onClose={() => setEditing(false)}
          initialData={project}
          onSubmit={async (data) => { await onUpdate(project.id, data) }}
        />
      )}
    </div>,
    document.body
  )
}
