import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { Award, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export function TakeCertificationPage() {
  const { token } = useParams<{ token: string }>()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<any>(null)

  const { data: linkData, isLoading, error } = useQuery({
    queryKey: ['cert-link', token],
    queryFn: () => api.get(`/certifications/take/${token}`).then(r => r.data),
    retry: false,
  })

  useEffect(() => {
    if (linkData?.assigned_email) setEmail(linkData.assigned_email)
    if (linkData?.assigned_name) setName(linkData.assigned_name)
  }, [linkData])

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/certifications/take/${token}/submit`, {
      answers,
      participant_name: name,
      participant_email: email,
    }),
    onSuccess: (r) => setResult(r.data),
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Submission failed'),
  })

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <XCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h1 className="text-xl font-bold text-gray-900">Link Not Found</h1>
        <p className="text-gray-500 mt-2">This certification link may be expired or invalid.</p>
      </div>
    </div>
  )

  if (result) {
    const passed = result.status === 'completed'
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          {passed
            ? <CheckCircle className="mx-auto text-green-500 mb-4" size={56} />
            : <XCircle className="mx-auto text-red-500 mb-4" size={56} />
          }
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {passed ? 'Congratulations!' : 'Better Luck Next Time'}
          </h1>
          <p className="text-gray-600 mb-4">
            Score: <strong>{result.score?.toFixed(1)}%</strong>
          </p>
          {passed && (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Your certificate is ready! Valid until {result.expires_at ? new Date(result.expires_at).toLocaleDateString() : 'N/A'}
              </p>
              {result.certificate_path && (
                <a href={result.certificate_path} target="_blank" rel="noopener"
                  className="btn-primary inline-flex mx-auto">
                  <Award size={16} /> Download Certificate
                </a>
              )}
            </>
          )}
          {!passed && result.attempts < 3 && (
            <button className="btn-primary mx-auto" onClick={() => { setResult(null); setAnswers({}) }}>
              Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-50 rounded-2xl mb-4">
              <Award className="text-brand-600" size={28} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{linkData?.course_title}</h1>
            {linkData?.course_description && (
              <p className="text-sm text-gray-500 mt-2">{linkData.course_description}</p>
            )}
            <p className="text-sm text-brand-600 font-medium mt-2">Pass threshold: {linkData?.pass_threshold}%</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Your Name *</label>
              <input required className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Your Email *</label>
              <input required type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <button
              disabled={!name || !email}
              className="btn-primary w-full justify-center py-2.5"
              onClick={() => setStarted(true)}
            >
              Start Certification
            </button>
          </div>
        </div>
      </div>
    )
  }

  const allQuestions = (linkData?.quizzes ?? []).flatMap((q: any) => q.questions)
  const answered = Object.keys(answers).length

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">{linkData?.course_title}</h1>
          <p className="text-sm text-gray-500 mt-1">{answered} of {allQuestions.length} answered</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div className="bg-brand-600 h-2 rounded-full transition-all"
              style={{ width: `${allQuestions.length ? answered / allQuestions.length * 100 : 0}%` }} />
          </div>
        </div>

        {(linkData?.quizzes ?? []).map((quiz: any) => (
          <div key={quiz.id} className="space-y-4 mb-8">
            <h2 className="text-base font-semibold text-gray-800 pb-2 border-b border-gray-200">{quiz.title}</h2>
            {quiz.questions.map((q: any, i: number) => (
              <div key={q.id} className="card">
                <p className="font-medium text-gray-900 mb-3">{i + 1}. {q.question_text}</p>
                <div className="space-y-2">
                  {q.options.map((opt: any) => (
                    <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-brand-50 hover:border-brand-300 transition-colors has-[:checked]:bg-brand-50 has-[:checked]:border-brand-500">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt.id}
                        checked={answers[q.id] === String(opt.id)}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: String(opt.id) }))}
                        className="accent-brand-600"
                      />
                      <span className="text-sm text-gray-700">{opt.option_text}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="flex justify-center pb-8">
          <button
            disabled={answered < allQuestions.length || submitMutation.isPending}
            className="btn-primary px-8 py-3"
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? 'Submitting…' : `Submit (${answered}/${allQuestions.length} answered)`}
          </button>
        </div>
      </div>
    </div>
  )
}
