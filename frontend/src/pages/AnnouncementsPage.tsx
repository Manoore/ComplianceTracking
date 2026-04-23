import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Pin, Plus, CheckCheck, X, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

function NewAnnouncementModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: '',
    body: '',
    target: 'all',
    is_pinned: false,
    requires_acknowledgment: false,
  })
  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/announcements', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Announcement posted'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Error'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Announcement</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <form className="p-6 space-y-4" onSubmit={e => { e.preventDefault(); mutation.mutate(form) }}>
          <div>
            <label className="label">Title *</label>
            <input required className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Body *</label>
            <textarea required rows={5} className="input" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your announcement…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Target Audience</label>
              <select className="input" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}>
                <option value="all">Everyone</option>
                <option value="role:admin">Admins</option>
                <option value="role:manager">Managers</option>
                <option value="role:auditor">Auditors</option>
                <option value="role:team_member">Team Members</option>
              </select>
            </div>
            <div className="space-y-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} className="accent-brand-600" />
                <span className="text-sm">Pin this announcement</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requires_acknowledgment} onChange={e => setForm(f => ({ ...f, requires_acknowledgment: e.target.checked }))} className="accent-brand-600" />
                <span className="text-sm">Require acknowledgment</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Posting…' : 'Post Announcement'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AnnouncementCard({ ann }: { ann: any }) {
  const qc = useQueryClient()
  const { user } = useAuth()

  const markRead = useMutation({
    mutationFn: () => api.post(`/announcements/${ann.id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const acknowledge = useMutation({
    mutationFn: () => api.post(`/announcements/${ann.id}/acknowledge`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Acknowledged') },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const deactivate = useMutation({
    mutationFn: () => api.delete(`/announcements/${ann.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Error'),
  })

  // Auto-mark read on render
  if (!ann.is_read) {
    markRead.mutate()
  }

  return (
    <div className={clsx('card', ann.is_pinned && 'border-l-4 border-brand-500')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {ann.is_pinned && <Pin size={14} className="text-brand-500 flex-shrink-0" />}
            <h3 className="font-semibold text-gray-900">{ann.title}</h3>
            {!ann.is_read && <span className="badge bg-brand-100 text-brand-700 text-xs">New</span>}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ann.body}</p>
          {(ann.attachments ?? []).length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {ann.attachments.map((att: any, i: number) => (
                <a key={i} href={att.url} target="_blank" rel="noopener"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:underline bg-brand-50 px-2 py-1 rounded">
                  <Paperclip size={11} /> {att.name}
                </a>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span>By {ann.creator_name}</span>
            <span>{new Date(ann.created_at).toLocaleDateString()}</span>
            {ann.read_count > 0 && <span>{ann.read_count} read</span>}
          </div>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          {ann.requires_acknowledgment && !ann.is_acknowledged && (
            <button className="btn-primary py-1.5 text-xs" onClick={() => acknowledge.mutate()}
              disabled={acknowledge.isPending}>
              <CheckCheck size={13} /> Acknowledge
            </button>
          )}
          {ann.requires_acknowledgment && ann.is_acknowledged && (
            <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
              <CheckCheck size={12} /> Acknowledged
            </span>
          )}
          {user?.role === 'admin' && (
            <button className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
              onClick={() => { if (confirm('Delete announcement?')) deactivate.mutate() }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AnnouncementsPage() {
  const { user } = useAuth()
  const [showNew, setShowNew] = useState(false)
  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get('/announcements').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Team Announcements</h1>
        {user?.role === 'admin' && (
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> New Announcement
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {(announcements ?? []).map((ann: any) => (
            <AnnouncementCard key={ann.id} ann={ann} />
          ))}
          {(announcements?.length ?? 0) === 0 && (
            <p className="text-center py-16 text-gray-400">No announcements yet</p>
          )}
        </div>
      )}

      {showNew && <NewAnnouncementModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
