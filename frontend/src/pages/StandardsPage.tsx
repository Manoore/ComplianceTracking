import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { BookMarked, Plus, Pencil, Trash2, X, BarChart2, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

interface Standard {
  id: number
  code: string
  name: string
  description?: string
  is_builtin: boolean
  is_active: boolean
}

interface ComplianceRow {
  code: string
  tagged_items: number
  pass: number
  fail: number
  total_answered: number
  compliance_rate: number | null
}

function StandardModal({ std, onClose }: { std?: Standard; onClose: () => void }) {
  const qc = useQueryClient()
  const [code, setCode] = useState(std?.code ?? '')
  const [name, setName] = useState(std?.name ?? '')
  const [description, setDescription] = useState(std?.description ?? '')

  const save = useMutation({
    mutationFn: (data: object) => std
      ? api.put(`/standards/${std.id}`, data).then(r => r.data)
      : api.post('/standards', data).then(r => r.data),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['standards'] }); onClose() },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{std ? 'Edit Standard' : 'Add Standard'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
              placeholder="e.g. OSHA" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2}
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (!code || !name) { toast.error('Code and name required'); return; } save.mutate({ code, name, description }) }}
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

export function StandardsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const [showModal, setShowModal] = useState(false)
  const [editStd, setEditStd] = useState<Standard | undefined>()
  const [tab, setTab] = useState<'standards' | 'compliance'>('standards')

  const { data: standards = [], isLoading } = useQuery<Standard[]>({
    queryKey: ['standards'],
    queryFn: () => api.get('/standards').then(r => r.data),
  })

  const { data: compliance = [], isLoading: loadingCompliance } = useQuery<ComplianceRow[]>({
    queryKey: ['standards-compliance'],
    queryFn: () => api.get('/standards/compliance').then(r => r.data),
    enabled: tab === 'compliance',
  })

  const seedBuiltins = useMutation({
    mutationFn: () => api.post('/standards/seed-builtins').then(r => r.data),
    onSuccess: (data) => { toast.success(`${data.seeded} built-in standards added`); qc.invalidateQueries({ queryKey: ['standards'] }) },
    onError: () => toast.error('Failed to seed'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/standards/${id}`),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['standards'] }) },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookMarked className="text-brand-600" size={26} /> Accreditation Standards
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Map checklist items to regulatory standards and track compliance by framework.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => seedBuiltins.mutate()} disabled={seedBuiltins.isPending}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-60">
              Add Built-in Standards
            </button>
            <button onClick={() => { setEditStd(undefined); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
              <Plus size={16} /> Add Standard
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([['standards', 'Standards Library'], ['compliance', 'Compliance Report']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'standards' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" /></div>
          ) : standards.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookMarked size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No standards yet</p>
              {isAdmin && <p className="text-sm mt-1">Click "Add Built-in Standards" to load OSHA, HIPAA, AAAHC and more.</p>}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {standards.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 bg-brand-50 text-brand-700 rounded font-mono text-xs font-bold">
                          {s.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{s.description ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isAdmin && !s.is_builtin && (
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => { setEditStd(s); setShowModal(true) }}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => { if (confirm('Remove?')) del.mutate(s.id) }}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        {s.is_builtin && <span className="text-xs text-gray-400 pr-2">built-in</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'compliance' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            This report shows compliance rates for checklist items tagged to each standard, across all submitted inspections.
            Tag items in the Checklists page to populate this report.
          </div>
          {loadingCompliance ? (
            <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" /></div>
          ) : compliance.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BarChart2 size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No data yet</p>
              <p className="text-sm mt-1">Tag checklist items with standards to see compliance rates here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {compliance.map(row => {
                const rate = row.compliance_rate
                const color = rate === null ? '#94a3b8' : rate >= 80 ? '#22c55e' : rate >= 60 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={row.code} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <span className="inline-flex items-center px-2 py-1 bg-brand-50 text-brand-700 rounded font-mono text-sm font-bold mr-2">
                          {row.code}
                        </span>
                        <span className="text-sm text-gray-500">{row.tagged_items} tagged items</span>
                      </div>
                      <div className="text-right">
                        {rate !== null ? (
                          <span className="text-2xl font-bold" style={{ color }}>{rate.toFixed(1)}%</span>
                        ) : (
                          <span className="text-sm text-gray-400">No inspections yet</span>
                        )}
                      </div>
                    </div>
                    {rate !== null && (
                      <>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: color }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <CheckCircle size={11} className="text-green-500" />
                            {row.pass} passed
                          </div>
                          <div className="flex items-center gap-1">
                            <AlertCircle size={11} className="text-red-400" />
                            {row.fail} failed
                          </div>
                          <div>{row.total_answered} total answers</div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {showModal && <StandardModal std={editStd} onClose={() => { setShowModal(false); setEditStd(undefined) }} />}
    </div>
  )
}
