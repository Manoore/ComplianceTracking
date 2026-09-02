import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { Inspection, InspectionItem, ItemType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge } from '../components/ui/Badge'
import { ScoreRing } from '../components/ui/ScoreRing'
import {
  ArrowLeft, Camera, Send, CheckCircle, XCircle, MinusCircle,
  Thermometer, FileText, PenLine, Users, Upload, Hash, Calendar,
  AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

type Result = 'pass' | 'fail' | 'na' | 'pending'

const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  pass_fail_na: 'Pass / Fail / N/A',
  yes_no: 'Yes / No',
  text_input: 'Text Entry',
  numeric: 'Number',
  numeric_range: 'Numeric Range',
  photo: 'Photo Required',
  signature: 'Signature',
  dual_signoff: 'Dual Sign-Off',
  document_upload: 'Document Upload',
  date_picker: 'Date',
  multiple_choice: 'Multiple Choice',
}

function RangeBadge({ value, min, max, unit }: { value: number; min?: number; max?: number; unit?: string }) {
  const inRange = (min === undefined || value >= min) && (max === undefined || value <= max)
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
      inRange ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    )}>
      {inRange ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
      {inRange ? 'In range' : 'OUT OF RANGE'}
      {unit && ` · ${value} ${unit}`}
    </span>
  )
}

function ItemInput({ item, inspId, isEditable }: { item: InspectionItem; inspId: string; isEditable: boolean }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const [localNum, setLocalNum] = useState(item.numeric_value?.toString() ?? '')
  const [localText, setLocalText] = useState(item.text_value ?? '')
  const [localDate, setLocalDate] = useState(item.text_value ?? '')

  const mutate = useMutation({
    mutationFn: (body: object) => api.put(`/inspections/${inspId}/items/${item.id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', inspId] }),
    onError: (e: any) => toast.error(apiError(e)),
  })

  const secondSign = useMutation({
    mutationFn: (body: object) => api.post(`/inspections/${inspId}/items/${item.id}/second-sign`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspection', inspId] }); toast.success('Second sign-off recorded') },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData(); fd.append('file', file)
      return api.post(`/inspections/${inspId}/items/${item.id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', inspId] }),
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Upload failed'),
  })

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData(); fd.append('file', file)
      return api.post(`/inspections/${inspId}/items/${item.id}/document`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspection', inspId] }); toast.success('Document uploaded') },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Upload failed'),
  })

  const cfg = item.type_config ?? {}
  const type = item.item_type ?? 'pass_fail_na'

  if (!isEditable) {
    // Read-only display
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        {type === 'numeric_range' && item.numeric_value != null && (
          <RangeBadge value={item.numeric_value} min={cfg.min} max={cfg.max} unit={cfg.unit} />
        )}
        {type === 'numeric' && item.numeric_value != null && (
          <span className="text-sm font-mono text-gray-700">{item.numeric_value}{cfg.unit ? ` ${cfg.unit}` : ''}</span>
        )}
        {(type === 'text_input' || type === 'date_picker') && item.text_value && (
          <span className="text-xs text-gray-600 max-w-[160px] truncate">{item.text_value}</span>
        )}
        {type === 'signature' && item.text_value && (
          <span className="text-xs text-green-600 flex items-center gap-1"><PenLine size={12} /> Signed</span>
        )}
        {type === 'dual_signoff' && (
          <span className="text-xs flex items-center gap-1">
            {item.text_value && <span className="text-green-600">✓ 1st</span>}
            {item.second_signer_id ? <span className="text-green-600 ml-1">✓ 2nd ({item.second_signer_name})</span> : <span className="text-amber-500 ml-1">⏳ 2nd pending</span>}
          </span>
        )}
        {item.result === 'pass' && !['numeric_range'].includes(type) && <CheckCircle className="text-green-600" size={20} />}
        {item.result === 'fail' && <XCircle className="text-red-600" size={20} />}
        {item.result === 'na' && <MinusCircle className="text-gray-400" size={20} />}
        {(!item.result || item.result === 'pending') && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
      </div>
    )
  }

  // — Numeric range —
  if (type === 'numeric_range') {
    const numVal = parseFloat(localNum)
    const valid = !isNaN(numVal)
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input type="number" step="any" value={localNum}
              onChange={e => setLocalNum(e.target.value)}
              className="input w-32 pr-12 font-mono"
              placeholder="0.0" />
            {cfg.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{cfg.unit}</span>}
          </div>
          {cfg.min !== undefined && cfg.max !== undefined && (
            <span className="text-xs text-gray-400">Range: {cfg.min}–{cfg.max}{cfg.unit ? ` ${cfg.unit}` : ''}</span>
          )}
          <button disabled={!valid || mutate.isPending}
            onClick={() => mutate.mutate({ numeric_value: numVal })}
            className="btn-primary text-xs px-3 py-1.5">
            Record
          </button>
        </div>
        {valid && cfg.min !== undefined && cfg.max !== undefined && (
          <RangeBadge value={numVal} min={cfg.min} max={cfg.max} unit={cfg.unit} />
        )}
        {item.numeric_value != null && (
          <p className="text-xs text-gray-500">Last recorded: <strong>{item.numeric_value}{cfg.unit ? ` ${cfg.unit}` : ''}</strong></p>
        )}
      </div>
    )
  }

  // — Plain numeric —
  if (type === 'numeric') {
    return (
      <div className="mt-3 flex items-center gap-2">
        <div className="relative">
          <input type="number" step="any" value={localNum}
            onChange={e => setLocalNum(e.target.value)}
            className="input w-32 pr-12 font-mono" placeholder="0" />
          {cfg.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{cfg.unit}</span>}
        </div>
        <button disabled={!localNum || mutate.isPending}
          onClick={() => mutate.mutate({ numeric_value: parseFloat(localNum) })}
          className="btn-primary text-xs px-3 py-1.5">
          Save
        </button>
        {item.result === 'pass' && <CheckCircle size={16} className="text-green-600" />}
      </div>
    )
  }

  // — Text input —
  if (type === 'text_input') {
    return (
      <div className="mt-3 space-y-2">
        <textarea rows={2} value={localText} onChange={e => setLocalText(e.target.value)}
          className="input text-sm w-full resize-none" placeholder="Enter your response…" />
        <button disabled={!localText.trim() || mutate.isPending}
          onClick={() => mutate.mutate({ text_value: localText })}
          className="btn-primary text-xs px-3 py-1.5">
          Save
        </button>
      </div>
    )
  }

  // — Date picker —
  if (type === 'date_picker') {
    return (
      <div className="mt-3 flex items-center gap-2">
        <input type="date" value={localDate} onChange={e => setLocalDate(e.target.value)} className="input" />
        <button disabled={!localDate || mutate.isPending}
          onClick={() => mutate.mutate({ text_value: localDate })}
          className="btn-primary text-xs px-3 py-1.5">
          Save
        </button>
        {item.result === 'pass' && <CheckCircle size={16} className="text-green-600" />}
      </div>
    )
  }

  // — Photo required —
  if (type === 'photo') {
    return (
      <div className="mt-3 space-y-2">
        {item.photo_urls.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {item.photo_urls.map((url, i) => (
              <img key={i} src={url} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border" />
            ))}
          </div>
        ) : null}
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 text-sm border-2 border-dashed border-gray-300 rounded-lg px-4 py-2 hover:border-brand-400 hover:bg-brand-50 transition-colors text-gray-500">
          <Camera size={16} /> {item.photo_urls.length > 0 ? 'Add another photo' : 'Take / upload photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { if (e.target.files?.[0]) { uploadPhoto.mutate(e.target.files[0]); e.target.value = '' } }} />
        {uploadPhoto.isPending && <p className="text-xs text-gray-400">Uploading…</p>}
      </div>
    )
  }

  // — Signature —
  if (type === 'signature') {
    return (
      <div className="mt-3">
        {item.text_value ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-600 flex items-center gap-1"><PenLine size={14} /> Signed</span>
            <button onClick={() => mutate.mutate({ signature: '' })} className="text-xs text-gray-400 underline">Clear</button>
          </div>
        ) : (
          <button onClick={() => mutate.mutate({ signature: `signed:${user?.id}:${new Date().toISOString()}` })}
            className="flex items-center gap-2 btn-primary text-sm" disabled={mutate.isPending}>
            <PenLine size={14} /> Tap to Sign
          </button>
        )}
      </div>
    )
  }

  // — Dual sign-off —
  if (type === 'dual_signoff') {
    const firstDone = !!item.text_value
    const secondDone = !!item.second_signer_id
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3">
          <div className={clsx('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
            firstDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
            <PenLine size={11} /> 1st Signature {firstDone ? '✓' : 'Required'}
          </div>
          <div className={clsx('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
            secondDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
            <Users size={11} /> 2nd Signature {secondDone ? `✓ ${item.second_signer_name}` : 'Required'}
          </div>
        </div>
        {!firstDone && (
          <button onClick={() => mutate.mutate({ signature: `signed:${user?.id}:${new Date().toISOString()}` })}
            className="btn-primary text-sm flex items-center gap-2" disabled={mutate.isPending}>
            <PenLine size={14} /> Sign (1st)
          </button>
        )}
        {firstDone && !secondDone && insp_inspector_id !== user?.id && (
          <button onClick={() => secondSign.mutate({ signature: `signed:${user?.id}:${new Date().toISOString()}` })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-100 text-amber-800 hover:bg-amber-200"
            disabled={secondSign.isPending}>
            <Users size={14} /> Sign as 2nd Witness
          </button>
        )}
        {firstDone && !secondDone && (
          <p className="text-xs text-gray-400">A different user must provide the second signature.</p>
        )}
      </div>
    )
  }

  // — Document upload —
  if (type === 'document_upload') {
    return (
      <div className="mt-3 space-y-2">
        {item.document_url ? (
          <a href={item.document_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
            <FileText size={14} /> View uploaded document
          </a>
        ) : null}
        <button onClick={() => docInputRef.current?.click()}
          className="flex items-center gap-2 text-sm border-2 border-dashed border-gray-300 rounded-lg px-4 py-2 hover:border-brand-400 hover:bg-brand-50 transition-colors text-gray-500">
          <Upload size={16} /> {item.document_url ? 'Replace document' : 'Upload document'}
        </button>
        <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" className="hidden"
          onChange={e => { if (e.target.files?.[0]) { uploadDoc.mutate(e.target.files[0]); e.target.value = '' } }} />
        {uploadDoc.isPending && <p className="text-xs text-gray-400">Uploading…</p>}
      </div>
    )
  }

  // — Multiple choice —
  if (type === 'multiple_choice') {
    const options: string[] = cfg.options ?? []
    return (
      <div className="mt-3 flex gap-2 flex-wrap">
        {options.map(opt => (
          <button key={opt}
            onClick={() => mutate.mutate({ text_value: opt, result: 'pass' })}
            className={clsx('px-3 py-1.5 rounded-lg text-sm border transition-colors',
              item.text_value === opt
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-gray-300 text-gray-700 hover:border-brand-400'
            )}>
            {opt}
          </button>
        ))}
      </div>
    )
  }

  // — Default: pass / fail / n/a (and yes/no) —
  const isYesNo = type === 'yes_no'
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={() => mutate.mutate({ result: 'pass' })}
        className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
          item.result === 'pass' ? 'bg-green-100 text-green-700' : 'hover:bg-green-50 text-gray-400 hover:text-green-600 border border-gray-200'
        )}>
        {isYesNo ? 'Yes' : 'Pass'}
      </button>
      <button
        onClick={() => mutate.mutate({ result: 'fail' })}
        className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
          item.result === 'fail' ? 'bg-red-100 text-red-700' : 'hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200'
        )}>
        {isYesNo ? 'No' : 'Fail'}
      </button>
      {!isYesNo && (
        <button
          onClick={() => mutate.mutate({ result: 'na' })}
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            item.result === 'na' ? 'bg-gray-200 text-gray-700' : 'hover:bg-gray-100 text-gray-400 border border-gray-200'
          )}>
          N/A
        </button>
      )}
    </div>
  )
}

// Hack: pass inspector_id down via a module-level var to avoid prop drilling in ItemInput
let insp_inspector_id = 0

export function InspectionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const { data: insp, isLoading } = useQuery<Inspection>({
    queryKey: ['inspection', id],
    queryFn: () => api.get(`/inspections/${id}`).then(r => r.data),
  })

  const submitInspection = useMutation({
    mutationFn: () => api.post(`/inspections/${id}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection', id] })
      qc.invalidateQueries({ queryKey: ['inspections'] })
      toast.success('Inspection submitted successfully!')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const saveNote = useMutation({
    mutationFn: ({ itemId, note }: { itemId: number; note: string }) =>
      api.put(`/inspections/${id}/items/${itemId}`, { notes: note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection', id] }),
  })

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )
  if (!insp) return <p className="text-center py-12 text-gray-500">Inspection not found</p>

  insp_inspector_id = insp.inspector_id

  const isEditable = (insp.status === 'in_progress' || insp.status === 'draft') &&
    (insp.inspector_id === user?.id || user?.role === 'admin')

  const answered = insp.items.filter(i => i.result && i.result !== 'pending').length
  const total = insp.items.length
  const failedCount = insp.items.filter(i => i.result === 'fail').length

  const grouped = insp.items.reduce((acc, item) => {
    const cat = item.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, InspectionItem[]>)

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

      {isEditable && (
        <div className="card py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {answered} / {total}
              {failedCount > 0 && <span className="ml-2 text-red-600 text-xs">· {failedCount} failed</span>}
            </span>
            <span className="text-sm text-gray-500">{total > 0 ? Math.round(answered / total * 100) : 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-brand-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? (answered / total * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="card p-0 overflow-hidden">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800 capitalize">{cat}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const isOpen = expanded[item.id] ?? true
              const needsExpand = ['numeric', 'numeric_range', 'text_input', 'photo', 'signature',
                'dual_signoff', 'document_upload', 'date_picker', 'multiple_choice'].includes(item.item_type)
              return (
                <div key={item.id} className={clsx('p-4', item.result === 'fail' && 'bg-red-50')}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-sm text-gray-900">{item.question}</p>
                        {item.is_critical && (
                          <span className="flex-shrink-0 badge bg-red-100 text-red-700">Critical</span>
                        )}
                        {item.item_type !== 'pass_fail_na' && (
                          <span className="flex-shrink-0 badge bg-blue-50 text-blue-600 text-[10px]">
                            {ITEM_TYPE_LABEL[item.item_type]}
                          </span>
                        )}
                      </div>

                      {/* Type-specific input */}
                      {(!needsExpand || isOpen) && (
                        <ItemInput item={item} inspId={id!} isEditable={isEditable} />
                      )}

                      {/* Photos (for non-photo types) */}
                      {item.photo_urls.length > 0 && item.item_type !== 'photo' && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {item.photo_urls.map((url, i) => (
                            <img key={i} src={url} alt={`Photo ${i + 1}`}
                              className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {isEditable && (
                        <div className="mt-2">
                          <input className="input text-xs" placeholder="Add notes…"
                            value={notes[item.id] ?? item.notes ?? ''}
                            onChange={e => setNotes(n => ({ ...n, [item.id]: e.target.value }))}
                            onBlur={() => { if (notes[item.id] !== undefined) saveNote.mutate({ itemId: item.id, note: notes[item.id] }) }}
                          />
                        </div>
                      )}
                      {!isEditable && item.notes && (
                        <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                      )}
                    </div>

                    {/* Right: result indicator for simple types */}
                    {!isEditable && ['pass_fail_na', 'yes_no'].includes(item.item_type) && (
                      <div className="flex-shrink-0">
                        {item.result === 'pass' && <CheckCircle className="text-green-600" size={22} />}
                        {item.result === 'fail' && <XCircle className="text-red-600" size={22} />}
                        {item.result === 'na' && <MinusCircle className="text-gray-400" size={22} />}
                        {(!item.result || item.result === 'pending') && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
                      </div>
                    )}
                    {!isEditable && !['pass_fail_na', 'yes_no'].includes(item.item_type) && (
                      <ItemInput item={item} inspId={id!} isEditable={false} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {isEditable && (
        <div className="flex justify-end">
          <button disabled={submitInspection.isPending} className="btn-primary"
            onClick={() => {
              if (answered < total) {
                if (!confirm(`${total - answered} items not yet answered. Submit anyway?`)) return
              }
              submitInspection.mutate()
            }}>
            <Send size={16} />
            {submitInspection.isPending ? 'Submitting…' : 'Submit Inspection'}
          </button>
        </div>
      )}
    </div>
  )
}
