import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { Clinic, Department } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, Building2, ExternalLink, Upload, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { useConfirm } from '../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

const SERVICE_OPTIONS = ['Urgent Care', 'Primary Care', 'Clinical Research', 'Wellness']

const UNASSIGNED = 'Unassigned'

const SERVICE_STYLES: Record<string, string> = {
  'Urgent Care': 'bg-red-50 text-red-700 border-red-200',
  'Primary Care': 'bg-teal-50 text-teal-600 border-teal-200',
  'Clinical Research': 'bg-brand-50 text-brand-700 border-brand-200',
  'Wellness': 'bg-amber-50 text-amber-700 border-amber-200',
}

const CLINIC_TYPES = [
  { value: 'general_practice', label: 'General Practice' },
  { value: 'dental', label: 'Dental' },
  { value: 'lab', label: 'Lab' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'urgent_care', label: 'Urgent Care' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'physical_therapy', label: 'Physical Therapy' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'other', label: 'Other' },
]

function ClinicForm({ clinic, regions, onClose }: { clinic?: Clinic; regions: string[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: clinic?.name ?? '',
    clinic_type: clinic?.clinic_type ?? '',
    address: clinic?.address ?? '',
    city: clinic?.city ?? '',
    state: clinic?.state ?? '',
    zip_code: clinic?.zip_code ?? '',
    region: clinic?.region ?? '',
    phone: clinic?.phone ?? '',
    email: clinic?.email ?? '',
    website: clinic?.website ?? '',
    license_number: clinic?.license_number ?? '',
    notes: clinic?.notes ?? '',
  })
  const [services, setServices] = useState<string[]>(clinic?.services ?? [])
  const toggleService = (s: string) =>
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const { data: departments } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: () => api.get('/departments').then(r => r.data) })
  const [manager_id, setManagerId] = useState<string>(clinic?.manager_id?.toString() ?? '')
  const [department_id, setDepartmentId] = useState<string>((clinic as any)?.department_id?.toString() ?? '')

  const mutation = useMutation({
    mutationFn: (data: any) => clinic
      ? api.put(`/clinics/${clinic.id}`, data)
      : api.post('/clinics', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinics'] })
      toast.success(clinic ? 'Clinic updated' : 'Clinic created')
      onClose()
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ ...form, services, manager_id: manager_id ? parseInt(manager_id) : null, department_id: department_id ? parseInt(department_id) : null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{clinic ? 'Edit Clinic' : 'Add Clinic'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Clinic Name *</label>
            <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Region</label>
            <input
              className="input"
              list="clinic-regions"
              placeholder="e.g. Cleveland — pick one or type a new region"
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
            />
            <datalist id="clinic-regions">
              {regions.map(r => <option key={r} value={r} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Clinic Type</label>
            <select className="input" value={form.clinic_type} onChange={e => setForm(f => ({ ...f, clinic_type: e.target.value }))}>
              <option value="">— Select type —</option>
              {CLINIC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Services</label>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...SERVICE_OPTIONS, ...services])].map(s => {
                const on = services.includes(s)
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggleService(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      on ? (SERVICE_STYLES[s] ?? 'bg-brand-50 text-brand-700 border-brand-200')
                         : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            </div>
            <div>
              <label className="label">ZIP Code</label>
              <input className="input" value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Website</label>
            <input type="url" className="input" placeholder="https://…" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </div>
          <div>
            <label className="label">License Number</label>
            <input className="input" value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} />
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={department_id} onChange={e => setDepartmentId(e.target.value)}>
              <option value="">— None —</option>
              {(departments ?? []).map((d: Department) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assigned Manager</label>
            <select className="input" value={manager_id} onChange={e => setManagerId(e.target.value)}>
              <option value="">— None —</option>
              {(users || []).filter((u: any) => u.role === 'manager' || u.role === 'admin').map((u: any) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={3} className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CsvImportButton() {
  const qc = useQueryClient()
  const ref = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/clinics/import/csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['clinics'] })
      toast.success(`Imported ${res.data.created} clinic(s)`)
    } catch (err: any) {
      toast.error(apiError(err, 'Import failed'))
    }
    e.target.value = ''
  }

  return (
    <label className="btn-secondary cursor-pointer">
      <Upload size={15} /> Import CSV
      <input ref={ref} type="file" accept=".csv" className="hidden" onChange={handleFile} />
    </label>
  )
}

function ClinicCard({ clinic, canEdit, onEdit, onDelete }: {
  clinic: Clinic; canEdit: boolean; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-50 rounded-lg">
            <Building2 className="text-brand-600" size={20} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{clinic.name}</p>
            {clinic.clinic_type && (
              <p className="text-xs text-gray-400 capitalize">{clinic.clinic_type.replace(/_/g, ' ')}</p>
            )}
            {!clinic.is_active && <span className="text-xs text-red-500">Inactive</span>}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-0.5">
            <button className="p-1.5 text-gray-400 hover:text-brand-600 rounded" onClick={onEdit}>
              <Edit2 size={15} />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-red-600 rounded" onClick={onDelete}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {(clinic.services ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(clinic.services ?? []).map(s => (
            <span
              key={s}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                SERVICE_STYLES[s] ?? 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="text-sm text-gray-500 space-y-1">
        {clinic.address && <p>{clinic.address}</p>}
        {(clinic.city || clinic.state) && (
          <p>{[[clinic.city, clinic.state].filter(Boolean).join(', '), clinic.zip_code].filter(Boolean).join(' ')}</p>
        )}
        {clinic.phone && <p>{clinic.phone}</p>}
        {clinic.department_name && (
          <p className="flex items-center gap-1 text-gray-500">
            <Layers size={11} /> {clinic.department_name}
          </p>
        )}
        {clinic.manager_name && <p className="text-brand-600 font-medium">Manager: {clinic.manager_name}</p>}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <Link
          to={`/clinics/${clinic.id}/profile`}
          className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium"
        >
          <ExternalLink size={12} /> View Profile
        </Link>
      </div>
    </div>
  )
}

export function ClinicsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const confirmDialog = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Clinic | undefined>()
  const [filterDept, setFilterDept] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const { data: clinics, isLoading } = useQuery<Clinic[]>({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then(r => r.data),
  })
  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const deleteClinic = useMutation({
    mutationFn: (id: number) => api.delete(`/clinics/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinics'] })
      toast.success('Clinic deleted')
    },
    onError: (e: any) => toast.error(apiError(e, 'Could not delete clinic')),
  })

  const handleDelete = async (clinic: Clinic) => {
    if (await confirmDialog(`Permanently delete ${clinic.name}? This cannot be undone.`)) {
      deleteClinic.mutate(clinic.id)
    }
  }

  const all = clinics ?? []
  const isAdmin = user?.role === 'admin'

  // Named regions first (alphabetical), "Unassigned" always last.
  const sortRegions = (a: string, b: string) =>
    a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)

  const regions = useMemo(
    () => [...new Set(all.map(c => c.region || UNASSIGNED))].sort(sortRegions),
    [all],
  )
  const namedRegions = useMemo(() => regions.filter(r => r !== UNASSIGNED), [regions])

  const visible = useMemo(() => all.filter(c =>
    (!filterDept || c.department_id?.toString() === filterDept) &&
    (!filterRegion || (c.region || UNASSIGNED) === filterRegion)
  ), [all, filterDept, filterRegion])

  const grouped = useMemo(() => {
    const m = new Map<string, Clinic[]>()
    for (const c of visible) {
      const r = c.region || UNASSIGNED
      if (!m.has(r)) m.set(r, [])
      m.get(r)!.push(c)
    }
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return [...m.entries()].sort(([a], [b]) => sortRegions(a, b))
  }, [visible])

  const toggleRegion = (r: string) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(r)) next.delete(r); else next.add(r)
    return next
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinics</h1>
          <p className="text-sm text-gray-500">
            {visible.length} of {all.length} across {namedRegions.length} region{namedRegions.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {regions.length > 1 && (
            <select className="input w-auto text-sm py-1.5" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
              <option value="">All Regions</option>
              {regions.map(r => (
                <option key={r} value={r}>
                  {r} ({all.filter(c => (c.region || UNASSIGNED) === r).length})
                </option>
              ))}
            </select>
          )}
          {(departments ?? []).length > 0 && (
            <select className="input w-auto text-sm py-1.5" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {(departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {isAdmin && <CsvImportButton />}
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setEditing(undefined); setShowForm(true) }}>
              <Plus size={16} /> Add Clinic
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {filterDept || filterRegion ? 'No clinics match these filters' : 'No clinics registered yet'}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([region, list]) => {
            const isCollapsed = collapsed.has(region)
            return (
              <section key={region}>
                <button
                  onClick={() => toggleRegion(region)}
                  className="flex items-center gap-2 mb-3 group"
                >
                  {isCollapsed
                    ? <ChevronRight size={20} className="text-brand-600" />
                    : <ChevronDown size={20} className="text-brand-600" />}
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                    {region}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                    {list.length} {list.length === 1 ? 'clinic' : 'clinics'}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {list.map(clinic => (
                      <ClinicCard
                        key={clinic.id}
                        clinic={clinic}
                        canEdit={!!isAdmin}
                        onEdit={() => { setEditing(clinic); setShowForm(true) }}
                        onDelete={() => handleDelete(clinic)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {showForm && (
        <ClinicForm
          clinic={editing}
          regions={namedRegions}
          onClose={() => { setShowForm(false); setEditing(undefined) }}
        />
      )}
    </div>
  )
}
