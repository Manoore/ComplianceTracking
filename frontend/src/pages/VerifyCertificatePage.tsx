import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { CheckCircle, XCircle } from 'lucide-react'

export function VerifyCertificatePage() {
  const { certId } = useParams<{ certId: string }>()
  const { data, isLoading, error } = useQuery({
    queryKey: ['verify-cert', certId],
    queryFn: () => api.get(`/certifications/verify/${certId}`).then(r => r.data),
    retry: false,
  })

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {error || !data ? (
          <>
            <XCircle className="mx-auto text-red-500 mb-4" size={56} />
            <h1 className="text-xl font-bold text-gray-900">Certificate Not Valid</h1>
            <p className="text-gray-500 mt-2">This certificate could not be verified.</p>
          </>
        ) : (
          <>
            <CheckCircle className="mx-auto text-green-500 mb-4" size={56} />
            <h1 className="text-xl font-bold text-gray-900">Certificate Verified</h1>
            <div className="mt-4 text-left bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{data.participant_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Course</span><span className="font-medium">{data.course_title}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Score</span><span className="font-medium">{data.score?.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Completed</span><span className="font-medium">{data.completed_at ? new Date(data.completed_at).toLocaleDateString() : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Valid Until</span><span className="font-medium">{data.expires_at ? new Date(data.expires_at).toLocaleDateString() : 'N/A'}</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
