import React, { useState, useEffect, useContext, createContext } from 'react'
import api from '../services/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me').then((r) => setUser(r.data)).catch(() => {
      localStorage.clear()
    }).finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    setUser(data.user)
  }

  const logout = () => {
    api.post('/auth/logout').catch(() => {})
    localStorage.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    const r = await api.get('/auth/me')
    setUser(r.data)
  }

  return React.createElement(AuthContext.Provider, { value: { user, loading, login, logout, refreshUser } }, children)
}

export function useAuth() {
  return useContext(AuthContext)
}
