import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { ScoreRing } from '../components/ui/ScoreRing'
import { statusBadge } from '../components/ui/Badge'
import { ArrowLeft, MapPin, Phone, Mail, Globe, Clock } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

export function ClinicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['clinic-profile', id],
    queryFn: () => api.get(`/clinics/${id}/profile`).then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )
  if (!profile) return <p className="text-center py-12 text-gray-500">Clinic not found</p>

  const { stats, score_history, recent_inspections, staff } = profile

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
          <p className="text-sm text-gray-500 capitalize">{profile.clinic_type?.replace('_', ' ')}</p>
        </div>
        {stats.avg_compliance_score > 0 && (
          <ScoreRing score={stats.avg_compliance_score} size={72} />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Avg Score', value: stats.avg_compliance_score ? `${stats.avg_compliance_score}%` : '—' },
          { label: 'Last Score', value: stats.last_inspection_score ? `${stats.last_inspection_score.toFixed(1)}%` : '—' },
          { label: 'Open Actions', value: stats.open_corrective_actions },
          { label: 'Total Inspections', value: stats.total_inspections },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Clinic Details</h2>
          {(profile.address || profile.city) && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={15} className="mt-0.5 text-gray-400 flex-shrink-0" />
              <span>{[profile.address, profile.city, profile.state, profile.zip_code].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone size={15} className="text-gray-400" />
              <span>{profile.phone}</span>
            </div>
          )}
          {profile.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail size={15} className="text-gray-400" />
              <a href={`mailto:${profile.email}`} className="text-brand-600 hover:underline">{profile.email}</a>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Globe size={15} className="text-gray-400" />
              <a href={profile.website} target="_blank" rel="noopener" className="text-brand-600 hover:underline truncate">{profile.website}</a>
            </div>
          )}
          {profile.license_number && (
            <p className="text-xs text-gray-400">License: {profile.license_number}</p>
          )}
          {profile.manager_name && (
            <p className="text-sm text-gray-600 pt-2 border-t border-gray-100">
              <span className="text-gray-400">Manager:</span> {profile.manager_name}
            </p>
          )}
          {profile.operating_hours && Object.keys(profile.operating_hours).length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <Clock size={13} /> Operating Hours
              </div>
              {DAYS.filter(d => profile.operating_hours[d]).map(d => (
                <div key={d} className="flex justify-between text-xs text-gray-600 py-0.5">
                  <span className="text-gray-400">{DAY_LABELS[d]}</span>
                  <span>{profile.operating_hours[d]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score history chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Compliance Score History</h2>
          {score_history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No inspection data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={score_history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent inspections */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Inspections</h2>
            <Link to={`/inspections?clinic_id=${id}`} className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {recent_inspections.map((i: any) => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/inspections/${i.id}`)}>
                  <td className="py-3 px-5">
                    <p className="text-xs text-gray-400">{i.inspector_name}</p>
                    <p className="text-xs text-gray-400">{i.submitted_at ? new Date(i.submitted_at).toLocaleDateString() : '—'}</p>
                  </td>
                  <td className="py-3 px-4">
                    {i.score != null ? <ScoreRing score={i.score} size={38} strokeWidth={4} /> : '—'}
                  </td>
                  <td className="py-3 px-4">{i.risk_level ? statusBadge(i.risk_level) : '—'}</td>
                  <td className="py-3 px-4">{statusBadge(i.status)}</td>
                </tr>
              ))}
              {recent_inspections.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No inspections yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Staff */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Assigned Staff ({staff.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {staff.map((s: any) => (
              <div key={s.user_id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-sm flex-shrink-0">
                  {s.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
                  {s.role_note && <p className="text-xs text-gray-400">{s.role_note}</p>}
                </div>
              </div>
            ))}
            {staff.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No staff assigned</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
