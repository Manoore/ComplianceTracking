import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Building2, ClipboardList, Search,
  ShieldCheck, CheckSquare, AlertTriangle, BarChart2,
  Users, LogOut, Menu, X, Megaphone, Settings, Bell
} from 'lucide-react'
import { useState } from 'react'
import { NotificationBell } from '../ui/NotificationBell'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager', 'auditor', 'team_member'] },
  { to: '/clinics', icon: Building2, label: 'Clinics', roles: ['admin', 'manager', 'auditor'] },
  { to: '/checklists', icon: ClipboardList, label: 'Checklists', roles: ['admin'] },
  { to: '/inspections', icon: Search, label: 'Inspections', roles: ['admin', 'manager', 'auditor'] },
  { to: '/audits', icon: ShieldCheck, label: 'Audits', roles: ['admin', 'auditor'] },
  { to: '/certifications', icon: CheckSquare, label: 'Certifications', roles: ['admin', 'manager', 'auditor', 'team_member'] },
  { to: '/corrective-actions', icon: AlertTriangle, label: 'Corrective Actions', roles: ['admin', 'manager', 'auditor', 'team_member'] },
  { to: '/announcements', icon: Megaphone, label: 'Announcements', roles: ['admin', 'manager', 'auditor', 'team_member'] },
  { to: '/reports', icon: BarChart2, label: 'Reports', roles: ['admin', 'auditor'] },
  { to: '/users', icon: Users, label: 'Users', roles: ['admin'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const visible = navItems.filter(item => user && item.roles.includes(user.role))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const Nav = () => (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {visible.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            clsx('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-800 text-white'
                : 'text-brand-100 hover:bg-brand-700 hover:text-white'
            )
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-brand-800 text-white rounded-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 bg-brand-800 flex flex-col transition-transform duration-300 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-6 py-4 border-b border-brand-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="text-brand-800" size={18} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">ComplianceTrack</p>
              <p className="text-brand-300 text-xs">Medical Audit Suite</p>
            </div>
          </div>
          <NotificationBell />
        </div>

        <Nav />

        <div className="px-3 py-4 border-t border-brand-700 flex-shrink-0">
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-brand-300 text-xs capitalize">{user?.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-brand-100 hover:text-white hover:bg-brand-700 rounded-lg text-sm transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
