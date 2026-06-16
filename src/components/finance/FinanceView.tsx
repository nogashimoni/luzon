import { useState, useEffect } from 'react'
import type { Project, ProjectFinancials } from '../../types'
import { useAllPayments } from '../../hooks/usePayments'
import { supabase } from '../../config/supabase'

interface FinanceViewProps {
  projects: Project[]
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(month: string) {
  const [y, m] = month.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function FinanceView({ projects }: FinanceViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const { payments, loading: paymentsLoading, markPaid, getEffectiveStatus } = useAllPayments()
  const [legacyFinancials, setLegacyFinancials] = useState<ProjectFinancials[]>([])
  const [legacyLoading, setLegacyLoading] = useState(true)

  useEffect(() => {
    supabase.from('project_financials').select('*').order('month', { ascending: false })
      .then(({ data }) => { if (data) setLegacyFinancials(data); setLegacyLoading(false) })
  }, [])

  const loading = paymentsLoading || legacyLoading
  const projectMap = new Map(projects.map((p) => [p.id, p]))
  const currentMonth = getCurrentMonth()
  const isFuture = selectedMonth > currentMonth
  const isNow = selectedMonth === currentMonth

  // Legacy records are grouped by their expected receipt date when set, otherwise their recorded month
  const legacyMonth = (f: ProjectFinancials) => f.expected_date ? f.expected_date.slice(0, 7) : f.month

  // All months from both data sources
  const dataMonths = [...new Set([
    ...payments.map((p) => p.month ?? p.created_at.slice(0, 7)),
    ...legacyFinancials.map(legacyMonth),
  ])].sort((a, b) => b.localeCompare(a))

  // Payments for selected month (new system)
  const monthPayments = payments.filter((p) => (p.month ?? p.created_at.slice(0, 7)) === selectedMonth)
  const receivedPayments = monthPayments.filter((p) => getEffectiveStatus(p) === 'paid')
  const pendingPayments = monthPayments.filter((p) => getEffectiveStatus(p) !== 'paid')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))

  // Legacy records for selected month
  const monthLegacy = legacyFinancials.filter((f) => legacyMonth(f) === selectedMonth)
  // Future legacy records haven't been collected yet — show them in the Forecast list, not as already received
  const legacyForecast = isFuture ? monthLegacy : []
  const legacyReceived = isFuture ? [] : monthLegacy

  // Totals
  const totalReceived = receivedPayments.reduce((s, p) => s + p.amount, 0)
    + legacyReceived.reduce((s, f) => s + f.income, 0)
  const totalExpected = totalReceived
    + pendingPayments.reduce((s, p) => s + p.amount, 0)
    + legacyForecast.reduce((s, f) => s + f.income, 0)
  const pct = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0
  const hasAnyData = monthPayments.length > 0 || monthLegacy.length > 0

  // Group pending/forecast items by project so a project with several small payments
  // shows up as one combined line, expandable to see the breakdown
  type PendingItem = { id: string; description: string; amount: number; due_date: string | null; invoice_ref: string | null; isLegacy: boolean; status: ReturnType<typeof getEffectiveStatus> | 'expected' }
  const pendingByProject = new Map<string, PendingItem[]>()
  for (const item of pendingPayments) {
    const list = pendingByProject.get(item.project_id) ?? []
    list.push({ id: item.id, description: item.description, amount: item.amount, due_date: item.due_date, invoice_ref: item.invoice_ref, isLegacy: false, status: getEffectiveStatus(item) })
    pendingByProject.set(item.project_id, list)
  }
  for (const f of legacyForecast) {
    const list = pendingByProject.get(f.project_id) ?? []
    list.push({ id: f.id, description: f.notes || 'Expected payment', amount: f.income, due_date: f.expected_date, invoice_ref: null, isLegacy: true, status: 'expected' })
    pendingByProject.set(f.project_id, list)
  }
  const pendingGroups = [...pendingByProject.entries()]
    .map(([projectId, items]) => ({
      projectId,
      items: items.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')),
      total: items.reduce((s, i) => s + i.amount, 0),
      earliestDue: items.reduce((min, i) => (i.due_date && (!min || i.due_date < min) ? i.due_date : min), '' as string),
    }))
    .sort((a, b) => a.earliestDue.localeCompare(b.earliestDue))

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
  }

  return (
    <div className="h-full overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 sm:p-6 space-y-5">

        {/* Month navigation */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Finance</h2>
            {isFuture && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">Forecast</span>
            )}
            {isNow && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-600">This month</span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
              className="p-1.5 hover:bg-white rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-800 px-2 min-w-[130px] text-center">{formatMonth(selectedMonth)}</span>
            <button
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              className="p-1.5 hover:bg-white rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Month jumper — quick access to months with data */}
        {dataMonths.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[currentMonth, addMonths(currentMonth, 1), addMonths(currentMonth, 2)].map((m) => (
              <button key={m} onClick={() => setSelectedMonth(m)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${selectedMonth === m ? 'bg-[#007aff] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {m === currentMonth ? 'This month' : formatMonth(m).split(' ')[0]}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1" />
            {dataMonths.slice(0, 6).map((m) => (
              <button key={m} onClick={() => setSelectedMonth(m)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${selectedMonth === m ? 'bg-[#007aff] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {formatMonth(m).split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Summary bar */}
        {hasAnyData && (
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">
                  {isFuture ? 'Forecast' : 'Received vs Expected'}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {isFuture ? `₪${totalExpected.toFixed(0)}` : `₪${totalReceived.toFixed(0)}`}
                </div>
                <div className="text-xs text-gray-400">
                  {isFuture
                    ? `expected in ${formatMonth(selectedMonth)}`
                    : `of ₪${totalExpected.toFixed(0)} expected`}
                </div>
              </div>
              {!isFuture && (
                <div className={`text-3xl font-black ${pct >= 100 ? 'text-green-500' : pct >= 50 ? 'text-blue-500' : 'text-orange-400'}`}>
                  {pct}%
                </div>
              )}
            </div>
            {!isFuture && totalExpected > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className={`rounded-xl p-2 ${isFuture ? 'bg-blue-50' : 'bg-green-50'}`}>
                <div className="text-xs text-gray-400">{isFuture ? 'Forecast' : 'Received'}</div>
                <div className={`text-sm font-bold ${isFuture ? 'text-blue-600' : 'text-green-600'}`}>₪{(isFuture ? totalExpected : totalReceived).toFixed(0)}</div>
              </div>
              <div className={`rounded-xl p-2 ${pendingPayments.length + legacyForecast.length > 0 ? 'bg-orange-50' : 'bg-gray-100'}`}>
                <div className="text-xs text-gray-400">Pending</div>
                <div className={`text-sm font-bold ${pendingPayments.length + legacyForecast.length > 0 ? 'text-orange-500' : 'text-gray-400'}`}>₪{(pendingPayments.reduce((s, p) => s + p.amount, 0) + legacyForecast.reduce((s, f) => s + f.income, 0)).toFixed(0)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Pending / Expected */}
        {(pendingPayments.length > 0 || legacyForecast.length > 0) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold text-gray-700">
                {isFuture ? `Forecast for ${formatMonth(selectedMonth)}` : isNow ? 'Expected this month' : 'Pending'}
              </h3>
              <span className="text-xs text-gray-400 ml-auto">
                ₪{(pendingPayments.reduce((s, p) => s + p.amount, 0) + legacyForecast.reduce((s, f) => s + f.income, 0)).toFixed(0)}
              </span>
            </div>
            <div className="space-y-2">
              {pendingGroups.map(({ projectId, items, total }) => {
                const project = projectMap.get(projectId)
                const hasOverdue = items.some((i) => i.status === 'overdue')

                // Single payment for this project — render as a plain row, same as before
                if (items.length === 1) {
                  const item = items[0]
                  return (
                    <div key={item.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${item.status === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
                      {project && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{item.description}</div>
                        <div className="text-xs text-gray-400">
                          {project?.title}
                          {item.due_date ? ` · expected ${formatDate(item.due_date)}` : ''}
                          {item.invoice_ref ? ` · #${item.invoice_ref}` : ''}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-700 shrink-0">₪{item.amount.toFixed(0)}</span>
                      {!isFuture && !item.isLegacy && (
                        <button onClick={() => markPaid(item.id)} className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium shrink-0 whitespace-nowrap">
                          ✓ Received
                        </button>
                      )}
                    </div>
                  )
                }

                // Several payments for the same project — show one combined row, expandable for the breakdown
                return (
                  <details key={projectId} className={`group rounded-xl border overflow-hidden ${hasOverdue ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
                    <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                      {project && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{project?.title ?? 'Unknown'}</div>
                        <div className="text-xs text-gray-400">{items.length} payments</div>
                      </div>
                      <span className="text-sm font-bold text-gray-700 shrink-0">₪{total.toFixed(0)}</span>
                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {items.map((item) => (
                        <div key={item.id} className={`flex items-center gap-3 pl-9 pr-4 py-2 ${item.status === 'overdue' ? 'bg-red-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-700 truncate">{item.description}</div>
                            {item.due_date && <div className="text-xs text-gray-400">expected {formatDate(item.due_date)}</div>}
                          </div>
                          <span className="text-xs font-semibold text-gray-600 shrink-0">₪{item.amount.toFixed(0)}</span>
                          {!isFuture && !item.isLegacy && (
                            <button onClick={() => markPaid(item.id)} className="text-xs px-2 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shrink-0 whitespace-nowrap">
                              ✓
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )
              })}
            </div>
          </div>
        )}

        {/* Legacy records (past/current months only — future ones show in Forecast above) */}
        {legacyReceived.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <h3 className="text-sm font-semibold text-gray-700">Records</h3>
              <span className="text-xs text-gray-400 ml-auto">₪{legacyReceived.reduce((s, f) => s + f.income, 0).toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              {legacyReceived.map((f) => {
                const project = projectMap.get(f.project_id)
                const profit = f.income - f.expenses
                return (
                  <div key={f.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                    {project && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{project?.title ?? 'Unknown'}</div>
                      <div className="text-xs text-gray-400">
                        Income ₪{f.income.toFixed(0)} · Exp ₪{f.expenses.toFixed(0)}
                        {f.expected_date ? ` · expected ${formatDate(f.expected_date)}` : ''}
                        {f.notes ? ` · ${f.notes}` : ''}
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>₪{profit.toFixed(0)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Received */}
        {receivedPayments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <h3 className="text-sm font-semibold text-gray-700">Received</h3>
              <span className="text-xs text-gray-400 ml-auto">₪{totalReceived.toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              {receivedPayments.map((p) => {
                const project = projectMap.get(p.project_id)
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                    {project && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{p.description}</div>
                      <div className="text-xs text-gray-400">
                        {project?.title}
                        {p.paid_date ? ` · received ${formatDate(p.paid_date)}` : ''}
                        {p.invoice_ref ? ` · #${p.invoice_ref}` : ''}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-green-700 shrink-0">₪{p.amount.toFixed(0)}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">✓</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!hasAnyData && (
          <div className="text-center py-16 text-gray-400 text-sm">
            {isFuture
              ? <><div className="text-2xl mb-2">📅</div>No payments scheduled for {formatMonth(selectedMonth)}.<br /><span className="text-xs">Add payments with future expected dates in each project's Financials tab.</span></>
              : <><div className="text-2xl mb-2">💸</div>No data for {formatMonth(selectedMonth)}.<br /><span className="text-xs">Add payments inside each project's Financials tab.</span></>
            }
          </div>
        )}

      </div>
    </div>
  )
}
