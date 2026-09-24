import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import type { ChecklistComplianceRow, Inspection } from '../types'
import { statusBadge } from '../components/ui/Badge'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, ClipboardList, Building2 } from 'lucide-react'
import { clsx } from 'clsx'
import { clickableDot } from '../utils/chartDot'

function scoreColorClass(score: number | null | undefined): string {
  if (score == null) return 'text-gray-400'
  if (score >= 85) return 'text-green-600'
  if (score >= 75) return 'text-amber-600'
  if (score >= 60) return 'text-orange-600'
  return 'text-red-600'
}

export function ChecklistReportPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()

  const { data: checklistData, isLoading: summaryLoading } = useQuery<{ checklists: ChecklistComplianceRow[] }>({
    queryKey: ['compliance-checklists', { template_id: templateId }],
    queryFn: () => api.get('/reports/compliance/checklists', { params: { template_id: templateId } }).then(r => r.data),
  })

  const { data: trend } = useQuery({
    queryKey: ['compliance-trends', { template_id: templateId }],
    queryFn: () => api.get('/reports/compliance-trends', { params: { template_id: templateId, days: 180 } }).then(r => r.data),
  })

  const { data: inspections, isLoading: inspectionsLoading } = useQuery<Inspection[]>({
    queryKey: ['inspections', { template_id: templateId }],
    queryFn: () => api.get('/inspections', { params: { template_id: templateId } }).then(r => r.data),
  })

  const summary = checklistData?.checklists[0]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="text-brand-700" size={20} />
            {summaryLoading ? 'Loading…' : summary?.template_name ?? 'Checklist'}
          </h1>
          {summary && (
            <p className="text-sm text-gray-500">
              {summary.inspection_count} inspection{summary.inspection_count !== 1 ? 's' : ''} across {summary.clinic_count} clinic{summary.clinic_count !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {summary && (
          <span className={clsx('text-3xl font-bold', scoreColorClass(summary.score))}>
            {summary.score != null ? `${summary.score}%` : '—'}
          </span>
        )}
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Score Over Time</h2>
        {(trend?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No inspection data available yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend ?? []}>
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

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Inspections Using This Checklist</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-2.5 px-4 text-gray-500 font-medium">Clinic</th>
              <th className="text-left py-2.5 px-4 text-gray-500 font-medium">Inspector</th>
              <th className="text-left py-2.5 px-4 text-gray-500 font-medium">Status</th>
              <th className="text-left py-2.5 px-4 text-gray-500 font-medium">Score</th>
              <th className="text-left py-2.5 px-4 text-gray-500 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {inspectionsLoading ? (
              <tr><td colSpan={5} className="text-center py-8"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></td></tr>
            ) : (inspections ?? []).map(i => (
              <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/inspections/${i.id}`)}>
                <td className="py-2.5 px-4 flex items-center gap-1.5">
                  <Building2 size={13} className="text-gray-400" /> {i.clinic_name ?? 'Unknown'}
                </td>
                <td className="py-2.5 px-4 text-gray-500">{i.inspector_name}</td>
                <td className="py-2.5 px-4">{statusBadge(i.status)}</td>
                <td className={clsx('py-2.5 px-4 font-semibold', scoreColorClass(i.compliance_score))}>
                  {i.compliance_score != null ? `${i.compliance_score}%` : '—'}
                </td>
                <td className="py-2.5 px-4 text-gray-500">
                  {i.submitted_at ? new Date(i.submitted_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {!inspectionsLoading && (inspections?.length ?? 0) === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No inspections yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
