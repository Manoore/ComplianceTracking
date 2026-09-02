import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { ChecklistTemplate, AccreditationStandard } from '../types'
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, Copy, Library, Rocket, Pencil, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

type ItemCategory = 'safety' | 'hygiene' | 'equipment' | 'documentation' | 'staff' | 'facility' | 'regulatory' | 'other'
type ItemType = 'pass_fail_na' | 'yes_no' | 'text_input' | 'numeric' | 'numeric_range' | 'photo' | 'signature' | 'dual_signoff' | 'document_upload' | 'date_picker' | 'multiple_choice'

const ITEM_TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'pass_fail_na', label: 'Pass / Fail / N/A' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'numeric_range', label: 'Numeric Range (auto pass/fail)' },
  { value: 'numeric', label: 'Numeric Entry' },
  { value: 'text_input', label: 'Text / Notes' },
  { value: 'photo', label: 'Photo Required' },
  { value: 'signature', label: 'E-Signature' },
  { value: 'dual_signoff', label: 'Dual Sign-Off (2 signers)' },
  { value: 'document_upload', label: 'Document Upload' },
  { value: 'date_picker', label: 'Date' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
]

interface ItemDraft {
  id?: number
  question: string
  category: ItemCategory
  is_critical: boolean
  is_required: boolean
  item_type: ItemType
  type_config: { min?: string; max?: string; unit?: string; options?: string }
  standard_tags: string[]
  order_index?: number
}

function ItemTypeConfigFields({ item, onChange }: {
  item: ItemDraft
  onChange: (field: string, value: any) => void
}) {
  const setCfg = (k: string, v: string) => onChange('type_config', { ...item.type_config, [k]: v })
  if (item.item_type === 'numeric_range') {
    return (
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Min value</label>
          <input type="number" step="any" className="input text-sm py-1.5" placeholder="e.g. 35"
            value={item.type_config.min ?? ''} onChange={e => setCfg('min', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Max value</label>
          <input type="number" step="any" className="input text-sm py-1.5" placeholder="e.g. 46"
            value={item.type_config.max ?? ''} onChange={e => setCfg('max', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Unit (optional)</label>
          <input type="text" className="input text-sm py-1.5" placeholder="°F, mg/dL…"
            value={item.type_config.unit ?? ''} onChange={e => setCfg('unit', e.target.value)} />
        </div>
        <p className="col-span-3 text-xs text-blue-600">Values outside this range will auto-fail and spawn a corrective action.</p>
      </div>
    )
  }
  if (item.item_type === 'numeric') {
    return (
      <div className="mt-2 w-40">
        <label className="text-xs text-gray-500 mb-1 block">Unit label (optional)</label>
        <input type="text" className="input text-sm py-1.5" placeholder="°F, kg, ppm…"
          value={item.type_config.unit ?? ''} onChange={e => setCfg('unit', e.target.value)} />
      </div>
    )
  }
  if (item.item_type === 'multiple_choice') {
    return (
      <div className="mt-2">
        <label className="text-xs text-gray-500 mb-1 block">Options (one per line)</label>
        <textarea rows={3} className="input text-sm py-1.5 resize-none" placeholder={"Option A\nOption B\nOption C"}
          value={item.type_config.options ?? ''} onChange={e => setCfg('options', e.target.value)} />
      </div>
    )
  }
  if (item.item_type === 'dual_signoff') {
    return <p className="mt-2 text-xs text-amber-600">Two different users must independently sign this item before it's marked complete.</p>
  }
  return null
}

function buildItemPayload(item: ItemDraft) {
  const cfg: Record<string, any> = {}
  if (item.item_type === 'numeric_range') {
    if (item.type_config.min !== undefined && item.type_config.min !== '') cfg.min = parseFloat(item.type_config.min)
    if (item.type_config.max !== undefined && item.type_config.max !== '') cfg.max = parseFloat(item.type_config.max)
    if (item.type_config.unit) cfg.unit = item.type_config.unit
  } else if (item.item_type === 'numeric') {
    if (item.type_config.unit) cfg.unit = item.type_config.unit
  } else if (item.item_type === 'multiple_choice') {
    cfg.options = (item.type_config.options ?? '').split('\n').map(s => s.trim()).filter(Boolean)
  }
  return {
    question: item.question,
    category: item.category,
    is_critical: item.is_critical,
    is_required: item.is_required,
    item_type: item.item_type,
    type_config: Object.keys(cfg).length ? cfg : null,
    standard_tags: item.standard_tags ?? [],
    order_index: item.order_index ?? 0,
  }
}

function emptyItem(order_index = 0): ItemDraft {
  return { question: '', category: 'safety', is_critical: false, is_required: true, item_type: 'pass_fail_na', type_config: {}, standard_tags: [], order_index }
}

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

function StandardsTagPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { data: standards } = useQuery<AccreditationStandard[]>({
    queryKey: ['standards'],
    queryFn: () => api.get('/standards').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const toggle = (code: string) =>
    onChange(tags.includes(code) ? tags.filter(t => t !== code) : [...tags, code])
  if (!standards?.length) return null
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Tag size={12} className="text-gray-400" />
        <span className="text-xs text-gray-500">Standards tags (for compliance report)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {standards.map(s => (
          <button key={s.code} type="button"
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              tags.includes(s.code)
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
            }`}
            onClick={() => toggle(s.code)}
          >
            {s.code}
          </button>
        ))}
      </div>
    </div>
  )
}

function ItemRowEditor({ item, idx, onChange, onRemove }: {
  item: ItemDraft; idx: number
  onChange: (idx: number, field: string, value: any) => void
  onRemove: (idx: number) => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <input className="input" placeholder={`Item ${idx + 1}: describe what to check…`} value={item.question}
            onChange={e => onChange(idx, 'question', e.target.value)} />
        </div>
        <button type="button" onClick={() => onRemove(idx)} className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg flex-shrink-0">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex gap-3 items-center flex-wrap">
        <select className="input w-auto text-sm py-1.5" value={item.item_type}
          onChange={e => onChange(idx, 'item_type', e.target.value)}>
          {ITEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="input w-auto text-sm py-1.5" value={item.category}
          onChange={e => onChange(idx, 'category', e.target.value)}>
          {['safety', 'hygiene', 'equipment', 'documentation', 'staff', 'facility', 'regulatory', 'other'].map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="checkbox" checked={item.is_critical} onChange={e => onChange(idx, 'is_critical', e.target.checked)} className="accent-red-600" />
          <span className="flex items-center gap-1 text-red-600"><AlertTriangle size={13} /> Critical</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="checkbox" checked={item.is_required} onChange={e => onChange(idx, 'is_required', e.target.checked)} className="accent-brand-600" />
          Required
        </label>
      </div>
      <ItemTypeConfigFields item={item} onChange={(field, value) => onChange(idx, field, value)} />
      <StandardsTagPicker tags={item.standard_tags} onChange={t => onChange(idx, 'standard_tags', t)} />
    </div>
  )
}

function NewTemplateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([emptyItem(0)])

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/checklists', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklists'] }); toast.success('Template created'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const addItem = () => setItems(i => [...i, emptyItem(i.length)])
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx))
  const updateItem = (idx: number, field: string, value: any) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">New Checklist Template</h2>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="label">Template Name *</label>
            <input required className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Daily Refrigerator Temperature Log" />
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
                <ItemRowEditor key={idx} item={item} idx={idx} onChange={updateItem} onRemove={removeItem} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-primary" disabled={!name || mutation.isPending}
              onClick={() => mutation.mutate({ name, description, items: items.filter(i => i.question).map(buildItemPayload) })}>
              {mutation.isPending ? 'Creating…' : 'Create Template'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditTemplateModal({ template, onClose }: { template: ChecklistTemplate; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [items, setItems] = useState<ItemDraft[]>(
    template.items.map(i => ({
      id: i.id,
      question: i.question,
      category: (i.category as ItemCategory) || 'other',
      is_critical: i.is_critical,
      is_required: i.is_required,
      item_type: ((i as any).item_type as ItemType) || 'pass_fail_na',
      type_config: {
        min: (i as any).type_config?.min?.toString(),
        max: (i as any).type_config?.max?.toString(),
        unit: (i as any).type_config?.unit,
        options: ((i as any).type_config?.options as string[] | undefined)?.join('\n'),
      },
      standard_tags: (i as any).standard_tags ?? [],
    }))
  )

  const mutation = useMutation({
    mutationFn: (data: any) => api.put(`/checklists/${template.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklists'] }); toast.success('Template updated'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const addItem = () => setItems(i => [...i, emptyItem(i.length)])
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx))
  const updateItem = (idx: number, field: string, value: any) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Edit Template</h2>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="label">Template Name *</label>
            <input required className="input" value={name} onChange={e => setName(e.target.value)} />
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
                <ItemRowEditor key={idx} item={item} idx={idx} onChange={updateItem} onRemove={removeItem} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-primary" disabled={!name || mutation.isPending}
              onClick={() => mutation.mutate({ name, description, items: items.filter(i => i.question).map(buildItemPayload) })}>
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
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
  const [editTemplate, setEditTemplate] = useState<ChecklistTemplate | null>(null)
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
                  title="Edit template"
                  onClick={() => setEditTemplate(t)}
                >
                  <Pencil size={16} />
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
      {editTemplate && <EditTemplateModal template={editTemplate} onClose={() => setEditTemplate(null)} />}
    </div>
  )
}
