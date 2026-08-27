import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import api, { apiError } from '../services/api'
import { CompliNowMark } from '../components/ui/CompliNowMark'
import { firebaseEnabled, sendFirebasePasswordReset } from '../services/firebase'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (firebaseEnabled) {
        await sendFirebasePasswordReset(email)
      } else {
        await api.post('/auth/forgot-password', { email })
      }
      setSent(true)
    } catch (err: any) {
      setError(apiError(err, 'Something went wrong. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <CompliNowMark size={36} />
          <p className="text-brand-800 font-bold text-lg">CompliNow</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-teal-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Check your inbox</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                If <strong>{email}</strong> is linked to an account, you'll receive a reset link within a few minutes.
              </p>
              <p className="text-xs text-gray-400">Didn't receive it? Check your spam folder.</p>
              <Link to="/login" className="btn-primary w-full justify-center mt-4 inline-flex">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Forgot password?</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input pl-9" placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-600 text-sm">{error}</p>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <Link to="/login" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mt-6 justify-center transition-colors">
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
