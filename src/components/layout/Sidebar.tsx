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
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-80 bg-white border-r border-gray-100
          flex flex-col
          transform transition-transform duration-200
          shadow-sm
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:translate-x-0
        `}
      >
        {/* Mobile header spacer */}
        <div className="h-16 border-b border-gray-100 flex items-center px-5 lg:hidden">
          <h2 className="font-semibold text-gray-900 tracking-tight">Projects</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </aside>
    </>
  )
}
