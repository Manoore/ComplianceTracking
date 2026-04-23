import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Bell } from 'lucide-react'
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
  action_assigned: () => `/corrective-actions`,
  action_overdue: () => `/corrective-actions`,
  certification_assigned: () => `/certifications`,
  announcement: () => `/announcements`,
}

export function NotificationsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications-all'],
    queryFn: () => api.get('/notifications?limit=100').then(r => r.data),
  })

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-count'] })
      qc.invalidateQueries({ queryKey: ['notifications-all'] })
    },
  })

  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-count'] })
      qc.invalidateQueries({ queryKey: ['notifications-all'] })
    },
  })

  const handleClick = (n: any) => {
    if (!n.is_read) markRead.mutate(n.id)
    const linkFn = TYPE_LINKS[n.type]
    if (linkFn) navigate(linkFn(n.resource_id))
  }

  const unreadCount = (notifications ?? []).filter((n: any) => !n.is_read).length

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button className="btn-secondary" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (notifications ?? []).length === 0 ? (
        <div className="card text-center py-16">
          <Bell size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No notifications yet</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-gray-50">
          {(notifications ?? []).map((n: any) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              className={clsx(
                'flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors',
                !n.is_read && 'bg-brand-50'
              )}
            >
              <span className="text-2xl flex-shrink-0 mt-0.5">
                {TYPE_ICONS[n.type] || TYPE_ICONS.default}
              </span>
              <div className="flex-1 min-w-0">
                <p className={clsx('text-sm leading-snug', !n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                  {n.title}
                </p>
                {n.message && (
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              {!n.is_read && (
                <div className="w-2.5 h-2.5 bg-brand-500 rounded-full mt-2 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
