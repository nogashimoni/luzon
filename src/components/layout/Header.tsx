import { useUserContext } from '../../contexts/UserContext'

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
  onOpenMenuRecommender: () => void
}

export default function Header({ onToggleSidebar, sidebarOpen, onOpenMenuRecommender }: HeaderProps) {
  const { user, logout } = useUserContext()

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-5 shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 hover:bg-gray-50 rounded-lg text-gray-600 cursor-pointer transition-colors"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Luzon</h1>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMenuRecommender}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#007aff]/10 hover:bg-[#007aff]/20 text-[#007aff] text-xs font-semibold transition-colors"
            title="Menu Recommender"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="hidden sm:inline">Menu</span>
          </button>
          <span className="text-sm text-gray-600 hidden sm:inline font-medium tracking-tight">{user.name}</span>
          <div className="w-9 h-9 rounded-full bg-[#007aff] text-white flex items-center justify-center text-sm font-semibold shadow-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={logout}
            className="text-xs font-medium text-gray-400 hover:text-[#007aff] cursor-pointer transition-colors tracking-tight"
          >
            Switch
          </button>
        </div>
      )}
    </header>
  )
}
