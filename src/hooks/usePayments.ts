import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import type { ProjectPayment, PaymentStatus } from '../types'

export function usePayments(projectId: string) {
  const [payments, setPayments] = useState<ProjectPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPayments()
    const ch = supabase
      .channel(`payments-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_payments', filter: `project_id=eq.${projectId}` }, () => fetchPayments())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  async function fetchPayments() {
    const { data } = await supabase
      .from('project_payments')
      .select('*')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true, nullsFirst: false })
    if (data) setPayments(data)
    setLoading(false)
  }

  async function addPayment(payment: Omit<ProjectPayment, 'id' | 'created_at' | 'updated_at'>) {
    const { error } = await supabase.from('project_payments').insert(payment)
    if (error) throw error
    await fetchPayments()
  }

  async function updatePayment(id: string, updates: Partial<Pick<ProjectPayment, 'description' | 'amount' | 'work_deadline' | 'due_date' | 'paid_date' | 'status' | 'invoice_ref' | 'month'>>) {
    const { error } = await supabase.from('project_payments').update(updates).eq('id', id)
    if (error) throw error
    await fetchPayments()
  }

  async function deletePayment(id: string) {
    const { error } = await supabase.from('project_payments').delete().eq('id', id)
    if (error) throw error
  }

  async function markPaid(id: string) {
    const { error } = await supabase.from('project_payments').update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) }).eq('id', id)
    if (error) throw error
    await fetchPayments()
  }

  return { payments, loading, addPayment, updatePayment, deletePayment, markPaid }
}

export function useAllPayments() {
  const [payments, setPayments] = useState<ProjectPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
    const ch = supabase
      .channel('all-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_payments' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function fetchAll() {
    const { data } = await supabase
      .from('project_payments')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (data) setPayments(data)
    setLoading(false)
  }

  async function markPaid(id: string) {
    await supabase.from('project_payments').update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) }).eq('id', id)
    await fetchAll()
  }

  async function unmarkPaid(id: string) {
    await supabase.from('project_payments').update({ status: 'expected', paid_date: null }).eq('id', id)
    await fetchAll()
  }

  function getEffectiveStatus(payment: ProjectPayment): PaymentStatus {
    return payment.status
  }

  return { payments, loading, markPaid, unmarkPaid, getEffectiveStatus }
}
