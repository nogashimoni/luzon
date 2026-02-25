import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUserContext } from './contexts/UserContext'
import AppLayout from './components/layout/AppLayout'
import WelcomePage from './components/welcome/WelcomePage'
import LoadingSpinner from './components/ui/LoadingSpinner'

function AppRoutes() {
  const { user, loading } = useUserContext()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <AppLayout /> : <Navigate to="/welcome" replace />}
      />
      <Route
        path="/welcome"
        element={user ? <Navigate to="/" replace /> : <WelcomePage />}
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </BrowserRouter>
  )
}
