import { useState, useRef, useEffect } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'
import { User, LogOut, Settings, AlertTriangle, X } from 'lucide-react'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function TrialBanner({ onDismiss }: { onDismiss: () => void }) {
  const { data: tenant } = useQuery({
    queryKey: ['tenant-me'],
    queryFn: () => api.get('/tenants/me').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  if (!tenant?.trial_ends_at) return null

  const daysLeft = Math.ceil(
    (new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  if (daysLeft > 7 || daysLeft < 0) return null

  const urgent = daysLeft <= 2

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${urgent ? 'bg-red-500' : 'bg-amber-500'}`}>
      <div className="flex items-center gap-2 text-white">
        <AlertTriangle size={15} className="flex-shrink-0" />
        <span>
          {daysLeft === 0
            ? 'Your free trial expires today.'
            : `Your free trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}
          {' '}Contact your administrator to upgrade.
        </span>
      </div>
      <button onClick={onDismiss} className="text-white/70 hover:text-white flex-shrink-0">
        <X size={15} />
      </button>
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/home')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: '#1B3260' }}>
          {initials(user.full_name)}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-gray-900 leading-tight truncate max-w-[120px]">{user.full_name}</p>
          <p className="text-xs text-gray-400 capitalize leading-tight">{(user.custom_role || user.role).replace('_', ' ')}</p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden py-1">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          <Link to="/profile" onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <User size={15} className="text-gray-400" /> My Profile
          </Link>
          {user.role === 'admin' && (
            <Link to="/settings" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Settings size={15} className="text-gray-400" /> Organization Settings
            </Link>
          )}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full transition-colors">
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const { user } = useAuth()

  const showTrialBanner = !bannerDismissed && user?.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Trial banner */}
        {showTrialBanner && <TrialBanner onDismiss={() => setBannerDismissed(true)} />}

        {/* Top header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Mobile spacer for hamburger */}
          <div className="w-10 lg:hidden" />
          <div className="flex-1" />
          <UserMenu />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
