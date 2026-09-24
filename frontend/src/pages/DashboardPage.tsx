import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import type { DashboardData } from '../types'
import { ScoreRing } from '../components/ui/ScoreRing'
import { statusBadge } from '../components/ui/Badge'
import { useAuth } from '../hooks/useAuth'
import { hasOversight } from '../utils/hierarchy'
import { Link, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts'
import { ClipboardList, AlertTriangle, CheckSquare, Building2, LayoutDashboard, User, Award, X, ClipboardCheck } from 'lucide-react'
import { clsx } from 'clsx'

function StatCard({ title, value, sub, icon: Icon, color, to }: {
  title: string; value: number | string; sub?: string; icon: any; color: string; to?: string
}) {
  const body = (
    <>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </>
  )
  if (to) return (
    <Link to={to} className="card flex items-start gap-4 hover:shadow-md hover:border-brand-200 transition-shadow">
      {body}
    </Link>
  )
  return <div className="card flex items-start gap-4">{body}</div>
}

const RISK_COLORS: Record<string, string> = {
  low: '#16a34a', medium: '#d97706', high: '#ea580c', critical: '#dc2626'
}

const RISK_PIE_COLORS = ['#16a34a', '#d97706', '#ea580c', '#dc2626']

function MyTasksView() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => api.get('/reports/my-tasks').then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Open Actions" value={data?.open_corrective_actions ?? 0}
          sub={`${data?.overdue_actions ?? 0} overdue`} icon={AlertTriangle} color="bg-orange-500" />
        <StatCard title="Pending Certifications" value={data?.pending_certifications ?? 0}
          sub="awaiting completion" icon={CheckSquare} color="bg-purple-600" />
        <StatCard title="Expiring Soon" value={data?.expiring_certifications ?? 0}
          sub="within 30 days" icon={ClipboardList} color="bg-red-500" />
      </div>

      {(data?.my_actions ?? []).length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">My Corrective Actions</h2>
          <div className="space-y-2">
            {(data?.my_actions ?? []).map((a: any) => (
              <Link key={a.id} to="/corrective-actions"
                className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.clinic_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.due_date && (
                    <span className={`text-xs ${new Date(a.due_date) < new Date() ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      Due {new Date(a.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {statusBadge(a.status)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(data?.my_certifications ?? []).length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">My Certifications</h2>
          <div className="space-y-2">
            {(data?.my_certifications ?? []).map((c: any) => (
              <Link key={c.id} to="/certifications"
                className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.title}</p>
                  {c.due_date && <p className="text-xs text-gray-400 mt-0.5">Due {new Date(c.due_date).toLocaleDateString()}</p>}
                </div>
                {statusBadge(c.status)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {(data?.my_actions?.length ?? 0) === 0 && (data?.my_certifications?.length ?? 0) === 0 && (
        <div className="card text-center py-12 text-gray-400">No pending tasks assigned to you</div>
      )}
    </div>
  )
}

function CredentialExpiryBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { data } = useQuery({
    queryKey: ['credentials-summary'],
    queryFn: () => api.get('/credentials/summary').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  if (dismissed || !data) return null
  const urgent = (data.expired ?? 0) + (data.expiring_30 ?? 0)
  if (urgent === 0) return null
  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
      <Award size={16} className="text-amber-600 flex-shrink-0" />
      <span className="flex-1 text-amber-800">
        <strong>{urgent} credential{urgent !== 1 ? 's' : ''}</strong> {data.expired > 0 ? `${data.expired} expired` : ''}{data.expired > 0 && data.expiring_30 > 0 ? ', ' : ''}{data.expiring_30 > 0 ? `${data.expiring_30} expiring within 30 days` : ''}.
        {' '}<a href="/credentials" className="font-medium underline">Review now →</a>
      </span>
      <button onClick={() => setDismissed(true)} className="p-1 hover:bg-amber-100 rounded text-amber-500"><X size={14} /></button>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'overview' | 'my-tasks'>('overview')

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    refetchInterval: 60_000,
  })

  const riskBreakdown = (data as any)?.risk_breakdown ?? {}
  const riskPieData = [
    { name: 'Low', value: riskBreakdown.low ?? 0 },
    { name: 'Medium', value: riskBreakdown.medium ?? 0 },
    { name: 'High', value: riskBreakdown.high ?? 0 },
    { name: 'Critical', value: riskBreakdown.critical ?? 0 },
  ].filter(d => d.value > 0)

  const isStaff = !hasOversight(user)

  // Set by clicking a Risk Breakdown pie slice -- narrows the Clinic Compliance
  // Scores chart/cards below to just that risk level, entirely client-side (the
  // data's already fetched with risk_level per clinic, no extra request needed).
  const [riskFilter, setRiskFilter] = useState<string | null>(null)
  const filteredClinicScores = riskFilter
    ? (data?.clinic_scores ?? []).filter(c => c.risk_level === riskFilter)
    : (data?.clinic_scores ?? [])

  // Real count of items waiting on this specific person's countersignature, not just
  // the tenant-wide "pending review" total in the KPI row above -- so a Clinic Lead/
  // Regional Manager can tell at a glance whether their own queue actually has
  // anything in it, instead of having to click into Pending Reviews to find out.
  const { data: pendingReviews } = useQuery({
    queryKey: ['pending-reviews'],
    queryFn: () => api.get('/inspections/pending-review').then(r => r.data),
    enabled: !isStaff && tab === 'overview',
  })

  if (isLoading && tab === 'overview') return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
  )

  const s = data?.summary
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutDashboard size={14} /> Overview
          </button>
          <button
            onClick={() => setTab('my-tasks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'my-tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <User size={14} /> My Tasks
          </button>
        </div>
      </div>

      {tab === 'my-tasks' ? <MyTasksView /> : (
        <>
          {(user?.role === 'admin' || user?.role === 'manager') && <CredentialExpiryBanner />}
          {!isStaff && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
              <StatCard title="Pending Your Review" value={pendingReviews?.length ?? 0}
                sub={(pendingReviews?.length ?? 0) > 0 ? 'waiting on your countersignature' : 'nothing waiting on you'}
                icon={ClipboardCheck} color="bg-teal-600" to="/pending-reviews" />
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Compliance Trend */}
            <div className="card xl:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Compliance Trend (6 Months)</h2>
                {!isStaff && <Link to="/reports" className="text-xs font-medium text-brand-700 hover:underline">View full report →</Link>}
              </div>
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

            {/* Risk Breakdown */}
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Risk Breakdown</h2>
              {riskPieData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No inspection data</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value"
                        cursor="pointer"
                        onClick={(d: any) => {
                          const risk = d?.name?.toLowerCase()
                          setRiskFilter(prev => prev === risk ? null : risk)
                        }}>
                        {riskPieData.map((d, i) => (
                          <Cell key={i} fill={RISK_PIE_COLORS[i]}
                            opacity={riskFilter && riskFilter !== d.name.toLowerCase() ? 0.35 : 1} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string) => [v, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {riskPieData.map((d, i) => (
                      <button key={d.name}
                        onClick={() => setRiskFilter(prev => prev === d.name.toLowerCase() ? null : d.name.toLowerCase())}
                        className={clsx('flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900',
                          riskFilter && riskFilter !== d.name.toLowerCase() && 'opacity-40')}>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: RISK_PIE_COLORS[i] }} />
                        <span>{d.name}: <strong>{d.value}</strong></span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Clinic Scores */}
          {!isStaff && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Clinic Compliance Scores</h2>
                {riskFilter && (
                  <button onClick={() => setRiskFilter(null)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg hover:bg-brand-100">
                    {riskFilter} risk only <X size={12} />
                  </button>
                )}
              </div>
              {filteredClinicScores.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">
                  {riskFilter ? `No clinics at ${riskFilter} risk` : 'No data yet'}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={filteredClinicScores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="clinic_name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(entry: any) => entry?.clinic_id && navigate(`/clinics/${entry.clinic_id}/profile`)}>
                      {filteredClinicScores.map((entry, i) => (
                        <Cell key={i} fill={RISK_COLORS[entry.risk_level] || '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

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
                    <tr key={insp.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/inspections/${insp.id}`)}>
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
          {filteredClinicScores.length > 0 && !isStaff && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClinicScores.map((c) => (
                <Link key={c.clinic_id} to={`/clinics/${c.clinic_id}/profile`}
                  className="card flex items-center gap-4 hover:shadow-md transition-shadow">
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
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
