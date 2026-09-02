import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Building2, ClipboardList, Search,
  ShieldCheck, CheckSquare, AlertTriangle, BarChart2,
  Users, LogOut, Menu, X, Megaphone, Settings, Shield, FileText
} from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NotificationBell } from '../ui/NotificationBell'
import { CompliNowMark } from '../ui/CompliNowMark'
import api from '../../services/api'

const allNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
  { to: '/clinics', icon: Building2, label: 'Clinics', module: 'clinics' },
  { to: '/checklists', icon: ClipboardList, label: 'Checklists', module: 'checklists' },
  { to: '/inspections', icon: Search, label: 'Inspections', module: 'inspections' },
  { to: '/audits', icon: ShieldCheck, label: 'Audits', module: 'audits' },
  { to: '/certifications', icon: CheckSquare, label: 'Certifications', module: 'certifications' },
  { to: '/corrective-actions', icon: AlertTriangle, label: 'Corrective Actions', module: 'corrective_actions' },
  { to: '/policies', icon: FileText, label: 'Policies', module: 'policies' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements', module: 'announcements' },
  { to: '/reports', icon: BarChart2, label: 'Reports', module: 'reports' },
  { to: '/users', icon: Users, label: 'Users', module: 'users' },
  { to: '/roles', icon: Shield, label: 'Roles & Permissions', module: 'roles' },
  { to: '/settings', icon: Settings, label: 'Settings', module: 'settings' },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const { canView } = usePermissions()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { data: tenant } = useQuery<{ name: string }>({
    queryKey: ['tenant-me'],
    queryFn: () => api.get('/tenants/me').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const visible = allNavItems.filter(item => canView(item.module))

  const displayRole = user?.custom_role
    ? user.custom_role.replace(/_/g, ' ')
    : user?.role.replace('_', ' ')

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
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-brand-800 text-white rounded-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}

      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 bg-brand-800 flex flex-col transition-transform duration-300 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-6 py-4 border-b border-brand-700 flex items-center justify-between">
          <NavLink to="/home" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <CompliNowMark size={32} />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">CompliNow</p>
              <p className="text-brand-300 text-xs">{tenant?.name ?? 'Audit anything, anywhere'}</p>
            </div>
          </NavLink>
          <NotificationBell />
        </div>

        <Nav />

        <div className="px-3 py-4 border-t border-brand-700 flex-shrink-0">
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-brand-300 text-xs capitalize">{displayRole}</p>
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
