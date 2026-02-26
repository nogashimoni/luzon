import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { supabase } from '../../config/supabase'
import type { ChecklistItem } from '../../types'

interface ChecklistModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectTitle: string
}

export default function ChecklistModal({ open, onClose, projectId, projectTitle }: ChecklistModalProps) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [newItemText, setNewItemText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      fetchItems()

      // Subscribe to real-time updates
      const channel = supabase
        .channel(`checklist-${projectId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'project_checklist_items', filter: `project_id=eq.${projectId}` },
          () => {
            fetchItems()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [open, projectId])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('project_checklist_items')
      .select('*')
      .eq('project_id', projectId)
      .order('item_order', { ascending: true })

    if (data) setItems(data)
    setLoading(false)
  }

  async function addItem() {
    if (!newItemText.trim()) return

    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.item_order)) : 0

    const { error } = await supabase
      .from('project_checklist_items')
      .insert({
        project_id: projectId,
        text: newItemText.trim(),
        completed: false,
        item_order: maxOrder + 1,
      })

    if (!error) {
      setNewItemText('')
    }
  }

  async function toggleItem(id: string, completed: boolean) {
    await supabase
      .from('project_checklist_items')
      .update({ completed: !completed })
      .eq('id', id)
  }

  async function deleteItem(id: string) {
    await supabase
      .from('project_checklist_items')
      .delete()
      .eq('id', id)
  }

  const completedCount = items.filter(i => i.completed).length

  return (
    <Modal open={open} onClose={onClose} title={`${projectTitle} - Checklist`}>
      <div className="space-y-4">
        {/* Progress */}
        {items.length > 0 && (
          <div className="text-sm text-gray-600 font-medium">
            {completedCount} of {items.length} completed
          </div>
        )}

        {/* Add new item */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add new task..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 transition-all"
          />
          <Button onClick={addItem} disabled={!newItemText.trim()}>
            Add
          </Button>
        </div>

        {/* Items list */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No tasks yet. Add one above to get started!
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => toggleItem(item.id, item.completed)}
                  className="mt-0.5 rounded border-gray-300 text-[#007aff] focus:ring-[#007aff] cursor-pointer"
                />
                <span
                  className={`flex-1 text-sm ${
                    item.completed ? 'line-through text-gray-400' : 'text-gray-900'
                  }`}
                >
                  {item.text}
                </span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 text-xs font-medium transition-opacity"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
