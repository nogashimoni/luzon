import { useRef, useState } from 'react'
import { useUserContext } from '../../contexts/UserContext'
import { exportAllData, importAllData } from '../../utils/excel'

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

export default function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  const { user, logout } = useUserContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportAllData()
      showToast('Export complete', true)
    } catch (e) {
      showToast(`Export failed: ${e instanceof Error ? e.message : String(e)}`, false)
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const { imported, errors } = await importAllData(file)
      if (errors.length > 0) showToast(`Imported ${imported.length} sheets. Errors: ${errors.join(', ')}`, false)
      else showToast(`Imported: ${imported.join(', ')}`, true)
    } catch (e) {
      showToast(`Import failed: ${e instanceof Error ? e.message : String(e)}`, false)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

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
        <div className="flex items-center gap-2">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Export all data to Excel"
            className="text-xs font-medium px-2.5 py-1.5 text-gray-500 hover:text-[#007aff] hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 hidden sm:block"
          >
            {exporting ? '...' : '↓ Export'}
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Import data from Excel"
            className="text-xs font-medium px-2.5 py-1.5 text-gray-500 hover:text-[#007aff] hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 hidden sm:block"
          >
            {importing ? '...' : '↑ Import'}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleImport} className="hidden" />

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

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}
    </header>
  )
}
