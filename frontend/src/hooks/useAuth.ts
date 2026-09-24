import React, { useState, useEffect, useContext, createContext } from 'react'
import api from '../services/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  impersonating: boolean
  startImpersonation: (userId: number) => Promise<void>
  stopImpersonation: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
  impersonating: false,
  startImpersonation: async () => {},
  stopImpersonation: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Presence of a stashed "real" token is what marks an admin session as currently
  // viewing as someone else -- see startImpersonation/stopImpersonation below.
  const [impersonating, setImpersonating] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }
    setImpersonating(!!localStorage.getItem('real_access_token'))
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
    setImpersonating(false)
  }

  const refreshUser = async () => {
    const r = await api.get('/auth/me')
    setUser(r.data)
  }

  // Admin-only "View As": swaps the active session for the target user's own
  // token (issued by POST /auth/impersonate) so every page renders exactly as
  // they'd see it, while stashing the admin's real tokens to restore later.
  // Every existing endpoint "just works" unmodified since it only ever looks at
  // whose token this is, not who originally logged in.
  const startImpersonation = async (userId: number) => {
    const realAccess = localStorage.getItem('access_token')
    const realRefresh = localStorage.getItem('refresh_token')
    const { data } = await api.post(`/auth/impersonate/${userId}`)
    if (realAccess) localStorage.setItem('real_access_token', realAccess)
    if (realRefresh) localStorage.setItem('real_refresh_token', realRefresh)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    setUser(data.user)
    setImpersonating(true)
  }

  const stopImpersonation = async () => {
    const realAccess = localStorage.getItem('real_access_token')
    const realRefresh = localStorage.getItem('real_refresh_token')
    if (!realAccess) { setImpersonating(false); return }
    localStorage.setItem('access_token', realAccess)
    if (realRefresh) localStorage.setItem('refresh_token', realRefresh)
    localStorage.removeItem('real_access_token')
    localStorage.removeItem('real_refresh_token')
    setImpersonating(false)
    const r = await api.get('/auth/me')
    setUser(r.data)
  }

  return React.createElement(AuthContext.Provider, {
    value: { user, loading, login, logout, refreshUser, impersonating, startImpersonation, stopImpersonation },
  }, children)
}

export function useAuth() {
  return useContext(AuthContext)
}
