import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api, { apiError } from '../services/api'
import type { AuditReview, Inspection } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge } from '../components/ui/Badge'
import { ScoreRing } from '../components/ui/ScoreRing'
import { FileText, CheckCircle, XCircle, Download, Trash2 } from 'lucide-react'
import { useConfirm } from '../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

// Turns a raw audit-log entry (dotted action code + resource_type/id + details)
// into one plain-language sentence a non-technical person can read at a glance.
// The raw action code is still available on hover (title attribute) for anyone
// who does want the technical form.
interface TrailEntry {
  id: number
  user_name: string
  action: string
  resource_type?: string | null
  resource_id?: number | null
  details?: Record<string, any> | null
  ip_address?: string | null
  timestamp: string
}

const RESOURCE_LABELS: Record<string, string> = {
  checklist_template: 'checklist template',
  audit_review: 'audit review',
  corrective_action: 'corrective action',
  inspection: 'inspection',
  clinic: 'clinic',
  course: 'training course',
  user: 'user account',
  announcement: 'announcement',
}

const idSuffix = (e: TrailEntry) => (e.resource_id ? ` (#${e.resource_id})` : '')
const humanize = (s: string) => s.replace(/[._]/g, ' ')

const ACTION_DESCRIPTIONS: Record<string, (e: TrailEntry) => string> = {
  'user.login': () => 'Logged in',
  'user.login_firebase': () => 'Logged in from the mobile app',
  'user.logout': () => 'Logged out',
  'user.create': (e) => `Created a new user account${idSuffix(e)}`,
  'user.update': (e) => `Updated a user account${idSuffix(e)}`,
  'user.deactivate': (e) => `Deactivated a user account${idSuffix(e)}`,
  'user.delete_account': () => 'Deleted their own account',
  'user.change_password': () => 'Changed their password',
  'user.forgot_password': () => 'Requested a password reset',
  'user.password_reset': () => 'Reset their password',
  'checklist.create': (e) => `Created a checklist template${idSuffix(e)}`,
  'checklist.clone': (e) => `Cloned a checklist template${idSuffix(e)}${e.details?.cloned_from ? ` from template #${e.details.cloned_from}` : ''}`,
  'checklist.delete': (e) => `Deleted the checklist template "${e.details?.name ?? `#${e.resource_id}`}"`,
  'checklist.deploy_preset': (e) => `Added a reference checklist as a new template${idSuffix(e)}${e.details?.category ? ` (${e.details.category})` : ''}`,
  'inspection.create': (e) => `Started a new inspection${idSuffix(e)}`,
  'inspection.submit': (e) => `Submitted an inspection${idSuffix(e)}${e.details?.score != null ? ` — score ${e.details.score}%` : ''}${e.details?.risk ? `, risk: ${e.details.risk}` : ''}`,
  'inspection.delete': (e) => `Deleted an inspection${e.details?.clinic ? ` at ${e.details.clinic}` : idSuffix(e)}`,
  'clinic.create': (e) => `Added a new clinic${idSuffix(e)}`,
  'clinic.update': (e) => `Updated a clinic's details${idSuffix(e)}`,
  'clinic.deactivate': (e) => `Deactivated a clinic${idSuffix(e)}`,
  'clinic.delete': (e) => `Deleted the clinic "${e.details?.name ?? `#${e.resource_id}`}"`,
  'clinic.bulk_import': (e) => `Imported clinics from a file (${e.details?.created ?? 0} added${e.details?.errors ? `, ${e.details.errors} had errors` : ''})`,
  'corrective_action.create_manual': (e) => `Created a corrective action${idSuffix(e)}`,
  'corrective_action.update': (e) => `Updated a corrective action${idSuffix(e)}`,
  'corrective_action.verify': (e) => `Verified a corrective action${idSuffix(e)}`,
  'corrective_action.delete': (e) => `Deleted the corrective action "${e.details?.title ?? `#${e.resource_id}`}"`,
  'course.create': (e) => `Created a training course${idSuffix(e)}`,
  'course.update': (e) => `Updated a training course${idSuffix(e)}`,
  'course.delete': (e) => `Deleted a training course${idSuffix(e)}`,
  'announcement.create': (e) => `Posted an announcement${idSuffix(e)}`,
  'audit.review.create': (e) => `Started an audit review${idSuffix(e)}`,
  'audit.review.delete': (e) => `Cancelled an audit review${idSuffix(e)}`,
  'audit.report.generate': (e) => `Generated a PDF report for an audit review${idSuffix(e)}`,
}

function describeEntry(e: TrailEntry): string {
  const known = ACTION_DESCRIPTIONS[e.action]
  if (known) return known(e)
  // Any other audit.review.<status> (pending/in_review/approved/rejected/escalated)
  // set via the review's status field, rather than a dedicated action above.
  if (e.action.startsWith('audit.review.')) {
    const status = humanize(e.action.replace('audit.review.', ''))
    return `Marked an audit review as ${status}${idSuffix(e)}`
  }
  // Fallback for any action code not covered above: still plain language, just
  // built generically from the code and resource type instead of a fixed phrase.
  const verb = humanize(e.action)
  const resource = e.resource_type ? (RESOURCE_LABELS[e.resource_type] ?? humanize(e.resource_type)) : ''
  const sentence = `${verb}${resource ? ` — ${resource}` : ''}${idSuffix(e)}`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

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
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirmDialog = useConfirm()
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

  const deleteReview = useMutation({
    mutationFn: (id: number) => api.delete(`/audits/reviews/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-reviews'] })
      qc.invalidateQueries({ queryKey: ['submitted-inspections'] })
      toast.success('Review cancelled')
    },
    onError: (e: any) => toast.error(apiError(e, 'Could not cancel review')),
  })

  const handleDeleteReview = async (r: AuditReview) => {
    if (await confirmDialog('Cancel this review? The inspection will go back to "submitted", awaiting review.')) {
      deleteReview.mutate(r.id)
    }
  }

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
                    <button className="text-left" onClick={() => navigate(`/inspections/${insp.id}`)}>
                      <p className="text-sm font-medium text-brand-700 hover:underline">{insp.clinic_name}</p>
                      <p className="text-xs text-gray-500">Inspector: {insp.inspector_name} · {insp.submitted_at ? new Date(insp.submitted_at).toLocaleDateString() : ''}</p>
                    </button>
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
                    <td className="py-3 px-4">
                      <button className="text-brand-700 hover:underline" onClick={() => navigate(`/inspections/${r.inspection_id}`)}>
                        Inspection #{r.inspection_id}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{r.auditor_name}</td>
                    <td className="py-3 px-4">{statusBadge(r.status)}</td>
                    <td className="py-3 px-4">{r.risk_level ? statusBadge(r.risk_level) : '—'}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-brand-50 rounded text-brand-600"
                          onClick={() => setSelected(r)}>
                          <FileText size={16} />
                        </button>
                        {r.status === 'pending' && (
                          <button className="p-1.5 hover:bg-red-50 rounded text-red-500"
                            title="Cancel review"
                            onClick={() => handleDeleteReview(r)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
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
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Who</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">What happened</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {(trail ?? []).map((entry: TrailEntry) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="py-2.5 px-4 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-gray-900">{entry.user_name}</td>
                  <td className="py-2.5 px-4 text-gray-700" title={entry.action}>
                    {describeEntry(entry)}
                  </td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">{entry.ip_address || '—'}</td>
                </tr>
              ))}
              {(trail?.length ?? 0) === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">No audit trail entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ReviewModal review={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
