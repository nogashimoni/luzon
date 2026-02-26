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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchItems()

      // Subscribe to real-time updates
      const channel = supabase
        .channel(`checklist-${projectId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'project_checklist_items', filter: `project_id=eq.${projectId}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setItems(prev => [...prev, payload.new as ChecklistItem].sort((a, b) => a.item_order - b.item_order))
            } else if (payload.eventType === 'UPDATE') {
              setItems(prev => prev.map(item =>
                item.id === (payload.new as ChecklistItem).id ? payload.new as ChecklistItem : item
              ).sort((a, b) => a.item_order - b.item_order))
            } else if (payload.eventType === 'DELETE') {
              setItems(prev => prev.filter(item => item.id !== (payload.old as ChecklistItem).id))
            }
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
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, completed: !completed } : item
    ))

    await supabase
      .from('project_checklist_items')
      .update({ completed: !completed })
      .eq('id', id)
  }

  async function deleteItem(id: string) {
    // Optimistic delete
    setItems(prev => prev.filter(item => item.id !== id))

    await supabase
      .from('project_checklist_items')
      .delete()
      .eq('id', id)
  }

  function startEdit(item: ChecklistItem) {
    setEditingId(item.id)
    setEditText(item.text)
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return

    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, text: editText.trim() } : item
    ))

    await supabase
      .from('project_checklist_items')
      .update({ text: editText.trim() })
      .eq('id', id)

    setEditingId(null)
    setEditText('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  function handleDragStart(itemId: string) {
    setDraggedItem(itemId)
  }

  function handleDragEnd() {
    setDraggedItem(null)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleDrop(targetId: string) {
    if (!draggedItem || draggedItem === targetId) return

    const draggedIndex = items.findIndex(i => i.id === draggedItem)
    const targetIndex = items.findIndex(i => i.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reorder items
    const newItems = [...items]
    const [removed] = newItems.splice(draggedIndex, 1)
    newItems.splice(targetIndex, 0, removed)

    // Update orders
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      item_order: index
    }))

    setItems(updatedItems)
    setDraggedItem(null)

    // Update in database
    for (const item of updatedItems) {
      await supabase
        .from('project_checklist_items')
        .update({ item_order: item.item_order })
        .eq('id', item.id)
    }
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
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(item.id)}
                className={`flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group cursor-move ${
                  draggedItem === item.id ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => toggleItem(item.id, item.completed)}
                  className="mt-0.5 rounded border-gray-300 text-[#007aff] focus:ring-[#007aff] cursor-pointer"
                />

                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(item.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    onBlur={() => saveEdit(item.id)}
                    autoFocus
                    className="flex-1 px-2 py-1 text-sm border border-[#007aff] rounded focus:ring-2 focus:ring-[#007aff]/20 outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => startEdit(item)}
                    className={`flex-1 text-sm ${
                      item.completed ? 'line-through text-gray-400' : 'text-gray-900'
                    }`}
                  >
                    {item.text}
                  </span>
                )}

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editingId !== item.id && (
                    <button
                      onClick={() => startEdit(item)}
                      className="text-[#007aff] hover:text-[#0051d5] text-xs font-medium"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-red-500 hover:text-red-600 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
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
