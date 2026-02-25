import type { ReactNode } from 'react'

interface SidebarProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function Sidebar({ open, onClose, children }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-80 bg-white border-r border-gray-200
          flex flex-col
          transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:translate-x-0
        `}
      >
        {/* Mobile header spacer */}
        <div className="h-14 border-b border-gray-200 flex items-center px-4 lg:hidden">
          <h2 className="font-semibold text-gray-900">Projects</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {children}
        </div>
      </aside>
    </>
  )
}
