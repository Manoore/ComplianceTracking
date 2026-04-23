import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import type { DashboardData } from '../types'
import { ScoreRing } from '../components/ui/ScoreRing'
import { statusBadge } from '../components/ui/Badge'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import { ClipboardList, AlertTriangle, CheckSquare, Building2 } from 'lucide-react'

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: number | string; sub?: string; icon: any; color: string
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const RISK_COLORS: Record<string, string> = {
  low: '#16a34a', medium: '#d97706', high: '#ea580c', critical: '#dc2626'
}

export function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
  )

  const s = data?.summary
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Inspections" value={s?.total_inspections ?? 0}
          sub={`${s?.pending_review ?? 0} pending review`}
          icon={ClipboardList} color="bg-brand-600" />
        <StatCard title="Avg Compliance Score" value={`${s?.avg_compliance_score ?? 0}%`}
          sub="across all inspections"
          icon={Building2} color="bg-green-600" />
        <StatCard title="Open Corrective Actions" value={s?.open_corrective_actions ?? 0}
          sub={`${s?.overdue_corrective_actions ?? 0} overdue`}
          icon={AlertTriangle} color="bg-orange-500" />
        <StatCard title="Certifications" value={s?.completed_certifications ?? 0}
          sub={`of ${s?.total_certifications ?? 0} total`}
          icon={CheckSquare} color="bg-purple-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Compliance Trend */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Compliance Trend (6 Months)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Avg Score']} />
              <Line type="monotone" dataKey="avg_score" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Clinic Scores */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Clinic Compliance Scores</h2>
          {(data?.clinic_scores?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.clinic_scores ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="clinic_name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {(data?.clinic_scores ?? []).map((entry, i) => (
                    <Cell key={i} fill={RISK_COLORS[entry.risk_level] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Inspections */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Inspections</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Clinic</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Score</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Risk</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_inspections ?? []).map((insp) => (
                <tr key={insp.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 px-3 font-medium">{insp.clinic_name ?? '—'}</td>
                  <td className="py-2.5 px-3">
                    {insp.score != null ? (
                      <div className="flex items-center gap-2">
                        <ScoreRing score={insp.score} size={36} strokeWidth={4} />
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-2.5 px-3">{insp.risk_level ? statusBadge(insp.risk_level) : '—'}</td>
                  <td className="py-2.5 px-3">{statusBadge(insp.status)}</td>
                  <td className="py-2.5 px-3 text-gray-500">
                    {insp.submitted_at ? new Date(insp.submitted_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {(data?.recent_inspections?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No inspections yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clinic score cards */}
      {(data?.clinic_scores?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.clinic_scores ?? []).map((c) => (
            <div key={c.clinic_id} className="card flex items-center gap-4">
              <ScoreRing score={c.score} size={64} />
              <div>
                <p className="font-semibold text-gray-900">{c.clinic_name}</p>
                {statusBadge(c.risk_level)}
                {c.last_inspection && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last: {new Date(c.last_inspection).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
