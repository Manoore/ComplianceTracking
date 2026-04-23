import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import type { Inspection, Clinic, ChecklistTemplate } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge } from '../components/ui/Badge'
import { ScoreRing } from '../components/ui/ScoreRing'
import { Plus, ChevronRight, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

function NewInspectionModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: clinics } = useQuery<Clinic[]>({ queryKey: ['clinics'], queryFn: () => api.get('/clinics').then(r => r.data) })
  const { data: templates } = useQuery<ChecklistTemplate[]>({ queryKey: ['checklists'], queryFn: () => api.get('/checklists').then(r => r.data) })
  const [clinicId, setClinicId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)

  const captureGPS = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); toast.success('GPS captured') },
      () => toast.error('Could not get GPS location'),
    )
  }

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/inspections', data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['inspections'] })
      navigate(`/inspections/${r.data.id}`)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Error'),
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
            <select required className="input" value={clinicId} onChange={e => setClinicId(e.target.value)}>
              <option value="">Select clinic…</option>
              {(clinics ?? []).filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Checklist Template *</label>
            <select required className="input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
              <option value="">Select template…</option>
              {(templates ?? []).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-secondary w-full justify-center" onClick={captureGPS}>
            <MapPin size={15} />
            {gps ? `GPS: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Capture GPS Location'}
          </button>
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
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()
  const { data: inspections, isLoading } = useQuery<Inspection[]>({
    queryKey: ['inspections'],
    queryFn: () => api.get('/inspections').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> New Inspection
          </button>
        )}
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
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Inspector</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Score</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Risk</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(inspections ?? []).map((insp) => (
                <tr key={insp.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/inspections/${insp.id}`)}>
                  <td className="py-3 px-4 font-medium">{insp.clinic_name}</td>
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
                  <td className="py-3 px-4 text-gray-400"><ChevronRight size={16} /></td>
                </tr>
              ))}
              {(inspections?.length ?? 0) === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No inspections yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewInspectionModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
