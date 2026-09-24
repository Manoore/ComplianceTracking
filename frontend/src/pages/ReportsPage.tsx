import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type {
  ComplianceFilterOptions, ClinicComplianceRow, ChecklistComplianceRow, PersonComplianceReport, OverallComplianceScore,
} from '../types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { clickableDot } from '../utils/chartDot'
import { Download, FileSpreadsheet, FileText, Building2, ClipboardList, Users, Filter, X, ChevronRight, Gauge, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { useComplianceThresholds } from '../hooks/useComplianceThresholds'
import { scoreTextClass } from '../utils/complianceColor'

const CSV_EXPORTS = [
  { resource: 'inspections', label: 'Inspections' },
  { resource: 'actions', label: 'Corrective Actions' },
  { resource: 'certifications', label: 'Certifications' },
]

const EXCEL_EXPORTS = [
  { resource: 'inspections', label: 'Inspections Report' },
  { resource: 'actions', label: 'Corrective Actions Report' },
  { resource: 'certifications', label: 'Certifications Report' },
  { resource: 'clinic_scorecard', label: 'Clinic Scorecard' },
]


interface Filters {
  clinic_id?: number
  region?: string
  date_from?: string
  date_to?: string
  assignee_id?: number
}

function FilterBar({ options, filters, onChange }: {
  options?: ComplianceFilterOptions
  filters: Filters
  onChange: (f: Filters) => void
}) {
  const hasFilters = Object.values(filters).some(v => v !== undefined && v !== '')
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
        <Filter size={15} /> Filters
        {options?.scope_label && <span className="ml-auto text-xs font-normal text-gray-400">{options.scope_label}</span>}
      </div>
      {options?.scope_label === 'No region assigned' && (
        <div className="flex items-center gap-2 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle size={14} className="flex-shrink-0" />
          Your account doesn't have a region assigned yet, so nothing shows up here. Ask your admin to set your Managed Region on the Users page.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-gray-500">Clinic</label>
          <select className="input text-sm" value={filters.clinic_id ?? ''}
            onChange={e => onChange({ ...filters, clinic_id: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">All clinics</option>
            {(options?.clinics ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Location</label>
          <select className="input text-sm" value={filters.region ?? ''}
            onChange={e => onChange({ ...filters, region: e.target.value || undefined })}>
            <option value="">All locations</option>
            {(options?.regions ?? []).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">From</label>
          <input type="date" className="input text-sm" value={filters.date_from ?? ''}
            onChange={e => onChange({ ...filters, date_from: e.target.value || undefined })} />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <input type="date" className="input text-sm" value={filters.date_to ?? ''}
            onChange={e => onChange({ ...filters, date_to: e.target.value || undefined })} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Assignee</label>
          <select className="input text-sm" value={filters.assignee_id ?? ''}
            onChange={e => onChange({ ...filters, assignee_id: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Everyone</option>
            {(options?.assignees ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      {hasFilters && (
        <button onClick={() => onChange({})} className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <X size={12} /> Clear filters
        </button>
      )}
    </div>
  )
}

export function ReportsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const thresholds = useComplianceThresholds()
  // The export/CSV endpoints are still admin/auditor-only on the backend (a Clinic
  // Lead/Regional Manager/Director/Executive is always base role team_member, so they'd
  // never pass that check) -- hide the tab entirely for them rather than show buttons
  // that always fail.
  const canExport = user?.role === 'admin' || user?.role === 'auditor'
  const [tab, setTab] = useState<'overview' | 'exports'>('overview')
  const [filters, setFilters] = useState<Filters>({})
  const [asUserId, setAsUserId] = useState<number | null>(null)
  const [trail, setTrail] = useState<Array<{ id: number; name: string }>>([])

  const filterParams = {
    clinic_id: filters.clinic_id, region: filters.region,
    date_from: filters.date_from, date_to: filters.date_to, assignee_id: filters.assignee_id,
  }

  const handleFilterChange = (f: Filters) => {
    setFilters(f)
    // A filter change starts the People drill-down over from "you" -- an
    // in-place hierarchy position from before the filters changed would be
    // confusing to keep, since the data underneath it just changed shape.
    setAsUserId(null)
    setTrail([])
  }

  const { data: filterOptions } = useQuery<ComplianceFilterOptions>({
    queryKey: ['compliance-filters'],
    queryFn: () => api.get('/reports/compliance/filters').then(r => r.data),
  })

  const { data: clinicData, isLoading: clinicsLoading } = useQuery<{ overall: OverallComplianceScore; clinics: ClinicComplianceRow[] }>({
    queryKey: ['compliance-clinics', filterParams],
    queryFn: () => api.get('/reports/compliance/clinics', { params: filterParams }).then(r => r.data),
    enabled: tab === 'overview',
  })

  const { data: checklistData, isLoading: checklistsLoading } = useQuery<{ checklists: ChecklistComplianceRow[] }>({
    queryKey: ['compliance-checklists', filterParams],
    queryFn: () => api.get('/reports/compliance/checklists', { params: filterParams }).then(r => r.data),
    enabled: tab === 'overview',
  })

  const { data: peopleData, isLoading: peopleLoading } = useQuery<PersonComplianceReport>({
    queryKey: ['compliance-people', filterParams, asUserId],
    queryFn: () => api.get('/reports/compliance/people', { params: { ...filterParams, as_user_id: asUserId ?? undefined } }).then(r => r.data),
    enabled: tab === 'overview',
  })

  const { data: trends } = useQuery({
    queryKey: ['compliance-trends'],
    queryFn: () => api.get('/reports/compliance-trends').then(r => r.data),
    enabled: tab === 'exports' && canExport,
  })

  const drillInto = (id: number, name: string) => {
    setAsUserId(id)
    setTrail(t => [...t, { id, name }])
  }
  const drillToTrailIndex = (idx: number) => {
    if (idx < 0) { setAsUserId(null); setTrail([]); return }
    setAsUserId(trail[idx].id)
    setTrail(t => t.slice(0, idx + 1))
  }

  // The backend now names the file after the scope it's limited to and the date it
  // was generated (e.g. inspections_region-east_2026-09-24.csv) -- use that instead
  // of the generic resource name so the download itself says what's in it.
  const filenameFromHeaders = (response: any, fallback: string) => {
    const match = /filename=([^;]+)/.exec(response.headers?.['content-disposition'] ?? '')
    return match ? match[1].trim() : fallback
  }

  const handleCsvExport = async (resource: string) => {
    try {
      const response = await api.get(`/reports/export/csv?resource=${resource}`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameFromHeaders(response, `${resource}.csv`)
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  const handleExcelExport = async (resource: string) => {
    try {
      const response = await api.get(`/reports/export/excel?resource=${resource}`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameFromHeaders(response, `${resource}.xlsx`)
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel export downloaded')
    } catch {
      toast.error('Excel export failed')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>

      <div className="flex gap-2">
        <button className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'overview' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
          onClick={() => setTab('overview')}>Compliance Overview</button>
        {canExport && (
          <button className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'exports' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
            onClick={() => setTab('exports')}>Exports</button>
        )}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <FilterBar options={filterOptions} filters={filters} onChange={handleFilterChange} />

          {/* Overall compliance score -- one top-line number for everything
              currently in view, before drilling into any one clinic/checklist/person. */}
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-50 rounded-xl">
                <Gauge size={22} className="text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Overall Compliance Score</p>
                <p className="text-xs text-gray-400">
                  {clinicsLoading ? 'Loading…' : clinicData
                    ? `Across ${clinicData.overall.scored_clinic_count} of ${clinicData.overall.clinic_count} clinic${clinicData.overall.clinic_count !== 1 ? 's' : ''} · ${clinicData.overall.inspection_count} inspection${clinicData.overall.inspection_count !== 1 ? 's' : ''}`
                    : ''}
                </p>
              </div>
            </div>
            <span className={clsx('text-4xl font-bold', scoreTextClass(clinicData?.overall.score ?? null, thresholds))}>
              {clinicData?.overall.score != null ? `${clinicData.overall.score}%` : '—'}
            </span>
          </div>

          {/* Clinics */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={17} className="text-brand-600" />
              <h2 className="text-base font-semibold text-gray-900">Clinics</h2>
            </div>
            {clinicsLoading ? (
              <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
            ) : (clinicData?.clinics.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No clinics match these filters</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clinicData!.clinics.map(c => (
                  <button key={c.clinic_id} onClick={() => navigate(`/clinics/${c.clinic_id}/profile`)}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-gray-50 transition-colors text-left">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{c.clinic_name}</p>
                      <p className="text-xs text-gray-400">{c.region || 'No location'} · {c.inspection_count} inspection{c.inspection_count !== 1 ? 's' : ''}</p>
                      {c.manager_name && <p className="text-xs text-gray-400">Lead: {c.manager_name}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span className={clsx('text-lg font-bold', scoreTextClass(c.score, thresholds))}>{c.score != null ? `${c.score}%` : '—'}</span>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Checklists */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={17} className="text-brand-600" />
              <h2 className="text-base font-semibold text-gray-900">Checklists</h2>
            </div>
            {checklistsLoading ? (
              <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
            ) : (checklistData?.checklists.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No checklists match these filters</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {checklistData!.checklists.map(t => (
                  <button key={t.template_id} onClick={() => navigate(`/reports/checklists/${t.template_id}`)}
                    className="w-full flex items-center justify-between py-3 hover:bg-gray-50 transition-colors text-left px-2 -mx-2 rounded">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{t.template_name}</p>
                      <p className="text-xs text-gray-400">{t.inspection_count} inspection{t.inspection_count !== 1 ? 's' : ''} · {t.clinic_count} clinic{t.clinic_count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span className={clsx('text-lg font-bold', scoreTextClass(t.score, thresholds))}>{t.score != null ? `${t.score}%` : '—'}</span>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* People (hierarchical) */}
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <Users size={17} className="text-brand-600" />
              <h2 className="text-base font-semibold text-gray-900">People</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Click a name to see their own score and the people reporting to them.
            </p>

            <div className="flex items-center gap-1 text-xs text-gray-500 mb-4 flex-wrap">
              <button onClick={() => drillToTrailIndex(-1)} className={clsx('hover:underline', trail.length === 0 && 'font-semibold text-gray-800')}>
                You
              </button>
              {trail.map((t, i) => (
                <span key={t.id} className="flex items-center gap-1">
                  <ChevronRight size={12} />
                  <button onClick={() => drillToTrailIndex(i)} className={clsx('hover:underline', i === trail.length - 1 && 'font-semibold text-gray-800')}>
                    {t.name}
                  </button>
                </span>
              ))}
            </div>

            {peopleLoading || !peopleData ? (
              <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900">{peopleData.subject.name}</p>
                    <p className="text-xs text-gray-500">
                      {peopleData.subject.role_label}
                      {peopleData.subject.region ? ` · ${peopleData.subject.region}` : ''}
                      {' · '}
                      {peopleData.subject.basis === 'own_inspections'
                        ? `${peopleData.subject.inspection_count} inspection${peopleData.subject.inspection_count !== 1 ? 's' : ''}`
                        : `${peopleData.subject.clinic_count} clinic${peopleData.subject.clinic_count !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span className={clsx('text-2xl font-bold', scoreTextClass(peopleData.subject.score, thresholds))}>
                    {peopleData.subject.score != null ? `${peopleData.subject.score}%` : '—'}
                  </span>
                </div>

                {peopleData.reports.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {peopleData.subject.basis === 'own_inspections' ? 'No one reports to an MA/PCT.' : 'No one found reporting to this person yet.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {peopleData.reports.map(r => (
                      <button key={r.id} onClick={() => drillInto(r.id, r.name)}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-gray-50 transition-colors text-left">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{r.name}</p>
                          <p className="text-xs text-gray-400">{r.role_label}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <span className={clsx('text-lg font-bold', scoreTextClass(r.score, thresholds))}>{r.score != null ? `${r.score}%` : '—'}</span>
                          <ChevronRight size={16} className="text-gray-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'exports' && canExport && (
        <div className="space-y-6">
          {filterOptions?.scope_label && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Every export below is limited to what you can see: <strong>{filterOptions.scope_label}</strong>.
              The clinic each row belongs to is included as its own column, and the file name and sheet
              both note this scope and the date it was generated.
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CSV Exports */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={18} className="text-brand-600" />
                <h2 className="text-base font-semibold text-gray-900">CSV Exports</h2>
              </div>
              <div className="space-y-2">
                {CSV_EXPORTS.map(r => (
                  <button key={r.resource} onClick={() => handleCsvExport(r.resource)}
                    className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-brand-300 transition-colors text-left">
                    <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                      <Download className="text-gray-600" size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{r.label}</p>
                      <p className="text-xs text-gray-400">Download as .csv</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Excel Exports */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FileSpreadsheet size={18} className="text-green-600" />
                <h2 className="text-base font-semibold text-gray-900">Excel Reports</h2>
              </div>
              <div className="space-y-2">
                {EXCEL_EXPORTS.map(r => (
                  <button key={r.resource} onClick={() => handleExcelExport(r.resource)}
                    className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors text-left">
                    <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                      <FileSpreadsheet className="text-green-600" size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{r.label}</p>
                      <p className="text-xs text-gray-400">Download as .xlsx</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Compliance Score Over Time</h2>
            {(trends?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">No inspection data available yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
                  <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2}
                    dot={clickableDot((p: any) => p?.id && navigate(`/inspections/${p.id}`))} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
