import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import { User } from '../types'

export function useUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fetch all users
  async function fetchAllUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      setError(err as Error)
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  // Upload avatar to Supabase Storage
  async function uploadAvatar(userId: string, file: File): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (err) {
      console.error('Error uploading avatar:', err)
      setError(err as Error)
      return null
    }
  }

  // Update user's avatar URL in database
  async function updateUserAvatar(userId: string, avatarUrl: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, avatar_url: avatarUrl } : user
        )
      )
    } catch (err) {
      console.error('Error updating user avatar:', err)
      setError(err as Error)
    }
  }

  // Combined function to upload and update avatar
  async function uploadAndUpdateAvatar(userId: string, file: File): Promise<boolean> {
    const avatarUrl = await uploadAvatar(userId, file)
    if (!avatarUrl) return false

    await updateUserAvatar(userId, avatarUrl)
    return true
  }

  // Set up real-time subscription
  useEffect(() => {
    fetchAllUsers()

    const channel = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setUsers((prev) => [...prev, payload.new as User])
          } else if (payload.eventType === 'UPDATE') {
            setUsers((prev) =>
              prev.map((user) =>
                user.id === payload.new.id ? (payload.new as User) : user
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setUsers((prev) => prev.filter((user) => user.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return {
    users,
    loading,
    error,
    uploadAvatar,
    updateUserAvatar,
    uploadAndUpdateAvatar,
    refetch: fetchAllUsers,
  }
}
