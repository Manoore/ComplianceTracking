import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { clsx } from 'clsx'

const TYPE_ICONS: Record<string, string> = {
  inspection_submitted: '📋',
  inspection_approved: '✅',
  inspection_rejected: '❌',
  action_assigned: '⚠️',
  action_due: '⏰',
  action_overdue: '🔴',
  certification_assigned: '🎓',
  certification_expiring: '⏳',
  critical_finding: '🚨',
  announcement: '📢',
  default: '🔔',
}

const TYPE_LINKS: Record<string, (id?: number) => string> = {
  inspection_submitted: (id) => `/inspections/${id}`,
  inspection_approved: (id) => `/inspections/${id}`,
  inspection_rejected: (id) => `/inspections/${id}`,
  action_assigned: (id) => `/corrective-actions`,
  action_overdue: () => `/corrective-actions`,
  certification_assigned: () => `/certifications`,
  announcement: () => `/announcements`,
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: countData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=20').then(r => r.data),
    enabled: open,
  })

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const count = countData?.count ?? 0

  const handleNotifClick = (n: any) => {
    markRead.mutate(n.id)
    const linkFn = TYPE_LINKS[n.type]
    if (linkFn) navigate(linkFn(n.resource_id))
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-brand-200 hover:text-white hover:bg-brand-700 rounded-lg transition-colors"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button onClick={() => markAll.mutate()} className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {(notifications ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
            ) : (
              (notifications ?? []).map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={clsx(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50',
                    !n.is_read && 'bg-brand-50'
                  )}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] || TYPE_ICONS.default}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm leading-snug', !n.is_read ? 'font-medium text-gray-900' : 'text-gray-700')}>
                      {n.title}
                    </p>
                    {n.message && <p className="text-xs text-gray-400 mt-0.5 truncate">{n.message}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 bg-brand-500 rounded-full mt-2 flex-shrink-0" />}
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 text-center">
            <button onClick={() => { navigate('/notifications'); setOpen(false) }}
              className="text-xs text-brand-600 hover:text-brand-800">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
