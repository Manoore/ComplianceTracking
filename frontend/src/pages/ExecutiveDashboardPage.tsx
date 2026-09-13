import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, AlertTriangle, CheckCircle, Clock,
  Building2, BarChart2, Award, ShieldAlert, Layers,
  ChevronDown, ChevronUp, ClipboardCheck, Eye, X
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { DashboardData, Department, User } from '../types'

const HIERARCHY_ROLE_LABELS: Record<string, string> = {
  clinic_lead: 'Clinic Lead',
  regional_manager: 'Regional Manager',
  director_of_operations: 'Director of Operations',
}

interface HierarchyClinicRow {
  clinic_id: number
  clinic_name: string
  region: string
  manager_name: string | null
  status: 'submitted' | 'missing' | 'no_daily_template'
  missing_templates: string[]
  open_corrective_actions: number
}

interface HierarchyRegion {
  region: string
  clinics: HierarchyClinicRow[]
  total: number
  submitted: number
  missing: number
}

interface HierarchyData {
  scope_label: string
  viewing_as: { id: number; full_name: string; custom_role: string | null; managed_region: string | null } | null
  available_regions: string[]
  as_of: string
  has_daily_templates: boolean
  summary: { total_clinics: number; submitted_today: number; missing_today: number }
  missing_clinics: HierarchyClinicRow[]
  regions: HierarchyRegion[]
}

function DailyStatusPill({ status }: { status: HierarchyClinicRow['status'] }) {
  if (status === 'submitted') {
    return <span className="badge bg-green-100 text-green-800 text-xs">Submitted</span>
  }
  if (status === 'missing') {
    return <span className="badge bg-red-100 text-red-800 text-xs">Missing</span>
  }
  return <span className="badge bg-gray-100 text-gray-500 text-xs">No daily checklist</span>
}

function HierarchyDashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [region, setRegion] = useState('')
  const [viewAsUserId, setViewAsUserId] = useState('')

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: isAdmin,
  })
  const hierarchyUsers = (allUsers ?? []).filter(u => u.custom_role && HIERARCHY_ROLE_LABELS[u.custom_role])

  const { data, isLoading } = useQuery<HierarchyData>({
    queryKey: ['reports-hierarchy', region, viewAsUserId],
    queryFn: () => api.get('/reports/hierarchy', {
      params: {
        region: region || undefined,
        view_as_user_id: viewAsUserId || undefined,
      },
    }).then(r => r.data),
    refetchInterval: 60_000,
  })

  const toggleRegion = (r: string) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(r)) next.delete(r); else next.add(r)
    return next
  })

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600 mx-auto" />
      </div>
    )
  }

  const pickers = (
    <div className="flex items-center gap-2">
      {data.available_regions.length > 1 && (
        <select className="input w-auto text-xs py-1" value={region} onChange={e => setRegion(e.target.value)}>
          <option value="">All Regions</option>
          {data.available_regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      )}
      {isAdmin && (
        <select className="input w-auto text-xs py-1" value={viewAsUserId} disabled={hierarchyUsers.length === 0}
          onChange={e => { setViewAsUserId(e.target.value); setRegion('') }}>
          <option value="">{hierarchyUsers.length === 0 ? 'View as… (no one assigned yet)' : 'View as…'}</option>
          {hierarchyUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({HIERARCHY_ROLE_LABELS[u.custom_role!]}{u.managed_region ? ` — ${u.managed_region}` : ''})
            </option>
          ))}
        </select>
      )}
    </div>
  )

  if (!data.has_daily_templates) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-brand-600" /> Daily Checklist Status
          </h2>
          {pickers}
        </div>
        <p className="text-sm text-gray-400">
          No template is marked as "daily" yet. Set a template's frequency to Daily on the
          Templates page to start tracking completion here.
        </p>
      </div>
    )
  }

  const { summary } = data
  const pct = summary.total_clinics > 0 ? Math.round((summary.submitted_today / summary.total_clinics) * 100) : 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={16} className="text-brand-600" /> Daily Checklist Status
        </h2>
        {pickers}
      </div>
      {data.viewing_as && (
        <div className="flex items-center gap-2 mb-2 text-xs text-brand-700 bg-brand-50 px-2.5 py-1.5 rounded-lg w-fit">
          <Eye size={13} />
          Viewing as {data.viewing_as.full_name}
          {data.viewing_as.custom_role && ` (${HIERARCHY_ROLE_LABELS[data.viewing_as.custom_role] ?? data.viewing_as.custom_role})`}
          <button onClick={() => setViewAsUserId('')} className="ml-1 hover:text-brand-900">
            <X size={13} />
          </button>
        </div>
      )}
      <p className="text-xs text-gray-400 mb-4">
        {data.scope_label} · {summary.submitted_today} of {summary.total_clinics} clinics submitted today's checklist ({pct}%)
      </p>

      {summary.missing_today > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm font-medium text-red-700 mb-2">
            {summary.missing_today} clinic{summary.missing_today !== 1 ? 's' : ''} missing today's checklist
          </p>
          <div className="space-y-1">
            {data.missing_clinics.map(c => (
              <div key={c.clinic_id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{c.clinic_name} <span className="text-gray-400">· {c.region}</span></span>
                <span className="text-gray-400 text-xs">{c.manager_name ?? 'No lead assigned'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data.regions.map(r => {
          const isCollapsed = collapsed.has(r.region)
          return (
            <div key={r.region} className="border border-gray-100 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => toggleRegion(r.region)}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                  {r.region}
                </span>
                <span className="text-xs text-gray-500">
                  {r.submitted}/{r.total} submitted{r.missing > 0 ? ` · ${r.missing} missing` : ''}
                </span>
              </button>
              {!isCollapsed && (
                <div className="divide-y divide-gray-50">
                  {r.clinics.map(c => (
                    <div key={c.clinic_id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="text-gray-800 truncate">{c.clinic_name}</p>
                        <p className="text-xs text-gray-400">{c.manager_name ?? 'No lead assigned'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.open_corrective_actions > 0 && (
                          <span className="text-xs text-orange-600">{c.open_corrective_actions} open action{c.open_corrective_actions !== 1 ? 's' : ''}</span>
                        )}
                        <DailyStatusPill status={c.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const RISK_COLOR: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
  unknown: '#94a3b8',
}

const RISK_BG: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-600',
}

function ScoreBar({ score, label, sub }: { score: number; label: string; sub?: string }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="font-medium text-gray-800">{label}</span>
          {sub && <span className="text-gray-400 text-xs ml-2">{sub}</span>}
        </div>
        <span className="font-semibold" style={{ color }}>{score.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function MiniTrendChart({ trend }: { trend: Array<{ month: string; avg_score: number }> }) {
  if (!trend.length) return null
  const max = 100
  const w = 320
  const h = 80
  const padX = 8
  const padY = 8
  const points = trend.map((t, i) => {
    const x = padX + (i / (trend.length - 1 || 1)) * (w - padX * 2)
    const y = padY + (1 - t.avg_score / max) * (h - padY * 2)
    return [x, y]
  })
  const polyline = points.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `${points[0][0]},${h} ${polyline} ${points[points.length - 1][0]},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <polygon points={area} fill="#3b82f620" />
      <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" />
      ))}
    </svg>
  )
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-brand-600', bg = 'bg-brand-50' }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; bg?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${bg}`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function ExecutiveDashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['exec-dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    refetchInterval: 60_000,
  })
  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })
  const { data: clinicsRaw } = useQuery<any[]>({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
      </div>
    )
  }

  const s = data?.summary
  const clinics = data?.clinic_scores ?? []
  const trend = data?.trend ?? []

  const highRisk = clinics.filter(c => c.risk_level === 'high' || c.risk_level === 'critical')

  // Compute department-level rollup from clinic scores
  const deptBreakdown = (departments ?? []).map(dept => {
    const deptClinicIds = new Set(
      (clinicsRaw ?? []).filter((c: any) => c.department_id === dept.id).map((c: any) => c.id)
    )
    const deptScores = clinics.filter(c => deptClinicIds.has(c.clinic_id))
    const avg = deptScores.length
      ? deptScores.reduce((acc, c) => acc + (c.score ?? 0), 0) / deptScores.length
      : null
    return { dept, clinicCount: deptScores.length, avg }
  }).filter(d => d.clinicCount > 0)
  const avgScore = s?.avg_compliance_score ?? 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="text-brand-600" size={26} /> Executive Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Organization-wide compliance at a glance.</p>
        </div>
        <span className="text-xs text-gray-400">Auto-refreshes every 60s</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Avg Compliance" value={`${avgScore.toFixed(1)}%`}
          icon={TrendingUp}
          color={avgScore >= 80 ? 'text-green-600' : avgScore >= 60 ? 'text-amber-600' : 'text-red-600'}
          bg={avgScore >= 80 ? 'bg-green-50' : avgScore >= 60 ? 'bg-amber-50' : 'bg-red-50'}
        />
        <StatCard label="Open Actions" value={s?.open_corrective_actions ?? 0}
          sub={s?.overdue_corrective_actions ? `${s.overdue_corrective_actions} overdue` : undefined}
          icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50" />
        <StatCard label="Pending Review" value={s?.pending_review ?? 0}
          sub="inspections awaiting audit"
          icon={Clock} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Certifications" value={`${s?.completed_certifications ?? 0}/${s?.total_certifications ?? 0}`}
          sub={s?.overdue_certifications ? `${s.overdue_certifications} expiring soon` : 'all on track'}
          icon={Award} color="text-purple-600" bg="bg-purple-50" />
      </div>

      <HierarchyDashboard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">6-Month Compliance Trend</h2>
          <p className="text-xs text-gray-400 mb-3">Average score across all submitted inspections</p>
          <MiniTrendChart trend={trend} />
          <div className="flex justify-between mt-1">
            {trend.map(t => (
              <span key={t.month} className="text-xs text-gray-400">{t.month}</span>
            ))}
          </div>
        </div>

        {/* High risk clinics */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-500" /> At-Risk Locations
          </h2>
          {highRisk.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
              <p className="text-sm">All locations in good standing</p>
            </div>
          ) : (
            <div className="space-y-3">
              {highRisk.slice(0, 6).map(c => (
                <div key={c.clinic_id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.clinic_name}</p>
                    <span className={`inline-flex text-xs px-1.5 py-0.5 rounded font-medium ${RISK_BG[c.risk_level] ?? RISK_BG.unknown}`}>
                      {c.risk_level}
                    </span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: RISK_COLOR[c.risk_level] ?? RISK_COLOR.unknown }}>
                    {c.score?.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clinic scorecard */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-brand-600" /> Location Scorecard
        </h2>
        {clinics.length === 0 ? (
          <p className="text-sm text-gray-400">No inspection data yet.</p>
        ) : (
          <div className="space-y-3">
            {[...clinics]
              .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
              .map(c => (
                <ScoreBar
                  key={c.clinic_id}
                  label={c.clinic_name}
                  score={c.score ?? 0}
                  sub={c.last_inspection ? `Last: ${new Date(c.last_inspection).toLocaleDateString()}` : undefined}
                />
              ))}
          </div>
        )}
      </div>

      {/* Department breakdown */}
      {deptBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Layers size={16} className="text-brand-600" /> Department Breakdown
          </h2>
          <div className="space-y-3">
            {deptBreakdown.sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0)).map(({ dept, clinicCount, avg }) => (
              <ScoreBar
                key={dept.id}
                label={dept.name}
                score={avg ?? 0}
                sub={`${clinicCount} location${clinicCount !== 1 ? 's' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent inspections */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Submissions</h2>
        {(data?.recent_inspections ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">No submitted inspections yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Location</th>
                  <th className="text-left pb-2 font-medium">Score</th>
                  <th className="text-left pb-2 font-medium">Risk</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-left pb-2 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.recent_inspections.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-800">{i.clinic_name}</td>
                    <td className="py-2">
                      <span style={{ color: RISK_COLOR[i.risk_level ?? 'unknown'] }} className="font-semibold">
                        {i.score?.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_BG[i.risk_level ?? 'unknown']}`}>
                        {i.risk_level ?? '—'}
                      </span>
                    </td>
                    <td className="py-2 capitalize text-gray-600">{i.status?.replace('_', ' ')}</td>
                    <td className="py-2 text-gray-400">
                      {i.submitted_at ? new Date(i.submitted_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
