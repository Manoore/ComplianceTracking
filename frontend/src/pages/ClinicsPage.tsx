import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import type { Clinic } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Building2, ExternalLink, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

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

function ClinicForm({ clinic, onClose }: { clinic?: Clinic; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: clinic?.name ?? '',
    clinic_type: (clinic as any)?.clinic_type ?? '',
    address: clinic?.address ?? '',
    city: clinic?.city ?? '',
    state: clinic?.state ?? '',
    zip_code: clinic?.zip_code ?? '',
    phone: clinic?.phone ?? '',
    email: clinic?.email ?? '',
    website: (clinic as any)?.website ?? '',
    license_number: (clinic as any)?.license_number ?? '',
    notes: clinic?.notes ?? '',
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const [manager_id, setManagerId] = useState<string>(clinic?.manager_id?.toString() ?? '')

  const mutation = useMutation({
    mutationFn: (data: any) => clinic
      ? api.put(`/clinics/${clinic.id}`, data)
      : api.post('/clinics', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinics'] })
      toast.success(clinic ? 'Clinic updated' : 'Clinic created')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ ...form, manager_id: manager_id ? parseInt(manager_id) : null })
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
            <label className="label">Clinic Type</label>
            <select className="input" value={form.clinic_type} onChange={e => setForm(f => ({ ...f, clinic_type: e.target.value }))}>
              <option value="">— Select type —</option>
              {CLINIC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
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
      toast.error(err.response?.data?.detail || 'Import failed')
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

export function ClinicsPage() {
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Clinic | undefined>()
  const { data: clinics, isLoading } = useQuery<Clinic[]>({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clinics</h1>
        <div className="flex gap-2">
          {user?.role === 'admin' && <CsvImportButton />}
          {user?.role === 'admin' && (
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {(clinics ?? []).map((clinic) => (
            <div key={clinic.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-50 rounded-lg">
                    <Building2 className="text-brand-600" size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{clinic.name}</p>
                    {(clinic as any).clinic_type && (
                      <p className="text-xs text-gray-400 capitalize">{(clinic as any).clinic_type.replace('_', ' ')}</p>
                    )}
                    {!clinic.is_active && (
                      <span className="text-xs text-red-500">Inactive</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {user?.role === 'admin' && (
                    <button
                      className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
                      onClick={() => { setEditing(clinic); setShowForm(true) }}
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                {clinic.address && <p>{clinic.address}</p>}
                {(clinic.city || clinic.state) && <p>{[clinic.city, clinic.state, clinic.zip_code].filter(Boolean).join(', ')}</p>}
                {clinic.phone && <p>{clinic.phone}</p>}
                {clinic.manager_name && (
                  <p className="text-brand-600 font-medium">Manager: {clinic.manager_name}</p>
                )}
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
          ))}
          {(clinics?.length ?? 0) === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              No clinics registered yet
            </div>
          )}
        </div>
      )}

      {showForm && (
        <ClinicForm clinic={editing} onClose={() => { setShowForm(false); setEditing(undefined) }} />
      )}
    </div>
  )
}
