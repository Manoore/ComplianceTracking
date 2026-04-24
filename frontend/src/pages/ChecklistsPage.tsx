import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { ChecklistTemplate } from '../types'
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, Copy, Library, Rocket } from 'lucide-react'
import toast from 'react-hot-toast'

type ItemCategory = 'safety' | 'hygiene' | 'equipment' | 'documentation' | 'staff' | 'facility' | 'regulatory' | 'other'

const PRESET_LABELS: Record<string, string> = {
  osha: 'OSHA Workplace Safety',
  hipaa: 'HIPAA Compliance',
  infection_control: 'Infection Control',
  medication_safety: 'Medication Safety',
  fire_safety: 'Fire Safety',
  equipment_maintenance: 'Equipment Maintenance',
  patient_safety: 'Patient Safety',
}

const PRESET_COLORS: Record<string, string> = {
  osha: 'bg-orange-50 border-orange-200 text-orange-700',
  hipaa: 'bg-blue-50 border-blue-200 text-blue-700',
  infection_control: 'bg-green-50 border-green-200 text-green-700',
  medication_safety: 'bg-purple-50 border-purple-200 text-purple-700',
  fire_safety: 'bg-red-50 border-red-200 text-red-700',
  equipment_maintenance: 'bg-gray-50 border-gray-200 text-gray-700',
  patient_safety: 'bg-teal-50 border-teal-200 text-teal-700',
}

function PresetLibraryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: presets } = useQuery({
    queryKey: ['checklists-presets'],
    queryFn: () => api.get('/checklists/presets').then(r => r.data),
  })

  const deploy = useMutation({
    mutationFn: (category: string) => api.post(`/checklists/presets/${category}/deploy`),
    onSuccess: (_, category) => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      toast.success(`${PRESET_LABELS[category] ?? category} template deployed`)
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library size={18} className="text-brand-600" />
            <h2 className="text-lg font-semibold">Preset Template Library</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-gray-500 mb-4">Deploy a pre-built compliance checklist template based on industry standards. Each deployment creates an editable copy.</p>
          {Object.entries(PRESET_LABELS).map(([key, label]) => {
            const preset = (presets ?? {})[key]
            return (
              <div key={key} className={`border rounded-lg p-4 flex items-center justify-between gap-4 ${PRESET_COLORS[key] ?? ''}`}>
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  {preset?.description && (
                    <p className="text-xs mt-0.5 opacity-75">{preset.description}</p>
                  )}
                  {preset && (
                    <p className="text-xs mt-1 opacity-60">{preset.item_count ?? '?'} items</p>
                  )}
                </div>
                <button
                  className="btn-primary py-1.5 text-xs flex-shrink-0"
                  onClick={() => deploy.mutate(key)}
                  disabled={deploy.isPending}
                >
                  <Rocket size={13} /> Deploy
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NewTemplateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState([{ question: '', category: 'safety' as ItemCategory, is_critical: false, is_required: true, order_index: 0 }])

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/checklists', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklists'] }); toast.success('Template created'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const addItem = () => setItems(i => [...i, { question: '', category: 'other', is_critical: false, is_required: true, order_index: i.length }])
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx))
  const updateItem = (idx: number, field: string, value: any) => setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">New Checklist Template</h2>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="label">Template Name *</label>
            <input required className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Monthly Safety Inspection" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} className="input" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Checklist Items ({items.length})</label>
              <button type="button" className="btn-secondary py-1.5 text-xs" onClick={addItem}>
                <Plus size={13} /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input className="input" placeholder={`Item ${idx + 1} question…`} value={item.question}
                        onChange={e => updateItem(idx, 'question', e.target.value)} />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex gap-3 items-center flex-wrap">
                    <select className="input w-auto text-sm py-1.5" value={item.category}
                      onChange={e => updateItem(idx, 'category', e.target.value)}>
                      {['safety', 'hygiene', 'equipment', 'documentation', 'staff', 'facility', 'regulatory', 'other'].map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={item.is_critical} onChange={e => updateItem(idx, 'is_critical', e.target.checked)} className="accent-red-600" />
                      <span className="flex items-center gap-1 text-red-600"><AlertTriangle size={13} /> Critical</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={item.is_required} onChange={e => updateItem(idx, 'is_required', e.target.checked)} className="accent-brand-600" />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              className="btn-primary"
              disabled={!name || mutation.isPending}
              onClick={() => mutation.mutate({ name, description, items: items.filter(i => i.question) })}
            >
              {mutation.isPending ? 'Creating…' : 'Create Template'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChecklistsPage() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const { data: templates, isLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ['checklists'],
    queryFn: () => api.get('/checklists').then(r => r.data),
  })

  const cloneTemplate = useMutation({
    mutationFn: (id: number) => api.post(`/checklists/${id}/clone`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklists'] }); toast.success('Template cloned') },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Checklist Templates</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowPresets(true)}>
            <Library size={15} /> Preset Library
          </button>
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {(templates ?? []).map(t => (
            <div key={t.id} className="card p-0 overflow-hidden">
              <div className="flex items-center">
                <button
                  className="flex-1 flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{t.name}</p>
                      {(t as any).is_preset && (
                        <span className="badge bg-brand-100 text-brand-700 text-xs">Preset</span>
                      )}
                    </div>
                    {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{t.items.length} items · {t.items.filter(i => i.is_critical).length} critical</p>
                  </div>
                  {expanded === t.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>
                <button
                  className="p-4 text-gray-400 hover:text-brand-600 hover:bg-gray-50 transition-colors"
                  title="Clone template"
                  onClick={() => cloneTemplate.mutate(t.id)}
                  disabled={cloneTemplate.isPending}
                >
                  <Copy size={16} />
                </button>
              </div>

              {expanded === t.id && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-5 text-gray-500 font-medium">#</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium">Question</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium">Category</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.items.map((item, i) => (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="py-2.5 px-5 text-gray-400">{i + 1}</td>
                          <td className="py-2.5 px-4 text-gray-900">{item.question}</td>
                          <td className="py-2.5 px-4 capitalize text-gray-500">{item.category}</td>
                          <td className="py-2.5 px-4">
                            <div className="flex gap-2">
                              {item.is_critical && <span className="badge bg-red-100 text-red-700">Critical</span>}
                              {item.is_required && <span className="badge bg-gray-100 text-gray-600">Required</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {(templates?.length ?? 0) === 0 && (
            <p className="text-center py-16 text-gray-400">No templates yet. Create your first checklist or deploy a preset.</p>
          )}
        </div>
      )}

      {showNew && <NewTemplateModal onClose={() => setShowNew(false)} />}
      {showPresets && <PresetLibraryModal onClose={() => setShowPresets(false)} />}
    </div>
  )
}
