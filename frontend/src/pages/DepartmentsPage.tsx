import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Layers, Plus, Pencil, Trash2, Building2, X, Check } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

interface Department {
  id: number
  name: string
  description?: string
  color?: string
  clinic_count: number
}

interface Clinic {
  id: number
  name: string
  city?: string
  state?: string
  department_id?: number
}

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
]

function DeptModal({ dept, onClose }: { dept?: Department; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(dept?.name ?? '')
  const [description, setDescription] = useState(dept?.description ?? '')
  const [color, setColor] = useState(dept?.color ?? PRESET_COLORS[0])

  const save = useMutation({
    mutationFn: (data: object) => dept
      ? api.put(`/departments/${dept.id}`, data).then(r => r.data)
      : api.post('/departments', data).then(r => r.data),
    onSuccess: () => { toast.success(dept ? 'Updated' : 'Created'); qc.invalidateQueries({ queryKey: ['departments'] }); onClose() },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{dept ? 'Edit Department' : 'New Department'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2}
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: color === c ? '#1f2937' : 'transparent' }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (!name.trim()) { toast.error('Name required'); return; } save.mutate({ name, description, color }) }}
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

function AssignClinicsModal({ dept, onClose }: { dept: Department; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: allClinics = [] } = useQuery<Clinic[]>({
    queryKey: ['clinics-all'],
    queryFn: () => api.get('/clinics').then(r => r.data),
  })
  const { data: deptClinics = [] } = useQuery<Clinic[]>({
    queryKey: ['dept-clinics', dept.id],
    queryFn: () => api.get(`/departments/${dept.id}/clinics`).then(r => r.data),
  })

  const deptClinicIds = new Set(deptClinics.map((c: Clinic) => c.id))

  const assign = useMutation({
    mutationFn: (clinicId: number) => api.post(`/departments/${dept.id}/assign-clinic/${clinicId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dept-clinics', dept.id] }); qc.invalidateQueries({ queryKey: ['departments'] }) },
    onError: () => toast.error('Failed to assign'),
  })

  const unassign = useMutation({
    mutationFn: (clinicId: number) => api.post(`/departments/${dept.id}/unassign-clinic/${clinicId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dept-clinics', dept.id] }); qc.invalidateQueries({ queryKey: ['departments'] }) },
    onError: () => toast.error('Failed to unassign'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assign Locations</h2>
            <p className="text-sm text-gray-500">{dept.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {allClinics.map((c: Clinic) => {
            const assigned = deptClinicIds.has(c.id)
            return (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  {(c.city || c.state) && <p className="text-xs text-gray-400">{[c.city, c.state].filter(Boolean).join(', ')}</p>}
                </div>
                <button
                  onClick={() => assigned ? unassign.mutate(c.id) : assign.mutate(c.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    assigned ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-brand-100 hover:text-brand-700'
                  }`}
                >
                  {assigned ? <><Check size={12} /> Assigned</> : <>+ Assign</>}
                </button>
              </div>
            )
          })}
        </div>
        <button onClick={onClose} className="w-full py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Done</button>
      </div>
    </div>
  )
}

export function DepartmentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editDept, setEditDept] = useState<Department | undefined>()
  const [assignDept, setAssignDept] = useState<Department | undefined>()

  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/departments/${id}`),
    onSuccess: () => { toast.success('Archived'); qc.invalidateQueries({ queryKey: ['departments'] }) },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="text-brand-600" size={26} /> Departments
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Group locations into service lines or business units.</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditDept(undefined); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
            <Plus size={16} /> New Department
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" /></div>
      ) : departments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No departments yet</p>
          {isAdmin && <p className="text-sm mt-1">Create departments to group your locations.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color ?? '#94a3b8' }} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.name}</h3>
                    {d.description && <p className="text-sm text-gray-500 mt-0.5">{d.description}</p>}
                    <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                      <Building2 size={14} />
                      <span>{d.clinic_count} location{d.clinic_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setAssignDept(d)}
                      className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg" title="Assign locations">
                      <Building2 size={15} />
                    </button>
                    <button onClick={() => { setEditDept(d); setShowModal(true) }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Edit">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => { if (confirm('Archive this department?')) del.mutate(d.id) }}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Archive">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <DeptModal dept={editDept} onClose={() => { setShowModal(false); setEditDept(undefined) }} />}
      {assignDept && <AssignClinicsModal dept={assignDept} onClose={() => setAssignDept(undefined)} />}
    </div>
  )
}
