import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User } from '../types'
import { supabase } from '../config/supabase'

interface UserContextValue {
  user: User | null
  loading: boolean
  setUser: (name: string) => Promise<void>
  logout: () => void
}

const UserContext = createContext<UserContextValue | null>(null)

const USER_STORAGE_KEY = 'luzon_user_id'

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedId = localStorage.getItem(USER_STORAGE_KEY)
    if (storedId) {
      supabase
        .from('users')
        .select('*')
        .eq('id', storedId)
        .single()
        .then(({ data }) => {
          if (data) setUserState(data)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  async function setUser(name: string) {
    // Only allow Amit or Kiper (hardcoded users)
    const allowedNames = ['Amit', 'Kiper']
    if (!allowedNames.includes(name)) {
      throw new Error('Only Amit and Kiper are allowed to login')
    }

    // Find existing user by name (don't create new users)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('name', name)
      .single()

    if (error || !data) {
      throw new Error('User not found. Only Amit and Kiper can login.')
    }

    localStorage.setItem(USER_STORAGE_KEY, data.id)
    setUserState(data)
  }

  function logout() {
    localStorage.removeItem(USER_STORAGE_KEY)
    setUserState(null)
  }

  return (
    <UserContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUserContext() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUserContext must be used within UserProvider')
  return ctx
}
