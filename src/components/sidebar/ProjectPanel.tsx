import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../config/supabase'
import type { Project, CalendarEvent, ChecklistItem, ProjectFinancials } from '../../types'
import { calculateProjectHours, formatHours } from '../../utils/hours'
import { getContrastColor } from '../../utils/colors'
import ProjectForm from './ProjectForm'
import ProjectNotes from './ProjectNotes'
import Button from '../ui/Button'

type Tab = 'tasks' | 'notes' | 'financials'

interface ProjectPanelProps {
  project: Project
  events: CalendarEvent[]
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Pick<Project, 'title' | 'color' | 'description' | 'status' | 'deadline' | 'sort_order'>>) => Promise<void>
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

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthDisplay(month: string) {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
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

  // Financials state
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth())
  const [income, setIncome] = useState('')
  const [expenses, setExpenses] = useState('')
  const [finNotes, setFinNotes] = useState('')
  const [allMonths, setAllMonths] = useState<ProjectFinancials[]>([])

  const projectEvents = events.filter((e) => e.project_id === project.id)
  const hours = calculateProjectHours(projectEvents)

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
    fetchFinancials()
    const ch = supabase
      .channel(`panel-financials-${project.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_financials', filter: `project_id=eq.${project.id}` }, () => fetchFinancials())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [project.id])

  useEffect(() => {
    const monthData = allMonths.find((m) => m.month === currentMonth)
    if (monthData) {
      setIncome(monthData.income.toString())
      setExpenses(monthData.expenses.toString())
      setFinNotes(monthData.notes || '')
    } else {
      setIncome('')
      setExpenses('')
      setFinNotes('')
    }
  }, [currentMonth, allMonths])

  async function fetchChecklistItems() {
    setChecklistLoading(true)
    const { data } = await supabase.from('project_checklist_items').select('*').eq('project_id', project.id).order('item_order')
    if (data) setItems(data)
    setChecklistLoading(false)
  }

  async function fetchFinancials() {
    const { data } = await supabase.from('project_financials').select('*').eq('project_id', project.id).order('month', { ascending: false })
    if (data) setAllMonths(data)
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

  async function saveFinancials() {
    await supabase.from('project_financials').upsert({
      project_id: project.id,
      month: currentMonth,
      income: parseFloat(income) || 0,
      expenses: parseFloat(expenses) || 0,
      notes: finNotes.trim() || null,
    }, { onConflict: 'project_id,month' })
    fetchFinancials()
  }

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 2)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (next <= getCurrentMonth()) setCurrentMonth(next)
  }

  const profit = (parseFloat(income) || 0) - (parseFloat(expenses) || 0)
  const totalIncome = allMonths.reduce((s, m) => s + m.income, 0)
  const totalExpenses = allMonths.reduce((s, m) => s + m.expenses, 0)
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
          {(['tasks', 'notes', 'financials'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === t ? 'text-[#007aff] border-b-2 border-[#007aff] bg-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'tasks'
                ? `Tasks${items.length > 0 ? ` (${completedCount}/${items.length})` : ''}`
                : t === 'notes' ? 'Notes' : 'Financials'}
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

          {/* Notes */}
          {tab === 'notes' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Saved automatically.</p>
              <ProjectNotes projectId={project.id} />
            </div>
          )}

          {/* Financials */}
          {tab === 'financials' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{formatMonthDisplay(currentMonth)}</div>
                  {currentMonth === getCurrentMonth() && <div className="text-xs text-[#007aff]">Current Month</div>}
                </div>
                <button onClick={nextMonth} disabled={currentMonth >= getCurrentMonth()} className={`p-2 rounded-lg transition-colors ${currentMonth < getCurrentMonth() ? 'hover:bg-white' : 'opacity-30 cursor-not-allowed'}`}>
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Income</label>
                  <input type="number" step="0.01" value={income} onChange={(e) => setIncome(e.target.value)} onBlur={saveFinancials} placeholder="0.00" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expenses</label>
                  <input type="number" step="0.01" value={expenses} onChange={(e) => setExpenses(e.target.value)} onBlur={saveFinancials} placeholder="0.00" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
                <textarea value={finNotes} onChange={(e) => setFinNotes(e.target.value)} onBlur={saveFinancials} placeholder="Notes about this month..." rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 resize-none transition-all" />
              </div>

              <div className={`p-4 rounded-xl ${profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="text-sm text-gray-600 mb-1">This Month's Profit</div>
                <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>₪{profit.toFixed(2)}</div>
              </div>

              {allMonths.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">All Time</h4>
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">Income</div>
                      <div className="text-base font-bold text-blue-600">₪{totalIncome.toFixed(0)}</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">Expenses</div>
                      <div className="text-base font-bold text-orange-600">₪{totalExpenses.toFixed(0)}</div>
                    </div>
                    <div className={`p-3 rounded-lg ${totalIncome - totalExpenses >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="text-xs text-gray-600 mb-1">Profit</div>
                      <div className={`text-base font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>₪{(totalIncome - totalExpenses).toFixed(0)}</div>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {allMonths.map((m) => (
                      <button key={m.id} onClick={() => setCurrentMonth(m.month)} className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${currentMonth === m.month ? 'bg-blue-50 border-2 border-[#007aff]' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        <span className="text-sm font-medium text-gray-700">{formatMonthDisplay(m.month)}</span>
                        <span className={`text-sm font-bold ${m.income - m.expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>₪{(m.income - m.expenses).toFixed(0)}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
