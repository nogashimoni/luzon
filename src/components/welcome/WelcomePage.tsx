import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUserContext } from '../../contexts/UserContext'

export default function WelcomePage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { setUser } = useUserContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name')
      return
    }
    if (!password) {
      setError('Please enter the access password')
      return
    }
    if (password !== import.meta.env.VITE_APP_PASSWORD) {
      setError('Incorrect password')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await setUser(trimmed)
      const projectId = searchParams.get('project')
      navigate(projectId ? `/?project=${projectId}` : '/')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">Luzon</h1>
            <p className="text-gray-500 font-medium tracking-tight">Track your project hours</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight"
              >
                Who are you?
              </label>
              <select
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 bg-white transition-all font-medium"
              >
                <option value="">-- Select --</option>
                <option value="Amit">Amit</option>
                <option value="Kiper">Kiper</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight"
              >
                Access Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] outline-none text-gray-900 placeholder-gray-400 transition-all"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-[#007aff] hover:bg-[#0051d5] disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md tracking-tight"
            >
              {submitting ? 'Setting up...' : 'Get Started'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
