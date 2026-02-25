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
    const { data, error } = await supabase
      .from('users')
      .insert({ name })
      .select()
      .single()

    if (error) throw error
    if (data) {
      localStorage.setItem(USER_STORAGE_KEY, data.id)
      setUserState(data)
    }
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
