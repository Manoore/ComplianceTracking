import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api, { apiError } from '../services/api'
import type { Inspection, Clinic, ChecklistTemplate, Department } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge } from '../components/ui/Badge'
import { ScoreRing } from '../components/ui/ScoreRing'
import { Plus, ChevronRight, MapPin, Trash2, X } from 'lucide-react'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { hasOversight } from '../utils/hierarchy'
import toast from 'react-hot-toast'

function NewInspectionModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: clinics } = useQuery<Clinic[]>({ queryKey: ['clinics'], queryFn: () => api.get('/clinics').then(r => r.data) })
  const { data: templates } = useQuery<ChecklistTemplate[]>({ queryKey: ['checklists'], queryFn: () => api.get('/checklists').then(r => r.data) })
  const [clinicId, setClinicId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)

  const selectedClinic = (clinics ?? []).find(c => c.id.toString() === clinicId)
  // A clinic's own department's templates, plus department-less templates that apply everywhere.
  // A clinic with no department assigned sees every template.
  const availableTemplates = (templates ?? []).filter(t =>
    !selectedClinic?.department_id || !t.department_id || t.department_id === selectedClinic.department_id
  )

  const [gpsLoading, setGpsLoading] = useState(false)

  const captureGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Your browser does not support GPS. Try Chrome, Edge, Safari, or Firefox.')
      return
    }
    if (!window.isSecureContext) {
      toast.error('GPS needs a secure connection. Use localhost or HTTPS.', { duration: 6000 })
      return
    }
    setGpsLoading(true)
    const t = toast.loading('Requesting location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsLoading(false)
        toast.success(`GPS captured (±${Math.round(pos.coords.accuracy)}m)`, { id: t })
      },
      (err) => {
        setGpsLoading(false)
        toast.dismiss(t)
        if (err.code === 1) {
          toast.error('Location permission denied. Click the location icon in your browser\'s address bar and allow access, then try again.', { duration: 7000 })
        } else if (err.code === 2) {
          toast.error('Location unavailable. Check that location services are enabled in your OS settings.', { duration: 6000 })
        } else if (err.code === 3) {
          toast.error('Location request timed out. Make sure you have signal and try again.')
        } else {
          toast.error('Could not get GPS: ' + (err.message || 'unknown error'))
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inspections', data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['inspections'] })
      navigate(`/inspections/${r.data.id}`)
      onClose()
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Start New Inspection</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Clinic *</label>
            <select required className="input" value={clinicId}
              onChange={e => { setClinicId(e.target.value); setTemplateId('') }}>
              <option value="">Select clinic…</option>
              {(clinics ?? []).filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Checklist Template *</label>
            <select required className="input" value={templateId} onChange={e => setTemplateId(e.target.value)}
              disabled={!clinicId}>
              <option value="">{clinicId ? 'Select template…' : 'Select a clinic first…'}</option>
              {availableTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {clinicId && availableTemplates.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                No templates available for this clinic's department yet.
              </p>
            )}
          </div>
          <button type="button" className="btn-secondary w-full justify-center" onClick={captureGPS} disabled={gpsLoading}>
            <MapPin size={15} />
            {gpsLoading
              ? 'Getting location…'
              : gps
                ? `GPS: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
                : 'Capture GPS Location'}
          </button>
          <p className="text-xs text-gray-400 text-center -mt-2">
            Optional — your browser will ask to share location
          </p>
          <div className="flex gap-3 pt-2">
            <button
              disabled={!clinicId || !templateId || mutation.isPending}
              className="btn-primary"
              onClick={() => mutation.mutate({
                clinic_id: parseInt(clinicId),
                template_id: parseInt(templateId),
                checkin_lat: gps?.lat,
                checkin_lng: gps?.lng,
              })}
            >
              {mutation.isPending ? 'Starting…' : 'Start Inspection'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InspectionsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const confirmDialog = useConfirm()
  const [showNew, setShowNew] = useState(false)
  const [filterDept, setFilterDept] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [filterFrequency, setFilterFrequency] = useState('')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterClinicId = searchParams.get('clinic_id') ?? ''
  const isInspector = !hasOversight(user)

  const { data: inspections, isLoading } = useQuery<Inspection[]>({
    queryKey: ['inspections'],
    queryFn: () => api.get('/inspections').then(r => r.data),
  })
  const { data: clinics } = useQuery<Clinic[]>({ queryKey: ['clinics'], queryFn: () => api.get('/clinics').then(r => r.data), enabled: !isInspector })
  const { data: departments } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: () => api.get('/departments').then(r => r.data), enabled: !isInspector })

  const filterClinic = filterClinicId ? (clinics ?? []).find(c => c.id.toString() === filterClinicId) : null

  const clinicsByDept = filterDept
    ? new Set((clinics ?? []).filter((c: any) => c.department_id?.toString() === filterDept).map(c => c.id))
    : null

  // Only offer users who've actually submitted something, in the order they appear —
  // no point listing every staff member in a dropdown meant to narrow down a report.
  const submittingUsers = Array.from(
    new Map((inspections ?? []).map(i => [i.inspector_id, i.inspector_name])).entries()
  ).sort((a, b) => (a[1] ?? '').localeCompare(b[1] ?? ''))

  const visible = isInspector
    ? (inspections ?? []).filter(i => i.inspector_id === user?.id)
    : (inspections ?? [])
      .filter(i => !clinicsByDept || clinicsByDept.has(i.clinic_id))
      .filter(i => !filterClinicId || i.clinic_id.toString() === filterClinicId)
      .filter(i => !filterUser || i.inspector_id.toString() === filterUser)
      .filter(i => !filterFrequency || (filterFrequency === 'adhoc' ? !i.template_frequency : i.template_frequency === filterFrequency))

  const pending = visible.filter(i => i.status === 'in_progress' || i.status === 'draft')
  const completed = visible.filter(i => i.status === 'submitted' || i.status === 'reviewed')

  const deleteInspection = useMutation({
    mutationFn: (id: number) => api.delete(`/inspections/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspections'] }); toast.success('Inspection deleted') },
    onError: (e: any) => toast.error(apiError(e, 'Could not delete inspection')),
  })

  const handleDelete = async (e: React.MouseEvent, insp: Inspection) => {
    e.stopPropagation()
    if (await confirmDialog(`Delete this inspection at ${insp.clinic_name}? This cannot be undone.`)) {
      deleteInspection.mutate(insp.id)
    }
  }

  if (isInspector) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Checklists</h1>
            <p className="text-sm text-gray-500 mt-0.5">Select a clinic and complete your checklist</p>
          </div>
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> Start New Inspection
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pending / In Progress</h2>
                <div className="space-y-3">
                  {pending.map(insp => (
                    <div key={insp.id}
                      className="card flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/inspections/${insp.id}`)}>
                      <div>
                        <p className="font-semibold text-gray-900">{insp.clinic_name}</p>
                        <p className="text-sm text-gray-500">{new Date(insp.created_at!).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {statusBadge(insp.status)}
                        <button
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Delete inspection"
                          onClick={(e) => handleDelete(e, insp)}
                        >
                          <Trash2 size={16} />
                        </button>
                        <ChevronRight size={18} className="text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pending.length === 0 && (
              <div className="card text-center py-10">
                <p className="text-gray-400 font-medium">No pending inspections</p>
                <p className="text-sm text-gray-400 mt-1">Click "Start New Inspection" to begin</p>
              </div>
            )}

            {completed.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed</h2>
                <div className="card p-0 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Clinic</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Score</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {completed.map(insp => (
                        <tr key={insp.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/inspections/${insp.id}`)}>
                          <td className="py-3 px-4 font-medium">{insp.clinic_name}</td>
                          <td className="py-3 px-4">
                            {insp.compliance_score != null
                              ? <ScoreRing score={insp.compliance_score} size={40} strokeWidth={4} />
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-4 text-gray-500">
                            {insp.submitted_at ? new Date(insp.submitted_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4 text-gray-400"><ChevronRight size={16} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {showNew && <NewInspectionModal onClose={() => setShowNew(false)} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Checklists</h1>
        <div className="flex gap-2 items-center">
          {filterClinic && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 px-2.5 py-1.5 rounded-lg">
              {filterClinic.name}
              <button onClick={() => setSearchParams(p => { p.delete('clinic_id'); return p })} className="hover:text-brand-900">
                <X size={13} />
              </button>
            </span>
          )}
          {(departments ?? []).length > 0 && (
            <select className="input w-auto text-sm py-1.5" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {(departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {submittingUsers.length > 0 && (
            <select className="input w-auto text-sm py-1.5" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">All Users</option>
              {submittingUsers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          <select className="input w-auto text-sm py-1.5" value={filterFrequency} onChange={e => setFilterFrequency(e.target.value)}>
            <option value="">All Frequencies</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="adhoc">Ad-hoc</option>
          </select>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button className="btn-primary" onClick={() => setShowNew(true)}>
              <Plus size={16} /> New Inspection
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Clinic</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Template</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Inspector</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Score</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Risk</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((insp) => (
                <tr key={insp.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/inspections/${insp.id}`)}>
                  <td className="py-3 px-4 font-medium">{insp.clinic_name}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {insp.template_name}
                    {insp.template_frequency && (
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">{insp.template_frequency}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{insp.inspector_name}</td>
                  <td className="py-3 px-4">
                    {insp.compliance_score != null
                      ? <ScoreRing score={insp.compliance_score} size={40} strokeWidth={4} />
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-3 px-4">{insp.risk_level ? statusBadge(insp.risk_level) : '—'}</td>
                  <td className="py-3 px-4">{statusBadge(insp.status)}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {insp.submitted_at
                      ? new Date(insp.submitted_at).toLocaleDateString()
                      : new Date(insp.created_at!).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-gray-400" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {(insp.status === 'in_progress' || insp.status === 'draft') && (
                        <button className="hover:text-red-600" title="Delete inspection"
                          onClick={(e) => handleDelete(e, insp)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                      <ChevronRight size={16} />
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No inspections yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewInspectionModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
