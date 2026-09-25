import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, AlertTriangle, CheckCircle, Clock,
  Building2, BarChart2, Award, ShieldAlert, Layers,
  ChevronDown, ChevronUp, ClipboardCheck, Eye, X, ShieldCheck, Users,
  ArrowUp, ArrowDown, Minus, Flag,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useComplianceThresholds } from '../hooks/useComplianceThresholds'
import { scoreTextClass, scoreSoftBgClass, scoreBandClass, scoreHex } from '../utils/complianceColor'
import { DashboardData, Department, User } from '../types'

const HIERARCHY_ROLE_LABELS: Record<string, string> = {
  clinic_lead: 'Clinic Lead',
  regional_manager: 'Regional Manager',
  director_of_operations: 'Director of Operations',
}

type Frequency = 'daily' | 'weekly' | 'monthly'
const FREQUENCY_LABELS: Record<Frequency, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

interface HierarchyClinicRow {
  clinic_id: number
  clinic_name: string
  region: string
  manager_name: string | null
  status: 'submitted' | 'missing' | 'no_template'
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

interface IndividualRollup {
  name: string
  total_clinics: number
  submitted: number
  missing: number
  open_corrective_actions: number
}

interface HierarchyData {
  scope_label: string
  viewing_as: { id: number; full_name: string; custom_role: string | null; managed_region: string | null } | null
  available_regions: string[]
  as_of: string
  frequency: Frequency
  period_label: string
  has_templates: boolean
  summary: { total_clinics: number; submitted: number; missing: number }
  missing_clinics: HierarchyClinicRow[]
  regions: HierarchyRegion[]
  by_individual: IndividualRollup[]
}

function IndividualCard({ p, periodLabel }: { p: IndividualRollup; periodLabel: string }) {
  const allDone = p.missing === 0
  return (
    <div className={`rounded-xl border p-4 ${allDone ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold text-gray-900 text-sm truncate" title={p.name}>{p.name}</p>
        {allDone
          ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
          : <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">
        {p.submitted}<span className="text-sm font-normal text-gray-400">/{p.total_clinics}</span>
      </p>
      <p className="text-xs text-gray-400 mt-1 mb-2">clinics submitted {periodLabel}</p>
      {p.open_corrective_actions > 0 && (
        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
          {p.open_corrective_actions} open action{p.open_corrective_actions !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

function PeriodStatusPill({ status }: { status: HierarchyClinicRow['status'] }) {
  if (status === 'submitted') {
    return <span className="badge bg-green-100 text-green-800 text-xs">Submitted</span>
  }
  if (status === 'missing') {
    return <span className="badge bg-red-100 text-red-800 text-xs">Missing</span>
  }
  return <span className="badge bg-gray-100 text-gray-500 text-xs">No template</span>
}

function HierarchyDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const [toggled, setToggled] = useState<Set<string>>(new Set())
  const [region, setRegion] = useState('')
  const [viewAsUserId, setViewAsUserId] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('daily')

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: isAdmin,
  })
  const hierarchyUsers = (allUsers ?? []).filter(u => u.custom_role && HIERARCHY_ROLE_LABELS[u.custom_role])

  const { data, isLoading } = useQuery<HierarchyData>({
    queryKey: ['reports-hierarchy', region, viewAsUserId, frequency],
    queryFn: () => api.get('/reports/hierarchy', {
      params: {
        region: region || undefined,
        view_as_user_id: viewAsUserId || undefined,
        frequency,
      },
    }).then(r => r.data),
    refetchInterval: 60_000,
  })

  // A region's default open/closed state comes from the data (collapsed when everything's
  // submitted, open when something needs attention) -- `toggled` only records that the
  // viewer overrode that default by clicking it, in either direction.
  const isRegionCollapsed = (r: HierarchyRegion) => {
    const defaultCollapsed = r.missing === 0 && r.total > 0
    return toggled.has(r.region) ? !defaultCollapsed : defaultCollapsed
  }
  const toggleRegion = (r: string) => setToggled(prev => {
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

  const frequencyPicker = (
    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
      {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map(f => (
        <button
          key={f}
          onClick={() => setFrequency(f)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${frequency === f ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {FREQUENCY_LABELS[f]}
        </button>
      ))}
    </div>
  )

  const pickers = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {frequencyPicker}
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

  const panelTitle = `${FREQUENCY_LABELS[frequency]} Checklist Status`

  if (!data.has_templates) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-brand-600" /> {panelTitle}
          </h2>
          {pickers}
        </div>
        <p className="text-sm text-gray-400">
          No template is marked as "{frequency}" yet. Set a template's frequency to {FREQUENCY_LABELS[frequency]} on the
          Templates page to start tracking completion here.
        </p>
      </div>
    )
  }

  const { summary } = data
  const pct = summary.total_clinics > 0 ? Math.round((summary.submitted / summary.total_clinics) * 100) : 0

  // Which regions have anything missing, most-affected first -- a scannable overview
  // instead of repeating every clinic's name in a second flat list.
  const regionsNeedingAttention = [...data.regions].filter(r => r.missing > 0).sort((a, b) => b.missing - a.missing)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={16} className="text-brand-600" /> {panelTitle}
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
        {data.scope_label} · {summary.submitted} of {summary.total_clinics} clinics submitted {data.period_label}'s checklist ({pct}%)
      </p>

      {data.by_individual.length > 1 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Users size={12} /> By Clinic Lead
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.by_individual.map(p => <IndividualCard key={p.name} p={p} periodLabel={data.period_label} />)}
          </div>
        </div>
      )}

      {regionsNeedingAttention.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm font-medium text-red-700 mb-2">
            {summary.missing} clinic{summary.missing !== 1 ? 's' : ''} missing {data.period_label}'s checklist
          </p>
          <div className="flex flex-wrap gap-1.5">
            {regionsNeedingAttention.map(r => (
              <button
                key={r.region}
                onClick={() => { setToggled(prev => { const next = new Set(prev); next.delete(r.region); return next }) }}
                className="text-xs px-2.5 py-1 rounded-full bg-white border border-red-200 text-red-700 font-medium hover:bg-red-100 transition-colors"
                title={`Jump to ${r.region} below`}
              >
                {r.region} — {r.missing}/{r.total} missing
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data.regions.map(r => {
          const isCollapsed = isRegionCollapsed(r)
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
                <span className={`text-xs font-medium ${r.missing > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {r.submitted}/{r.total} submitted{r.missing > 0 ? ` · ${r.missing} missing` : ''}
                </span>
              </button>
              {!isCollapsed && (
                <div className="divide-y divide-gray-50">
                  {r.clinics.map(c => (
                    <button
                      key={c.clinic_id}
                      onClick={() => navigate(`/inspections?clinic_id=${c.clinic_id}`)}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                      title="View this clinic's checklist history"
                    >
                      <div className="min-w-0">
                        <p className="text-gray-800 truncate">{c.clinic_name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.manager_name ?? 'No lead assigned'}</p>
                        {c.status === 'missing' && c.missing_templates.length > 0 && (
                          <p className="text-xs text-red-500 truncate mt-0.5">Missing: {c.missing_templates.join(', ')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.open_corrective_actions > 0 && (
                          <span className="text-xs text-orange-600">{c.open_corrective_actions} open action{c.open_corrective_actions !== 1 ? 's' : ''}</span>
                        )}
                        <PeriodStatusPill status={c.status} />
                      </div>
                    </button>
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

function ScoreBar({ score, label, sub, onClick }: { score: number; label: string; sub?: string; onClick?: () => void }) {
  const thresholds = useComplianceThresholds()
  const color = scoreHex(score, thresholds)
  return (
    <div className={`space-y-1 ${onClick ? 'cursor-pointer group' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className={`font-medium text-gray-800 ${onClick ? 'group-hover:text-brand-700 group-hover:underline' : ''}`}>{label}</span>
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

// ---- Enterprise Compliance Report (Region -> Clinic x 3 checklists x 3 metrics) ----

type MatrixColumnKey = 'ma_daily' | 'ma_monthly' | 'rm_checklist'

interface MatrixMetric { current_month: number | null; three_month: number | null }
interface MatrixClinicRow {
  clinic_id: number
  clinic_name: string
  ma_daily: MatrixMetric
  ma_monthly: MatrixMetric
  rm_checklist: MatrixMetric
}
interface MatrixRegion { region: string; clinics: MatrixClinicRow[] }
interface ComplianceMatrixData {
  scope_label: string
  templates: Record<MatrixColumnKey, { id: number; name: string } | null>
  enterprise: Record<MatrixColumnKey, number | null>
  regions: MatrixRegion[]
}

const MATRIX_COLUMNS: Array<{ key: MatrixColumnKey; label: string }> = [
  { key: 'ma_daily', label: 'MA Daily Checklist' },
  { key: 'ma_monthly', label: 'MA Monthly Checklist' },
  { key: 'rm_checklist', label: 'RM Checklist' },
]

function MatrixCell({ score, onClick, title }: { score: number | null; onClick?: () => void; title?: string }) {
  const thresholds = useComplianceThresholds()
  const clickable = !!onClick && score != null
  return (
    <td
      onClick={clickable ? onClick : undefined}
      title={clickable ? title : undefined}
      className={`py-2 px-3 text-center text-sm font-medium ${scoreBandClass(score, thresholds)} ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-brand-300 transition-shadow' : ''}`}
    >
      {score != null ? `${score}%` : '—'}
    </td>
  )
}

// Builds a link into the day-by-day calendar for one checklist, optionally scoped to
// a specific clinic (highlighted/scrolled to on arrival) and a specific month.
function calendarUrl(templateId: number, opts?: { clinicId?: number; year?: number; month?: number }): string {
  const params = new URLSearchParams()
  if (opts?.clinicId) params.set('clinic_id', String(opts.clinicId))
  if (opts?.year) params.set('year', String(opts.year))
  if (opts?.month) params.set('month', String(opts.month))
  const qs = params.toString()
  return `/reports/calendar/${templateId}${qs ? `?${qs}` : ''}`
}

function ComplianceMatrix() {
  const navigate = useNavigate()
  const thresholds = useComplianceThresholds()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const { data, isLoading } = useQuery<ComplianceMatrixData>({
    queryKey: ['compliance-matrix'],
    queryFn: () => api.get('/reports/compliance-matrix').then(r => r.data),
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

  const missingColumns = MATRIX_COLUMNS.filter(col => !data.templates[col.key])
  const colSpan = 1 + MATRIX_COLUMNS.length * 3
  // The trailing-3-month window's first month (mirrors the backend's
  // _trailing_3_months_start) -- clicking a "3-Mo Avg" cell lands here so paging
  // forward twice with the calendar's own arrows covers the whole window.
  const now = new Date()
  const threeMoStartYear = new Date(now.getFullYear(), now.getMonth() - 2, 1).getFullYear()
  const threeMoStartMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1).getMonth() + 1

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 overflow-x-auto">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={16} className="text-brand-600" /> Enterprise Compliance Report
        </h2>
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> {thresholds.green}%+</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> {thresholds.amber}-{thresholds.green - 1}%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Below {thresholds.amber}%</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">{data.scope_label} · All Inspections</p>

      {missingColumns.length > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          {missingColumns.map(c => c.label).join(', ')} {missingColumns.length === 1 ? "isn't" : "aren't"} set up as
          a template yet, so those columns are empty.
        </p>
      )}

      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th rowSpan={2} className="text-left py-2 px-3 text-gray-500 font-medium align-bottom">Clinic</th>
            {MATRIX_COLUMNS.map(col => (
              <th key={col.key} colSpan={3} className="py-2 px-3 text-center text-gray-700 font-semibold border-l border-gray-100">
                {data.templates[col.key] ? (
                  <button onClick={() => navigate(`/reports/calendar/${data.templates[col.key]!.id}`)}
                    className="hover:text-brand-700 hover:underline">
                    {col.label}
                  </button>
                ) : col.label}
              </th>
            ))}
          </tr>
          <tr className="border-b border-gray-200 text-xs text-gray-400">
            {MATRIX_COLUMNS.map(col => (
              <Fragment key={col.key}>
                <th className="py-1.5 px-3 text-center font-medium border-l border-gray-100">This Month</th>
                <th className="py-1.5 px-3 text-center font-medium">3-Mo Avg</th>
                <th className="py-1.5 px-3 text-center font-medium">Enterprise</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.regions.map(region => {
            const isCollapsed = collapsed.has(region.region)
            return (
              <Fragment key={region.region}>
                <tr id={`matrix-region-${region.region}`} className="bg-gray-50 scroll-mt-4">
                  <td colSpan={colSpan} className="py-2 px-3">
                    <button onClick={() => toggleRegion(region.region)} className="flex items-center gap-2 text-sm font-medium text-gray-800">
                      {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      {region.region}
                      <span className="text-xs text-gray-400 font-normal">
                        ({region.clinics.length} clinic{region.clinics.length !== 1 ? 's' : ''})
                      </span>
                    </button>
                  </td>
                </tr>
                {!isCollapsed && region.clinics.map(c => (
                  <tr key={c.clinic_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <button onClick={() => navigate(`/clinics/${c.clinic_id}/profile`)}
                        className="text-gray-800 hover:text-brand-700 hover:underline text-left">
                        {c.clinic_name}
                      </button>
                    </td>
                    {MATRIX_COLUMNS.map(col => {
                      const tmpl = data.templates[col.key]
                      return (
                        <Fragment key={col.key}>
                          <MatrixCell score={c[col.key].current_month}
                            title="View this month's day-by-day report"
                            onClick={tmpl ? () => navigate(calendarUrl(tmpl.id, { clinicId: c.clinic_id })) : undefined} />
                          <MatrixCell score={c[col.key].three_month}
                            title="View the 3-month trailing window (use the arrows to page through it)"
                            onClick={tmpl ? () => navigate(calendarUrl(tmpl.id, {
                              clinicId: c.clinic_id, year: threeMoStartYear, month: threeMoStartMonth,
                            })) : undefined} />
                          <MatrixCell score={data.enterprise[col.key]}
                            title="View this checklist's day-by-day report"
                            onClick={tmpl ? () => navigate(calendarUrl(tmpl.id)) : undefined} />
                        </Fragment>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            )
          })}
          {data.regions.length === 0 && (
            <tr><td colSpan={colSpan} className="text-center py-8 text-gray-400">No clinics in view yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---- CEO Summary: one headline score + trend, and an exceptions-only list of
// regions that need attention, each with the accountable owner attached. Sits above
// the full matrix as the 30-second answer; everything below it is the drill-down. ----

interface CeoException {
  region: string
  score: number | null
  previous_score: number | null
  trend: number | null
  reasons: string[]
  clinic_count: number
  owner_name: string | null
  owner_id: number | null
}
interface CeoSummaryData {
  scope_label: string
  period_label: string
  amber_threshold: number
  overall: { score: number | null; previous_score: number | null; trend: number | null }
  exceptions: CeoException[]
  healthy_region_count: number
}

const EXCEPTION_REASON_LABELS: Record<string, string> = {
  below_threshold: 'Below threshold',
  declining: 'Declining',
}

function TrendIndicator({ trend }: { trend: number | null }) {
  if (trend == null) return <span className="text-xs text-gray-400">No prior month to compare</span>
  if (Math.abs(trend) < 0.5) {
    return <span className="flex items-center gap-1 text-xs font-medium text-gray-500"><Minus size={12} /> Flat</span>
  }
  const up = trend > 0
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(trend).toFixed(1)}pt vs last month
    </span>
  )
}

function CeoSummary() {
  const thresholds = useComplianceThresholds()
  const { data, isLoading } = useQuery<CeoSummaryData>({
    queryKey: ['ceo-summary'],
    queryFn: () => api.get('/reports/ceo-summary').then(r => r.data),
    refetchInterval: 60_000,
  })

  const scrollToRegion = (region: string) => {
    document.getElementById(`matrix-region-${region}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600 mx-auto" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{data.scope_label} · {data.period_label}</p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className={`text-4xl font-bold ${scoreTextClass(data.overall.score, thresholds)}`}>
              {data.overall.score != null ? `${data.overall.score}%` : '—'}
            </span>
            <TrendIndicator trend={data.overall.trend} />
          </div>
          <p className="text-xs text-gray-400 mt-1">Overall compliance this month</p>
        </div>
        {data.exceptions.length === 0 ? (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm font-medium flex-shrink-0">
            <CheckCircle size={16} /> Every region is on track
          </div>
        ) : (
          <p className="text-sm text-gray-500 flex-shrink-0">
            <span className="font-semibold text-gray-800">{data.exceptions.length}</span> region{data.exceptions.length !== 1 ? 's' : ''} need attention
            {data.healthy_region_count > 0 && ` · ${data.healthy_region_count} healthy`}
          </p>
        )}
      </div>

      {data.exceptions.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-gray-100">
          {data.exceptions.map(e => (
            <button key={e.region} onClick={() => scrollToRegion(e.region)}
              title="Jump to this region in the report below"
              className="w-full flex items-center justify-between gap-3 p-3 bg-red-50/60 border border-red-100 rounded-lg hover:bg-red-50 transition-colors text-left">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Flag size={13} className="text-red-500 flex-shrink-0" />
                  <span className="font-medium text-gray-900">{e.region}</span>
                  {e.reasons.map(r => (
                    <span key={r} className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                      {EXCEPTION_REASON_LABELS[r] ?? r}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {e.clinic_count} clinic{e.clinic_count !== 1 ? 's' : ''} · Owner: {e.owner_name ?? 'No Regional Manager assigned'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span className={`text-lg font-bold ${scoreTextClass(e.score, thresholds)}`}>
                  {e.score != null ? `${e.score}%` : '—'}
                </span>
                <TrendIndicator trend={e.trend} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ExecutiveDashboardPage() {
  const navigate = useNavigate()
  const thresholds = useComplianceThresholds()
  // Set by clicking a "Clinics by Risk Level" pie slice -- narrows the Location
  // Scorecard below to just that risk level, entirely client-side (already fetched).
  const [riskFilter, setRiskFilter] = useState<string | null>(null)
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
  const riskBreakdown = data?.risk_breakdown
  const auditSummary = data?.audit_summary
  const riskChartData = riskBreakdown
    ? (['low', 'medium', 'high', 'critical', 'unknown'] as const)
      .map(k => ({ name: k, value: riskBreakdown[k] }))
      .filter(d => d.value > 0)
    : []
  const auditChartData = auditSummary
    ? (['pending', 'in_review', 'approved', 'rejected', 'escalated'] as const)
      .map(k => ({ status: k, name: k.replace('_', ' '), value: auditSummary[k as keyof typeof auditSummary] as number }))
    : []

  const highRisk = clinics.filter(c => c.risk_level === 'high' || c.risk_level === 'critical')
  const scorecardClinics = riskFilter ? clinics.filter(c => c.risk_level === riskFilter) : clinics

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
      {data?.scope_label === 'No region assigned' && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <span className="text-amber-800">
            Your account doesn't have a region assigned yet, so you can't see any clinics or inspections.
            Ask your admin to set your Managed Region on the Users page.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="text-brand-600" size={26} /> Executive Dashboard
            {data?.scope_label && data.scope_label !== 'All Regions' && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                {data.scope_label}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.scope_label && data.scope_label !== 'All Regions'
              ? 'Compliance for the clinics you oversee.'
              : 'Organization-wide compliance at a glance.'}
          </p>
        </div>
        <span className="text-xs text-gray-400">Auto-refreshes every 60s</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Avg Compliance" value={`${avgScore.toFixed(1)}%`}
          icon={TrendingUp}
          color={scoreTextClass(avgScore, thresholds)}
          bg={scoreSoftBgClass(avgScore, thresholds)}
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

      <CeoSummary />

      <ComplianceMatrix />

      <HierarchyDashboard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900">6-Month Compliance Trend</h2>
            <Link to="/reports" className="text-xs font-medium text-brand-700 hover:underline">View full report →</Link>
          </div>
          <p className="text-xs text-gray-400 mb-3">Average score across all submitted inspections</p>
          {trend.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">No inspection data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Avg score']} />
                <Area type="monotone" dataKey="avg_score" stroke="#2563eb" strokeWidth={2}
                      fill="url(#trendFill)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
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
                <button key={c.clinic_id} onClick={() => navigate(`/clinics/${c.clinic_id}/profile`)}
                  className="w-full flex items-center justify-between gap-2 text-left hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.clinic_name}</p>
                    <span className={`inline-flex text-xs px-1.5 py-0.5 rounded font-medium ${RISK_BG[c.risk_level] ?? RISK_BG.unknown}`}>
                      {c.risk_level}
                    </span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: RISK_COLOR[c.risk_level] ?? RISK_COLOR.unknown }}>
                    {c.score?.toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <ShieldAlert size={16} className="text-brand-600" /> Clinics by Risk Level
          </h2>
          <p className="text-xs text-gray-400 mb-3">Based on each clinic's most recent inspection</p>
          {riskChartData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">No inspection data yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={riskChartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}
                    cursor="pointer"
                    onClick={(d: any) => setRiskFilter(prev => prev === d?.name ? null : d?.name)}>
                    {riskChartData.map(d => (
                      <Cell key={d.name} fill={RISK_COLOR[d.name] ?? RISK_COLOR.unknown}
                        opacity={riskFilter && riskFilter !== d.name ? 0.35 : 1} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v} clinic${v !== 1 ? 's' : ''}`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {riskChartData.map(d => (
                  <button key={d.name} onClick={() => setRiskFilter(prev => prev === d.name ? null : d.name)}
                    className={`flex items-center justify-between text-sm w-full hover:bg-gray-50 rounded px-1 -mx-1 ${riskFilter && riskFilter !== d.name ? 'opacity-40' : ''}`}>
                    <span className="flex items-center gap-1.5 capitalize text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: RISK_COLOR[d.name] ?? RISK_COLOR.unknown }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-gray-800">{d.value}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Audit pipeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand-600" /> Audit Pipeline
            </h2>
            {auditSummary?.approval_rate != null && (
              <span className="text-xs font-medium text-gray-500">{auditSummary.approval_rate}% approval rate</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">Every audit review, by current status</p>
          {!auditSummary || auditSummary.total === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">No audits submitted yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={auditChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} className="capitalize" />
                <Tooltip formatter={(v: number) => [`${v}`, 'Reviews']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(d: any) => d?.status && navigate(`/audits?status=${d.status}`)}>
                  {auditChartData.map(d => (
                    <Cell key={d.name} fill={
                      d.name === 'approved' ? '#22c55e' : d.name === 'rejected' ? '#ef4444'
                      : d.name === 'escalated' ? '#f97316' : '#94a3b8'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Clinic scorecard */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Building2 size={16} className="text-brand-600" /> Location Scorecard
          </h2>
          {riskFilter && (
            <button onClick={() => setRiskFilter(null)}
              className="flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg hover:bg-brand-100">
              {riskFilter} risk only <X size={12} />
            </button>
          )}
        </div>
        {clinics.length === 0 ? (
          <p className="text-sm text-gray-400">No inspection data yet.</p>
        ) : scorecardClinics.length === 0 ? (
          <p className="text-sm text-gray-400">
            {riskFilter === 'unknown'
              ? "Clinics with no inspection yet aren't scored here -- check the Clinics page."
              : `No clinics at ${riskFilter} risk.`}
          </p>
        ) : (
          <div className="space-y-3">
            {[...scorecardClinics]
              .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
              .map(c => (
                <ScoreBar
                  key={c.clinic_id}
                  label={c.clinic_name}
                  score={c.score ?? 0}
                  sub={c.last_inspection ? `Last: ${new Date(c.last_inspection).toLocaleDateString()}` : undefined}
                  onClick={() => navigate(`/clinics/${c.clinic_id}/profile`)}
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
                onClick={() => navigate(`/clinics?department_id=${dept.id}`)}
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
                  <tr key={i.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/inspections/${i.id}`)}>
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
