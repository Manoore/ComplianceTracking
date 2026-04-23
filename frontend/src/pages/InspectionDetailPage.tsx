import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import type { Inspection } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge } from '../components/ui/Badge'
import { ScoreRing } from '../components/ui/ScoreRing'
import { ArrowLeft, Camera, Send, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

type ItemResult = 'pass' | 'fail' | 'na'

export function InspectionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeItemId, setActiveItemId] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})

  const { data: insp, isLoading } = useQuery<Inspection>({
    queryKey: ['inspection', id],
    queryFn: () => api.get(`/inspections/${id}`).then(r => r.data),
  })

  const updateItem = useMutation({
    mutationFn: ({ itemId, result, note }: { itemId: number; result: ItemResult; note?: string }) =>
      api.put(`/inspections/${id}/items/${itemId}`, { result, notes: note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', id] }),
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const submitInspection = useMutation({
    mutationFn: () => api.post(`/inspections/${id}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection', id] })
      qc.invalidateQueries({ queryKey: ['inspections'] })
      toast.success('Inspection submitted successfully!')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const uploadPhoto = useMutation({
    mutationFn: async ({ itemId, file }: { itemId: number; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.post(`/inspections/${id}/items/${itemId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', id] }),
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Upload failed'),
  })

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )
  if (!insp) return <p className="text-center py-12 text-gray-500">Inspection not found</p>

  const isEditable = (insp.status === 'in_progress' || insp.status === 'draft') &&
    (insp.inspector_id === user?.id || user?.role === 'admin')

  const answered = insp.items.filter(i => i.result && i.result !== 'pending').length
  const total = insp.items.length

  const grouped = insp.items.reduce((acc, item) => {
    const cat = item.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, typeof insp.items>)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{insp.clinic_name}</h1>
          <p className="text-sm text-gray-500">{insp.template_name} · Inspector: {insp.inspector_name}</p>
        </div>
        <div className="flex items-center gap-3">
          {insp.compliance_score != null && <ScoreRing score={insp.compliance_score} size={56} />}
          {statusBadge(insp.status)}
        </div>
      </div>

      {/* Progress */}
      {isEditable && (
        <div className="card py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress: {answered} / {total}</span>
            <span className="text-sm text-gray-500">{total > 0 ? Math.round(answered / total * 100) : 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-brand-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? (answered / total * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Items by category */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="card p-0 overflow-hidden">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800 capitalize">{cat}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className={clsx('p-4', activeItemId === item.id && 'bg-brand-50')}>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-gray-900">{item.question}</p>
                      {item.is_critical && (
                        <span className="flex-shrink-0 badge bg-red-100 text-red-700">Critical</span>
                      )}
                    </div>
                    {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
                    {item.photo_urls.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {item.photo_urls.map((url, i) => (
                          <img key={i} src={url} alt={`Photo ${i + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                        ))}
                      </div>
                    )}
                  </div>

                  {isEditable ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => { updateItem.mutate({ itemId: item.id, result: 'pass', note: notes[item.id] }); setActiveItemId(item.id) }}
                        className={clsx('p-2 rounded-lg transition-colors',
                          item.result === 'pass' ? 'bg-green-100 text-green-700' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                        )}
                        title="Pass"
                      >
                        <CheckCircle size={20} />
                      </button>
                      <button
                        onClick={() => { updateItem.mutate({ itemId: item.id, result: 'fail', note: notes[item.id] }); setActiveItemId(item.id) }}
                        className={clsx('p-2 rounded-lg transition-colors',
                          item.result === 'fail' ? 'bg-red-100 text-red-700' : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                        )}
                        title="Fail"
                      >
                        <XCircle size={20} />
                      </button>
                      <button
                        onClick={() => { updateItem.mutate({ itemId: item.id, result: 'na', note: notes[item.id] }); setActiveItemId(item.id) }}
                        className={clsx('p-2 rounded-lg transition-colors',
                          item.result === 'na' ? 'bg-gray-200 text-gray-700' : 'hover:bg-gray-100 text-gray-400'
                        )}
                        title="N/A"
                      >
                        <MinusCircle size={20} />
                      </button>
                      <button
                        onClick={() => { setActiveItemId(item.id); fileInputRef.current?.click() }}
                        className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg"
                        title="Upload photo"
                      >
                        <Camera size={20} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0] && activeItemId) {
                            uploadPhoto.mutate({ itemId: activeItemId, file: e.target.files[0] })
                            e.target.value = ''
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0">
                      {item.result === 'pass' && <CheckCircle className="text-green-600" size={22} />}
                      {item.result === 'fail' && <XCircle className="text-red-600" size={22} />}
                      {item.result === 'na' && <MinusCircle className="text-gray-400" size={22} />}
                      {(!item.result || item.result === 'pending') && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
                    </div>
                  )}
                </div>

                {isEditable && activeItemId === item.id && (
                  <div className="mt-3">
                    <input
                      className="input text-xs"
                      placeholder="Add notes…"
                      value={notes[item.id] ?? item.notes ?? ''}
                      onChange={e => setNotes(n => ({ ...n, [item.id]: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {isEditable && (
        <div className="flex justify-end">
          <button
            disabled={submitInspection.isPending}
            className="btn-primary"
            onClick={() => {
              if (answered < total) {
                if (!confirm(`${total - answered} items not yet answered. Submit anyway?`)) return
              }
              submitInspection.mutate()
            }}
          >
            <Send size={16} />
            {submitInspection.isPending ? 'Submitting…' : 'Submit Inspection'}
          </button>
        </div>
      )}
    </div>
  )
}
