import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { ShieldCheck, Plus, Pencil, Trash2, X, Upload, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

interface Credential {
  id: number
  user_id: number
  user_name?: string
  user_email?: string
  title: string
  credential_type: string
  issuing_body?: string
  credential_number?: string
  issue_date?: string
  expiry_date?: string
  expiry_status: 'expired' | 'expiring_soon' | 'expiring_90' | 'valid' | 'no_expiry'
  notes?: string
  file_url?: string
  file_name?: string
}

interface Summary {
  total: number
  expired: number
  expiring_30: number
  expiring_90: number
  valid: number
  items_expiring_soon: Credential[]
}

const CREDENTIAL_TYPES = [
  { value: 'medical_license', label: 'Medical License' },
  { value: 'dea_registration', label: 'DEA Registration' },
  { value: 'bls_cpr', label: 'BLS / CPR' },
  { value: 'acls', label: 'ACLS' },
  { value: 'pals', label: 'PALS' },
  { value: 'malpractice_insurance', label: 'Malpractice Insurance' },
  { value: 'state_license', label: 'State License' },
  { value: 'clia_cert', label: 'CLIA Certificate' },
  { value: 'osha_training', label: 'OSHA Training' },
  { value: 'hipaa_training', label: 'HIPAA Training' },
  { value: 'board_certification', label: 'Board Certification' },
  { value: 'npi', label: 'NPI' },
  { value: 'other', label: 'Other' },
]

const EXPIRY_STATUS = {
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-800', icon: AlertTriangle },
  expiring_soon: { label: 'Expires ≤30d', cls: 'bg-orange-100 text-orange-800', icon: Clock },
  expiring_90: { label: 'Expires ≤90d', cls: 'bg-amber-100 text-amber-800', icon: Clock },
  valid: { label: 'Valid', cls: 'bg-green-100 text-green-800', icon: CheckCircle },
  no_expiry: { label: 'No Expiry', cls: 'bg-gray-100 text-gray-600', icon: CheckCircle },
}

interface CredForm {
  user_id: number | ''
  title: string
  credential_type: string
  issuing_body: string
  credential_number: string
  issue_date: string
  expiry_date: string
  notes: string
}

function CredModal({ cred, onClose }: { cred?: Credential; onClose: () => void }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const [form, setForm] = useState<CredForm>({
    user_id: cred?.user_id ?? user?.id ?? '',
    title: cred?.title ?? '',
    credential_type: cred?.credential_type ?? 'other',
    issuing_body: cred?.issuing_body ?? '',
    credential_number: cred?.credential_number ?? '',
    issue_date: cred?.issue_date ?? '',
    expiry_date: cred?.expiry_date ?? '',
    notes: cred?.notes ?? '',
  })
  const [file, setFile] = useState<File | null>(null)

  const save = useMutation({
    mutationFn: async (data: object) => {
      const res = cred
        ? await api.put(`/credentials/${cred.id}`, data).then(r => r.data)
        : await api.post('/credentials', data).then(r => r.data)
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        await api.post(`/credentials/${res.id}/file`, fd)
      }
      return res
    },
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['credentials'] }); qc.invalidateQueries({ queryKey: ['cred-summary'] }); onClose() },
    onError: () => toast.error('Failed to save'),
  })

  const f = (key: keyof CredForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{cred ? 'Edit Credential' : 'Add Credential'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.title} onChange={f('title')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.credential_type} onChange={f('credential_type')}>
                {CREDENTIAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Body</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.issuing_body} onChange={f('issuing_body')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credential Number</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.credential_number} onChange={f('credential_number')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.issue_date} onChange={f('issue_date')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.expiry_date} onChange={f('expiry_date')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attach Document</label>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
              <Upload size={16} />
              {file ? file.name : (cred?.file_name ?? 'Upload PDF, JPG, PNG, or DOC')}
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (!form.title.trim()) { toast.error('Title required'); return; } save.mutate({ ...form, user_id: form.user_id || undefined }) }}
            disabled={save.isPending}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CredentialsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'auditor'
  const [showModal, setShowModal] = useState(false)
  const [editCred, setEditCred] = useState<Credential | undefined>()
  const [tab, setTab] = useState<'all' | 'expiring'>('all')

  const { data: credentials = [], isLoading } = useQuery<Credential[]>({
    queryKey: ['credentials', tab],
    queryFn: () => api.get('/credentials', { params: tab === 'expiring' ? { expiring_days: 90 } : {} }).then(r => r.data),
  })

  const { data: summary } = useQuery<Summary>({
    queryKey: ['cred-summary'],
    queryFn: () => api.get('/credentials/summary').then(r => r.data),
    enabled: isAdmin,
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/credentials/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['credentials'] }); qc.invalidateQueries({ queryKey: ['cred-summary'] }) },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-brand-600" size={26} /> Credentialing
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track staff licenses, certifications, and expiry dates.</p>
        </div>
        <button onClick={() => { setEditCred(undefined); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
          <Plus size={16} /> Add Credential
        </button>
      </div>

      {isAdmin && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Expired', value: summary.expired, cls: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Expiring ≤30d', value: summary.expiring_30, cls: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Expiring ≤90d', value: summary.expiring_90, cls: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Valid', value: summary.valid, cls: 'text-green-600', bg: 'bg-green-50' },
          ].map(({ label, value, cls, bg }) => (
            <div key={label} className={`rounded-xl border border-gray-200 p-4 ${bg}`}>
              <p className={`text-2xl font-bold ${cls}`}>{value}</p>
              <p className="text-sm text-gray-600 font-medium">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([['all', 'All Credentials'], ['expiring', 'Expiring Soon']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" /></div>
      ) : credentials.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldCheck size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No credentials found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Credential</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Expires</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {credentials.map(c => {
                const st = EXPIRY_STATUS[c.expiry_status] ?? EXPIRY_STATUS.valid
                const Icon = st.icon
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{c.user_name}</p>
                        <p className="text-xs text-gray-400">{c.user_email}</p>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.title}</p>
                      {c.issuing_body && <p className="text-xs text-gray-400">{c.issuing_body}</p>}
                      {c.credential_number && <p className="text-xs text-gray-400 font-mono">#{c.credential_number}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {CREDENTIAL_TYPES.find(t => t.value === c.credential_type)?.label ?? c.credential_type}
                    </td>
                    <td className="px-4 py-3">
                      {c.expiry_date ? (
                        <span className="text-gray-700">{new Date(c.expiry_date).toLocaleDateString()}</span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>
                        <Icon size={11} /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {c.file_url && (
                          <a href={c.file_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View document">
                            <Upload size={14} />
                          </a>
                        )}
                        <button onClick={() => { setEditCred(c); setShowModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => { if (confirm('Delete this credential?')) del.mutate(c.id) }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <CredModal cred={editCred} onClose={() => { setShowModal(false); setEditCred(undefined) }} />}
    </div>
  )
}
