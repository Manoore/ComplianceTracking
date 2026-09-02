import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { CorrectiveAction } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge, priorityBadge } from '../components/ui/Badge'
import { Upload, CheckSquare, X, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

function ActionModal({ action, onClose }: { action: CorrectiveAction; onClose: () => void }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data), enabled: user?.role === 'admin' || user?.role === 'auditor' })
  const [form, setForm] = useState({
    assigned_to: action.assigned_to?.toString() ?? '',
    due_date: action.due_date ?? '',
    priority: action.priority,
    description: action.description ?? '',
    status: action.status,
  })

  const update = useMutation({
    mutationFn: (data: any) => api.put(`/corrective-actions/${action.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corrective-actions'] }); toast.success('Saved'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const verify = useMutation({
    mutationFn: () => api.post(`/corrective-actions/${action.id}/verify`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corrective-actions'] }); toast.success('Action verified'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const fileInput = useState<HTMLInputElement | null>(null)

  const uploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post(`/corrective-actions/${action.id}/evidence`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['corrective-actions'] })
      toast.success('Evidence uploaded')
    } catch (err: any) {
      toast.error(apiError(err, 'Upload failed'))
    }
    e.target.value = ''
  }

  const canVerify = (user?.role === 'admin' || user?.role === 'auditor') && action.status === 'resolved'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{action.title}</h2>
            <p className="text-xs text-gray-500">{action.clinic_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2 flex-wrap">{statusBadge(action.status)}{priorityBadge(action.priority)}</div>

          <div><label className="label">Description</label>
            <textarea rows={3} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {(user?.role === 'admin' || user?.role === 'auditor') && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Assign To</label>
                <select className="input" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">— Unassigned —</option>
                  {(users ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div><label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Due Date</label>
              <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Evidence */}
          <div>
            <label className="label">Evidence ({action.evidence.length} file{action.evidence.length !== 1 ? 's' : ''})</label>
            {action.evidence.length > 0 && (
              <div className="space-y-1 mb-2">
                {action.evidence.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                    <a href={ev.file_path} target="_blank" rel="noopener" className="text-brand-600 hover:underline flex-1 truncate">{ev.file_name}</a>
                    {ev.notes && <span className="text-gray-400 text-xs">{ev.notes}</span>}
                  </div>
                ))}
              </div>
            )}
            <label className="btn-secondary cursor-pointer">
              <Upload size={15} /> Upload Evidence
              <input type="file" className="hidden" onChange={uploadEvidence} />
            </label>
          </div>

          <div className="flex gap-3 pt-2 flex-wrap">
            <button className="btn-primary" onClick={() => update.mutate({
              assigned_to: form.assigned_to ? parseInt(form.assigned_to) : null,
              due_date: form.due_date || null,
              priority: form.priority,
              description: form.description,
              status: form.status,
            })} disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
            {canVerify && (
              <button className="btn-secondary" onClick={() => verify.mutate()} disabled={verify.isPending}>
                <CheckSquare size={15} /> Verify Resolved
              </button>
            )}
            {action.requires_reinspection && (user?.role === 'admin' || user?.role === 'manager') && (
              <button className="btn-secondary text-orange-600 border-orange-300 hover:bg-orange-50"
                onClick={() => { onClose(); navigate('/inspections') }}>
                <RefreshCw size={15} /> Schedule Re-Inspection
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CorrectiveActionsPage() {
  const [selected, setSelected] = useState<CorrectiveAction | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const { data: actions, isLoading } = useQuery<CorrectiveAction[]>({
    queryKey: ['corrective-actions', filterStatus],
    queryFn: () => api.get(`/corrective-actions${filterStatus ? `?status=${filterStatus}` : ''}`).then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Corrective Actions</h1>
        <select className="input w-auto text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="verified">Verified</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {(actions ?? []).map(action => (
            <div key={action.id}
              className="card hover:shadow-md transition-shadow cursor-pointer flex items-start gap-4"
              onClick={() => setSelected(action)}>
              <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                action.priority === 'critical' || action.priority === 'high' ? 'bg-red-500'
                : action.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium text-gray-900 leading-snug">{action.title}</p>
                  <div className="flex gap-2 flex-shrink-0">{statusBadge(action.status)}</div>
                </div>
                <p className="text-sm text-gray-500 mt-1">{action.clinic_name}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  {action.assignee_name && <span>Assigned: {action.assignee_name}</span>}
                  {action.due_date && (
                    <span className={new Date(action.due_date) < new Date() && !['resolved', 'verified', 'closed'].includes(action.status) ? 'text-red-500 font-medium' : ''}>
                      Due: {new Date(action.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {action.evidence.length > 0 && <span>{action.evidence.length} evidence file{action.evidence.length !== 1 ? 's' : ''}</span>}
                  {action.requires_reinspection && <span className="text-orange-500">Requires re-inspection</span>}
                </div>
              </div>
            </div>
          ))}
          {(actions?.length ?? 0) === 0 && (
            <p className="text-center py-16 text-gray-400">No corrective actions found</p>
          )}
        </div>
      )}

      {selected && <ActionModal action={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
