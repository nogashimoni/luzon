import { useState } from 'react'
import type { Project } from '../../types'
import { useAllPayments } from '../../hooks/usePayments'

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

export default function FinanceView({ projects }: FinanceViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const { payments, loading, markPaid, getEffectiveStatus } = useAllPayments()

  const projectMap = new Map(projects.map((p) => [p.id, p]))

  // Derive all months that have payments
  const allMonths = [...new Set(payments.map((p) => p.month ?? p.created_at.slice(0, 7)))].sort((a, b) => b.localeCompare(a))
  if (!allMonths.includes(getCurrentMonth())) allMonths.unshift(getCurrentMonth())

  const monthPayments = payments.filter((p) => {
    const pm = p.month ?? p.created_at.slice(0, 7)
    return pm === selectedMonth
  })

  const paid = monthPayments.filter((p) => getEffectiveStatus(p) === 'paid')
  const overdue = payments.filter((p) => getEffectiveStatus(p) === 'overdue')
  const upcoming = payments.filter((p) => {
    const status = getEffectiveStatus(p)
    if (status !== 'expected') return false
    const pm = p.month ?? p.created_at.slice(0, 7)
    return pm === selectedMonth
  })

  const totalExpected = monthPayments.reduce((s, p) => s + p.amount, 0)
  const totalPaid = paid.reduce((s, p) => s + p.amount, 0)
  const totalOutstanding = totalExpected - totalPaid

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
  }

  return (
    <div className="h-full overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 space-y-6">

      {/* Header + month selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Finance</h2>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => {
              const idx = allMonths.indexOf(selectedMonth)
              if (idx < allMonths.length - 1) setSelectedMonth(allMonths[idx + 1])
            }}
            className="p-1.5 hover:bg-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-semibold text-gray-800 px-2 min-w-[120px] text-center">{formatMonth(selectedMonth)}</span>
          <button
            onClick={() => {
              const idx = allMonths.indexOf(selectedMonth)
              if (idx > 0) setSelectedMonth(allMonths[idx - 1])
            }}
            disabled={selectedMonth >= getCurrentMonth()}
            className={`p-1.5 rounded-lg transition-colors ${selectedMonth < getCurrentMonth() ? 'hover:bg-white' : 'opacity-30 cursor-not-allowed'}`}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Expected</div>
          <div className="text-xl font-bold text-gray-800">₪{totalExpected.toFixed(0)}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Collected</div>
          <div className="text-xl font-bold text-green-700">₪{totalPaid.toFixed(0)}</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${totalOutstanding > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
          <div className="text-xs text-gray-500 mb-1">Outstanding</div>
          <div className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-orange-600' : 'text-green-700'}`}>₪{totalOutstanding.toFixed(0)}</div>
        </div>
      </div>

      {/* Overdue — always shown at top if any */}
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
                    <div className="text-xs text-gray-400">{project?.title} · due {p.due_date ? new Date(p.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div>
                  </div>
                  <span className="text-sm font-bold text-red-600 shrink-0">₪{p.amount.toFixed(0)}</span>
                  <button onClick={() => markPaid(p.id)} className="text-xs px-2.5 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shrink-0">✓ Paid</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* This month's payments */}
      {monthPayments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <h3 className="text-sm font-semibold text-gray-700">Payments in {formatMonth(selectedMonth)}</h3>
          </div>
          <div className="space-y-2">
            {monthPayments.map((p) => {
              const project = projectMap.get(p.project_id)
              const status = getEffectiveStatus(p)
              return (
                <div key={p.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${status === 'paid' ? 'bg-green-50 border-green-100' : 'bg-white border-gray-200'}`}>
                  {project && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{p.description}</div>
                    <div className="text-xs text-gray-400">{project?.title}{p.invoice_ref ? ` · #${p.invoice_ref}` : ''}</div>
                  </div>
                  <span className="text-sm font-bold text-gray-700 shrink-0">₪{p.amount.toFixed(0)}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                  {status !== 'paid' && (
                    <button onClick={() => markPaid(p.id)} className="text-xs px-2.5 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shrink-0">✓</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {monthPayments.length === 0 && overdue.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No payments for {formatMonth(selectedMonth)}.<br />
          <span className="text-xs">Add payments inside each project's Financials tab.</span>
        </div>
      )}
    </div>
  )
}
