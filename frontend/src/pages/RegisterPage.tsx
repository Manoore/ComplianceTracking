import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { apiError } from '../services/api'
import { CompliNowMark } from '../components/ui/CompliNowMark'
import { firebaseEnabled, createFirebaseUser } from '../services/firebase'

const PERKS = [
  '14-day free trial — no credit card required',
  'Any industry: food, construction, healthcare, hospitality',
  'Unlimited inspections, audits, and certifications',
  'Cancel anytime',
]

export function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ org_name: '', full_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    let fbUser: any = null
    try {
      if (firebaseEnabled) {
        const cred = await createFirebaseUser(form.email, form.password)
        fbUser = cred.user
      }
      const { data } = await api.post('/auth/register', form)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      toast.success(`Welcome to CompliNow, ${data.user.full_name}!`)
      navigate('/')
      window.location.reload()
    } catch (err: any) {
      if (fbUser) await fbUser.delete().catch(() => {})  // rollback Firebase user on failure
      const msg = err?.response?.status === 409
        ? 'An account with this email already exists.'
        : apiError(err, 'Registration failed. Please try again.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="lg:flex-1 bg-brand-900 flex flex-col p-8 lg:p-12 xl:p-16">
        <div className="flex items-center gap-3 mb-12">
          <CompliNowMark size={40} />
          <div>
            <p className="text-white font-bold text-lg leading-none">CompliNow</p>
            <p className="text-brand-300 text-xs">Audit anything, anywhere</p>
          </div>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
            Start your<br />
            <span className="text-teal-400">free trial.</span>
          </h1>
          <p className="text-brand-200 text-base leading-relaxed max-w-md">
            Set up your organization in under 2 minutes. No credit card, no commitment.
          </p>
        </div>

        <ul className="space-y-4">
          {PERKS.map(p => (
            <li key={p} className="flex items-start gap-3">
              <CheckCircle className="text-teal-400 flex-shrink-0 mt-0.5" size={18} />
              <span className="text-brand-200 text-sm">{p}</span>
            </li>
          ))}
        </ul>

        <p className="mt-auto pt-10 text-brand-400 text-xs">
          Already using CompliNow?{' '}
          <Link to="/login" className="text-teal-400 hover:underline">Sign in</Link>
        </p>
      </div>

      {/* Right panel — form */}
      <div className="lg:w-[440px] xl:w-[500px] flex items-center justify-center p-8 lg:p-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-gray-500 mt-1 text-sm">One account = one organization</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Organization name</label>
              <input className="input" required value={form.org_name}
                onChange={set('org_name')} placeholder="Acme Restaurant Group" />
            </div>
            <div>
              <label className="label">Your full name</label>
              <input className="input" required value={form.full_name}
                onChange={set('full_name')} placeholder="Alex Johnson" />
            </div>
            <div>
              <label className="label">Work email</label>
              <input className="input" type="email" required value={form.email}
                onChange={set('email')} placeholder="alex@acme.com" autoComplete="email" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={8} value={form.password}
                onChange={set('password')} placeholder="At least 8 characters" autoComplete="new-password" />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-base mt-2">
              {loading ? 'Creating account…' : <><span>Create account</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-500 font-medium hover:underline">Sign in</Link>
          </p>

          <p className="mt-4 text-xs text-gray-400 text-center leading-relaxed">
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
