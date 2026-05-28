import * as XLSX from 'xlsx'
import { supabase } from '../config/supabase'

// ── EXPORT ──────────────────────────────────────────────────────────────────

export async function exportAllData(): Promise<void> {
  const [
    { data: projects },
    { data: events },
    { data: assignees },
    { data: payments },
    { data: financials },
    { data: checklist },
    { data: notes },
    { data: hoursHistory },
  ] = await Promise.all([
    supabase.from('projects').select('*').order('created_at'),
    supabase.from('calendar_events').select('*').order('start_time'),
    supabase.from('event_assignees').select('*'),
    supabase.from('project_payments').select('*').order('due_date'),
    supabase.from('project_financials').select('*').order('month'),
    supabase.from('project_checklist_items').select('*').order('item_order'),
    supabase.from('project_notes').select('*'),
    supabase.from('project_hours_history').select('*').order('created_at'),
  ])

  const wb = XLSX.utils.book_new()

  const addSheet = (name: string, data: Record<string, unknown>[] | null) => {
    const ws = XLSX.utils.json_to_sheet(data ?? [])
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  addSheet('Projects', projects as Record<string, unknown>[])
  addSheet('Events', events as Record<string, unknown>[])
  addSheet('Event Assignees', assignees as Record<string, unknown>[])
  addSheet('Payments', payments as Record<string, unknown>[])
  addSheet('Financials', financials as Record<string, unknown>[])
  addSheet('Checklist', checklist as Record<string, unknown>[])
  addSheet('Notes', notes as Record<string, unknown>[])
  addSheet('Hours History', hoursHistory as Record<string, unknown>[])

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `luzon-backup-${date}.xlsx`)
}

// ── IMPORT ──────────────────────────────────────────────────────────────────

type SheetRow = Record<string, unknown>

function readSheet(wb: XLSX.WorkBook, name: string): SheetRow[] {
  const ws = wb.Sheets[name]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<SheetRow>(ws)
}

export async function importAllData(file: File): Promise<{ imported: string[]; errors: string[] }> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  const imported: string[] = []
  const errors: string[] = []

  async function upsert(table: string, data: SheetRow[], conflict: string) {
    if (data.length === 0) return
    const { error } = await supabase.from(table).upsert(data as never[], { onConflict: conflict, ignoreDuplicates: false })
    if (error) errors.push(`${table}: ${error.message}`)
    else imported.push(`${table} (${data.length} rows)`)
  }

  const projects = readSheet(wb, 'Projects')
  const events = readSheet(wb, 'Events')
  const assignees = readSheet(wb, 'Event Assignees')
  const payments = readSheet(wb, 'Payments')
  const financials = readSheet(wb, 'Financials')
  const checklist = readSheet(wb, 'Checklist')
  const notes = readSheet(wb, 'Notes')
  const hoursHistory = readSheet(wb, 'Hours History')

  // Order matters: parents before children
  await upsert('projects', projects, 'id')
  await upsert('calendar_events', events, 'id')
  await upsert('event_assignees', assignees, 'id')
  await upsert('project_payments', payments, 'id')
  await upsert('project_financials', financials, 'project_id,month')
  await upsert('project_checklist_items', checklist, 'id')
  await upsert('project_notes', notes, 'project_id')
  await upsert('project_hours_history', hoursHistory, 'id')

  return { imported, errors }
}
