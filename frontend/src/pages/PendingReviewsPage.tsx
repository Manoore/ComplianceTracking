import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { ClipboardCheck, PenLine, Building2, User, Calendar, AlertTriangle, Flag, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

interface PendingReview {
  inspection_id: number
  item_id: number
  clinic_id: number
  clinic_name?: string
  template_name?: string
  inspector_name?: string
  submitted_at?: string
  is_priority?: boolean
  priority_note?: string | null
}

function ReviewRow({ review }: { review: PendingReview }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [reviewNotes, setReviewNotes] = useState('')
  const [flagged, setFlagged] = useState(false)

  const sign = useMutation({
    mutationFn: () => api.post(`/inspections/${review.inspection_id}/items/${review.item_id}/second-sign`, {
      signature: `signed:${user?.id}:${new Date().toISOString()}`,
      notes: reviewNotes || null,
      flagged,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-reviews'] })
      toast.success(flagged ? 'Review recorded and flagged for your Regional Manager' : 'Review recorded')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <div className={clsx('card p-4 space-y-3', review.is_priority && 'border-amber-400 border-2')}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          {review.is_priority && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
              <AlertTriangle size={13} /> Priority{review.priority_note ? ` — ${review.priority_note}` : ''}
            </div>
          )}
          <div className="font-medium text-gray-900 flex items-center gap-1.5">
            <Building2 size={15} className="text-gray-400 flex-shrink-0" />
            {review.clinic_name ?? 'Unknown clinic'}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {review.template_name && <span>{review.template_name}</span>}
            <span className="flex items-center gap-1"><User size={12} /> {review.inspector_name ?? 'Unknown'}</span>
            {review.submitted_at && (
              <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(review.submitted_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        {/* Opens in a new tab so reviewing the full checklist doesn't lose the notes/flag
            you may have already started typing below for this row. */}
        <Link to={`/inspections/${review.inspection_id}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-brand-700 hover:underline flex-shrink-0 whitespace-nowrap">
          <ExternalLink size={14} /> View Checklist
        </Link>
      </div>

      <input className="input text-sm w-full" placeholder="Review notes (optional)"
        value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
          <Flag size={14} className={flagged ? 'text-red-600' : 'text-gray-400'} />
          Flag for Regional Manager
        </label>
        <button onClick={() => sign.mutate()} disabled={sign.isPending}
          className={clsx('text-sm flex items-center gap-2 justify-center flex-shrink-0', flagged ? 'btn-danger' : 'btn-primary')}>
          <PenLine size={14} /> {sign.isPending ? 'Submitting…' : flagged ? 'Submit & Flag' : 'Submit Review'}
        </button>
      </div>
    </div>
  )
}

export function PendingReviewsPage() {
  const { data, isLoading } = useQuery<PendingReview[]>({
    queryKey: ['pending-reviews'],
    queryFn: () => api.get('/inspections/pending-review').then(r => r.data),
  })

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck className="text-brand-700" size={22} /> Pending Reviews
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Checklists your MA/PCT team has submitted that are waiting on your review — review and submit right here, no need to open each one. Priority checklists are pinned to the top.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <ClipboardCheck size={28} className="mx-auto mb-2 text-gray-300" />
          Nothing waiting on your review right now.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(r => <ReviewRow key={`${r.inspection_id}-${r.item_id}`} review={r} />)}
        </div>
      )}
    </div>
  )
}
