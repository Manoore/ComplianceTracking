import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { AuditReview, Inspection } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge } from '../components/ui/Badge'
import { ScoreRing } from '../components/ui/ScoreRing'
import { FileText, CheckCircle, XCircle, Download } from 'lucide-react'
import toast from 'react-hot-toast'

function ReviewModal({ review, onClose }: { review: AuditReview; onClose: () => void }) {
  const qc = useQueryClient()
  const [findings, setFindings] = useState(review.findings ?? '')
  const [riskScore, setRiskScore] = useState(review.risk_score?.toString() ?? '')
  const [riskLevel, setRiskLevel] = useState(review.risk_level ?? 'medium')

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/audits/reviews/${review.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-reviews'] })
      toast.success('Review saved')
      onClose()
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const reportMutation = useMutation({
    mutationFn: () => api.post(`/audits/reviews/${review.id}/report`),
    onSuccess: (r) => {
      toast.success('Report generated')
      window.open(r.data.report_path, '_blank')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Audit Review #{review.id}</h2>
          {statusBadge(review.status)}
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Findings</label>
            <textarea rows={4} className="input" value={findings} onChange={e => setFindings(e.target.value)}
              placeholder="Describe audit findings…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Risk Score (0-100)</label>
              <input type="number" min={0} max={100} className="input" value={riskScore}
                onChange={e => setRiskScore(e.target.value)} />
            </div>
            <div>
              <label className="label">Risk Level</label>
              <select className="input" value={riskLevel} onChange={e => setRiskLevel(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2 flex-wrap">
            <button
              className="btn-primary"
              onClick={() => updateMutation.mutate({ status: 'approved', findings, risk_score: riskScore ? parseFloat(riskScore) : null, risk_level: riskLevel })}
              disabled={updateMutation.isPending}
            >
              <CheckCircle size={15} /> Approve
            </button>
            <button
              className="btn-danger"
              onClick={() => updateMutation.mutate({ status: 'rejected', findings, risk_score: riskScore ? parseFloat(riskScore) : null, risk_level: riskLevel })}
              disabled={updateMutation.isPending}
            >
              <XCircle size={15} /> Reject
            </button>
            <button
              className="btn-secondary"
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}
            >
              <Download size={15} /> {reportMutation.isPending ? 'Generating…' : 'PDF Report'}
            </button>
            <button className="btn-secondary ml-auto" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AuditsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<AuditReview | null>(null)
  const [tab, setTab] = useState<'reviews' | 'trail'>('reviews')

  const { data: reviews, isLoading } = useQuery<AuditReview[]>({
    queryKey: ['audit-reviews'],
    queryFn: () => api.get('/audits/reviews').then(r => r.data),
  })

  const { data: submittedInspections } = useQuery<Inspection[]>({
    queryKey: ['submitted-inspections'],
    queryFn: () => api.get('/inspections?status=submitted').then(r => r.data),
    enabled: user?.role === 'admin' || user?.role === 'auditor',
  })

  const { data: trail } = useQuery({
    queryKey: ['audit-trail'],
    queryFn: () => api.get('/audits/trail').then(r => r.data),
    enabled: tab === 'trail',
  })

  const createReview = useMutation({
    mutationFn: (inspectionId: number) => api.post(`/audits/reviews?inspection_id=${inspectionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-reviews'] })
      qc.invalidateQueries({ queryKey: ['submitted-inspections'] })
      toast.success('Review started')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Audits</h1>

      <div className="flex gap-2">
        <button className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'reviews' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
          onClick={() => setTab('reviews')}>Reviews</button>
        <button className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'trail' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
          onClick={() => setTab('trail')}>Audit Trail</button>
      </div>

      {tab === 'reviews' && (
        <>
          {/* Awaiting review */}
          {(submittedInspections?.length ?? 0) > 0 && (
            <div className="card border-l-4 border-yellow-400">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Awaiting Review ({submittedInspections!.length})</h2>
              <div className="space-y-2">
                {submittedInspections!.map(insp => (
                  <div key={insp.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{insp.clinic_name}</p>
                      <p className="text-xs text-gray-500">Inspector: {insp.inspector_name} · {insp.submitted_at ? new Date(insp.submitted_at).toLocaleDateString() : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {insp.compliance_score != null && <ScoreRing score={insp.compliance_score} size={40} strokeWidth={4} />}
                      <button className="btn-primary py-1.5 text-xs"
                        onClick={() => createReview.mutate(insp.id)}
                        disabled={createReview.isPending}>
                        Start Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Inspection</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Auditor</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Risk</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Reviewed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></td></tr>
                ) : (reviews ?? []).map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">Inspection #{r.inspection_id}</td>
                    <td className="py-3 px-4 text-gray-500">{r.auditor_name}</td>
                    <td className="py-3 px-4">{statusBadge(r.status)}</td>
                    <td className="py-3 px-4">{r.risk_level ? statusBadge(r.risk_level) : '—'}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <button className="p-1.5 hover:bg-brand-50 rounded text-brand-600"
                        onClick={() => setSelected(r)}>
                        <FileText size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && (reviews?.length ?? 0) === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No reviews yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'trail' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Time</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">User</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Action</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Resource</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {(trail ?? []).map((entry: any) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="py-2 px-4 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2 px-4">{entry.user_name}</td>
                  <td className="py-2 px-4 font-mono text-xs text-brand-700">{entry.action}</td>
                  <td className="py-2 px-4 text-gray-500 text-xs">
                    {entry.resource_type} {entry.resource_id ? `#${entry.resource_id}` : ''}
                  </td>
                  <td className="py-2 px-4 text-gray-400 text-xs">{entry.ip_address}</td>
                </tr>
              ))}
              {(trail?.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No audit trail entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ReviewModal review={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
