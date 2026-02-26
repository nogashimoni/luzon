import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { supabase } from '../../config/supabase'
import type { ProjectFinancials } from '../../types'

interface FinancialsModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectTitle: string
}

export default function FinancialsModal({ open, onClose, projectId, projectTitle }: FinancialsModalProps) {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth())
  const [income, setIncome] = useState('')
  const [expenses, setExpenses] = useState('')
  const [notes, setNotes] = useState('')
  const [allMonths, setAllMonths] = useState<ProjectFinancials[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      fetchAllMonths()

      // Subscribe to real-time updates
      const channel = supabase
        .channel(`financials-${projectId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'project_financials', filter: `project_id=eq.${projectId}` },
          () => {
            fetchAllMonths()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [open, projectId])

  useEffect(() => {
    if (allMonths.length > 0) {
      const monthData = allMonths.find(m => m.month === currentMonth)
      if (monthData) {
        setIncome(monthData.income.toString())
        setExpenses(monthData.expenses.toString())
        setNotes(monthData.notes || '')
      } else {
        setIncome('')
        setExpenses('')
        setNotes('')
      }
    }
  }, [currentMonth, allMonths])

  function getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  function formatMonthDisplay(month: string) {
    const [year, monthNum] = month.split('-')
    const date = new Date(parseInt(year), parseInt(monthNum) - 1)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }

  function previousMonth() {
    const [year, month] = currentMonth.split('-').map(Number)
    const date = new Date(year, month - 2) // month - 1 - 1 (0-indexed and go back one)
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  function nextMonth() {
    const [year, month] = currentMonth.split('-').map(Number)
    const date = new Date(year, month) // month - 1 + 1
    const now = getCurrentMonth()
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (newMonth <= now) {
      setCurrentMonth(newMonth)
    }
  }

  async function fetchAllMonths() {
    setLoading(true)
    const { data } = await supabase
      .from('project_financials')
      .select('*')
      .eq('project_id', projectId)
      .order('month', { ascending: false })

    if (data) setAllMonths(data)
    setLoading(false)
  }

  async function saveMonth() {
    const incomeNum = parseFloat(income) || 0
    const expensesNum = parseFloat(expenses) || 0

    const { error } = await supabase
      .from('project_financials')
      .upsert({
        project_id: projectId,
        month: currentMonth,
        income: incomeNum,
        expenses: expensesNum,
        notes: notes.trim() || null,
      }, {
        onConflict: 'project_id,month'
      })

    if (!error) {
      fetchAllMonths()
    }
  }

  const incomeNum = parseFloat(income) || 0
  const expensesNum = parseFloat(expenses) || 0
  const profit = incomeNum - expensesNum

  const totalIncome = allMonths.reduce((sum, m) => sum + m.income, 0)
  const totalExpenses = allMonths.reduce((sum, m) => sum + m.expenses, 0)
  const totalProfit = totalIncome - totalExpenses

  const isCurrentMonth = currentMonth === getCurrentMonth()
  const canGoNext = currentMonth < getCurrentMonth()

  return (
    <Modal open={open} onClose={onClose} title={`${projectTitle} - Financials`}>
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <div className="font-semibold text-gray-900">{formatMonthDisplay(currentMonth)}</div>
            {isCurrentMonth && <div className="text-xs text-[#007aff]">Current Month</div>}
          </div>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className={`p-2 rounded-lg transition-colors ${
              canGoNext ? 'hover:bg-white' : 'opacity-30 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Income and Expenses inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">
              Income
            </label>
            <input
              type="number"
              step="0.01"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              onBlur={saveMonth}
              placeholder="0.00"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">
              Expenses
            </label>
            <input
              type="number"
              step="0.01"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              onBlur={saveMonth}
              placeholder="0.00"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 transition-all"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5 tracking-tight">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveMonth}
            placeholder="Add notes about this month..."
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 resize-none transition-all"
          />
        </div>

        {/* Current month profit */}
        <div className={`p-4 rounded-xl ${profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-sm text-gray-600 mb-1">This Month's Profit</div>
          <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${profit.toFixed(2)}
          </div>
        </div>

        {/* All months summary */}
        {allMonths.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">All Time Summary</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Total Income</div>
                <div className="text-lg font-bold text-blue-600">${totalIncome.toFixed(2)}</div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Total Expenses</div>
                <div className="text-lg font-bold text-orange-600">${totalExpenses.toFixed(2)}</div>
              </div>
              <div className={`p-3 rounded-lg ${totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="text-xs text-gray-600 mb-1">Total Profit</div>
                <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalProfit.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Month list */}
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
              {allMonths.map((monthData) => {
                const monthProfit = monthData.income - monthData.expenses
                return (
                  <button
                    key={monthData.id}
                    onClick={() => setCurrentMonth(monthData.month)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                      currentMonth === monthData.month
                        ? 'bg-blue-50 border-2 border-[#007aff]'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {formatMonthDisplay(monthData.month)}
                    </span>
                    <span className={`text-sm font-bold ${monthProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${monthProfit.toFixed(2)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      )}
    </Modal>
  )
}
