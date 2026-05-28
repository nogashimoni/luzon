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

  // Collect all months from both sources
  const paymentMonths = payments.map((p) => p.month ?? p.created_at.slice(0, 7))
  const legacyMonths = legacyFinancials.map((f) => f.month)
  const allMonths = [...new Set([...paymentMonths, ...legacyMonths, getCurrentMonth()])].sort((a, b) => b.localeCompare(a))

  // Payments for selected month
  const monthPayments = payments.filter((p) => (p.month ?? p.created_at.slice(0, 7)) === selectedMonth)
  const expectedThisMonth = monthPayments.filter((p) => getEffectiveStatus(p) !== 'paid')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const receivedThisMonth = monthPayments.filter((p) => getEffectiveStatus(p) === 'paid')

  // Legacy records for selected month
  const monthLegacy = legacyFinancials.filter((f) => f.month === selectedMonth)

  // Overdue from any month
  const overdue = payments.filter((p) => getEffectiveStatus(p) === 'overdue')

  // Totals: new payments + legacy income
  const legacyExpected = monthLegacy.reduce((s, f) => s + f.income, 0)
  const legacyExpectedWithDate = monthLegacy.filter((f) => f.expected_date).reduce((s, f) => s + f.income, 0)
  const totalExpected = monthPayments.reduce((s, p) => s + p.amount, 0) + legacyExpectedWithDate
  const totalReceived = receivedThisMonth.reduce((s, p) => s + p.amount, 0)
  const totalPending = expectedThisMonth.reduce((s, p) => s + p.amount, 0)
  const pct = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0

  const isCurrentMonth = selectedMonth === getCurrentMonth()

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
  }

  return (
    <div className="h-full overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 sm:p-6 space-y-6">

        {/* Header + month selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Finance</h2>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { const i = allMonths.indexOf(selectedMonth); if (i < allMonths.length - 1) setSelectedMonth(allMonths[i + 1]) }}
              disabled={allMonths.indexOf(selectedMonth) >= allMonths.length - 1}
              className={`p-1.5 rounded-lg transition-colors ${allMonths.indexOf(selectedMonth) < allMonths.length - 1 ? 'hover:bg-white' : 'opacity-30 cursor-not-allowed'}`}
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-800 px-2 min-w-[120px] text-center">{formatMonth(selectedMonth)}</span>
            <button
              onClick={() => { const i = allMonths.indexOf(selectedMonth); if (i > 0) setSelectedMonth(allMonths[i - 1]) }}
              disabled={selectedMonth >= getCurrentMonth()}
              className={`p-1.5 rounded-lg transition-colors ${selectedMonth < getCurrentMonth() ? 'hover:bg-white' : 'opacity-30 cursor-not-allowed'}`}
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Budget vs Receipts — only if there's payment data */}
        {totalExpected > 0 && (
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Budget vs Receipts</div>
                <div className="text-2xl font-bold text-gray-900">₪{totalReceived.toFixed(0)}</div>
                <div className="text-xs text-gray-400">of ₪{totalExpected.toFixed(0)} expected</div>
              </div>
              <div className={`text-3xl font-black ${pct >= 100 ? 'text-green-500' : pct >= 50 ? 'text-blue-500' : 'text-orange-400'}`}>
                {pct}%
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div>
                <div className="text-xs text-gray-400">Expected</div>
                <div className="text-sm font-bold text-gray-700">₪{totalExpected.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Received</div>
                <div className="text-sm font-bold text-green-600">₪{totalReceived.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Pending</div>
                <div className="text-sm font-bold text-orange-500">₪{totalPending.toFixed(0)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Overdue */}
        {overdue.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <h3 className="text-sm font-semibold text-red-600">Overdue ({overdue.length})</h3>
            </div>
            <div className="space-y-2">
              {overdue.map((p) => {
                const project = projectMap.get(p.project_id)
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    {project && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{p.description}</div>
                      <div className="text-xs text-gray-400">{project?.title} · expected {p.due_date ? formatDate(p.due_date) : '—'}</div>
                    </div>
                    <span className="text-sm font-bold text-red-600 shrink-0">₪{p.amount.toFixed(0)}</span>
                    <button onClick={() => markPaid(p.id)} className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shrink-0">✓ Received</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Expected this month — new payments */}
        {expectedThisMonth.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold text-gray-700">
                {isCurrentMonth ? 'Expected this month' : `Expected in ${formatMonth(selectedMonth)}`}
              </h3>
              <span className="text-xs text-gray-400 ml-auto">₪{totalPending.toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              {expectedThisMonth.map((p) => {
                const project = projectMap.get(p.project_id)
                const status = getEffectiveStatus(p)
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${status === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
                    {project && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{p.description}</div>
                      <div className="text-xs text-gray-400">
                        {project?.title}
                        {p.due_date ? ` · expected ${formatDate(p.due_date)}` : ''}
                        {p.invoice_ref ? ` · #${p.invoice_ref}` : ''}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-700 shrink-0">₪{p.amount.toFixed(0)}</span>
                    <button onClick={() => markPaid(p.id)} className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium shrink-0 whitespace-nowrap">
                      ✓ Received
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Legacy financials for this month */}
        {monthLegacy.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <h3 className="text-sm font-semibold text-gray-700">Records</h3>
              <span className="text-xs text-gray-400 ml-auto">₪{legacyExpected.toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              {monthLegacy.map((f) => {
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
        {receivedThisMonth.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <h3 className="text-sm font-semibold text-gray-700">Received</h3>
              <span className="text-xs text-gray-400 ml-auto">₪{totalReceived.toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              {receivedThisMonth.map((p) => {
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

        {monthPayments.length === 0 && monthLegacy.length === 0 && overdue.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No data for {formatMonth(selectedMonth)}.<br />
            <span className="text-xs">Add payments inside each project's Financials tab.</span>
          </div>
        )}

      </div>
    </div>
  )
}
