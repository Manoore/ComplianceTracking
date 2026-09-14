import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { ClipboardCheck, PenLine, Building2, User, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

interface PendingReview {
  inspection_id: number
  item_id: number
  clinic_id: number
  clinic_name?: string
  template_name?: string
  inspector_name?: string
  submitted_at?: string
}

function ReviewRow({ review }: { review: PendingReview }) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const sign = useMutation({
    mutationFn: () => api.post(`/inspections/${review.inspection_id}/items/${review.item_id}/second-sign`, {
      signature: `signed:${user?.id}:${new Date().toISOString()}`,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-reviews'] })
      toast.success('Review recorded')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        <Link to={`/inspections/${review.inspection_id}`} className="font-medium text-gray-900 hover:text-brand-700 flex items-center gap-1.5">
          <Building2 size={15} className="text-gray-400 flex-shrink-0" />
          {review.clinic_name ?? 'Unknown clinic'}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          {review.template_name && <span>{review.template_name}</span>}
          <span className="flex items-center gap-1"><User size={12} /> {review.inspector_name ?? 'Unknown'}</span>
          {review.submitted_at && (
            <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(review.submitted_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      <button onClick={() => sign.mutate()} disabled={sign.isPending}
        className="btn-primary text-sm flex items-center gap-2 justify-center flex-shrink-0">
        <PenLine size={14} /> {sign.isPending ? 'Signing…' : 'Tap to Sign'}
      </button>
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
          Checklists your MA/PCT team has submitted that are waiting on your sign-off — sign right here, no need to open each one.
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
