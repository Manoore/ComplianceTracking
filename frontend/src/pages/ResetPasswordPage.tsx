import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import api, { apiError } from '../services/api'
import { CompliNowMark } from '../components/ui/CompliNowMark'
import toast from 'react-hot-toast'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checks = {
    length: password.length >= 8,
    match: password === confirm && confirm.length > 0,
  }
  const valid = checks.length && checks.match

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      toast.success('Password updated! Please sign in.')
      navigate('/login')
    } catch (err: any) {
      setError(apiError(err, 'Reset failed. The link may have expired.'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid reset link</h2>
          <p className="text-gray-500 text-sm mb-6">This link is missing a token. Request a new one.</p>
          <Link to="/forgot-password" className="btn-primary">Request reset link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <CompliNowMark size={36} />
          <p className="text-brand-800 font-bold text-lg">CompliNow</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Set new password</h2>
            <p className="text-gray-500 mt-1 text-sm">Choose a strong password for your account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} required
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="input pr-10" placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm password</label>
              <input
                type={showPw ? 'text' : 'password'} required
                value={confirm} onChange={e => setConfirm(e.target.value)}
                className="input" placeholder="Repeat password"
                autoComplete="new-password"
              />
            </div>

            {/* Inline requirements */}
            <div className="space-y-1.5 text-xs">
              <div className={`flex items-center gap-2 ${checks.length ? 'text-teal-600' : 'text-gray-400'}`}>
                <CheckCircle size={13} className={checks.length ? 'opacity-100' : 'opacity-30'} />
                At least 8 characters
              </div>
              <div className={`flex items-center gap-2 ${checks.match ? 'text-teal-600' : 'text-gray-400'}`}>
                <CheckCircle size={13} className={checks.match ? 'opacity-100' : 'opacity-30'} />
                Passwords match
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}{' '}
                <Link to="/forgot-password" className="underline font-medium">Request a new link</Link>
              </div>
            )}

            <button type="submit" disabled={loading || !valid}
              className="btn-primary w-full justify-center py-2.5 mt-2">
              {loading ? 'Updating…' : 'Set new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
