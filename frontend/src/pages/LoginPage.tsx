import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  ClipboardList, Building2, CheckSquare,
  AlertTriangle, BarChart2, Bell, Users, ArrowRight, ArrowLeft, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiError } from '../services/api'
import { CompliNowMark } from '../components/ui/CompliNowMark'

const FEATURES = [
  { icon: Building2, title: 'Clinic Registry', desc: 'Manage all clinic locations with profiles, staff assignments, and compliance history.' },
  { icon: ClipboardList, title: 'Smart Inspections', desc: 'Conduct inspections with customizable checklists, GPS tagging, and photo capture.' },
  { icon: ShieldCheck, title: 'Auditor Workflow', desc: 'Review, approve or reject submissions with full corrective action tracking.' },
  { icon: CheckSquare, title: 'Certifications', desc: 'Assign certifications with shareable links, expiry alerts, and QR verification.' },
  { icon: AlertTriangle, title: 'Corrective Actions', desc: 'Track action items from critical findings through to resolution and sign-off.' },
  { icon: BarChart2, title: 'Reports & Analytics', desc: 'Risk breakdown charts, compliance trends, and one-click Excel/CSV exports.' },
  { icon: Bell, title: 'Notifications', desc: 'Real-time alerts for upcoming due dates, overdue actions, and announcements.' },
  { icon: Users, title: 'Role-Based Access', desc: 'Admins, managers, auditors, and team members each see exactly what they need.' },
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      toast.error(apiError(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left — hero + features */}
      <div className="lg:flex-1 bg-gradient-to-br from-brand-800 via-brand-800 to-brand-900 flex flex-col p-8 lg:p-12 xl:p-16">
        {/* Logo + back link */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <CompliNowMark size={40} />
            <div>
              <p className="text-white font-bold text-lg leading-none">CompliNow</p>
              <p className="text-brand-300 text-xs">Audit anything, anywhere</p>
            </div>
          </div>
          <Link
            to="/home"
            className="flex items-center gap-1.5 text-white text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-1.5 rounded-full backdrop-blur transition-colors"
          >
            <ArrowLeft size={13} /> Back to home
          </Link>
        </div>

        {/* Headline */}
        <div className="mb-10">
          <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
            Audit anything,<br />
            <span className="text-brand-300">anywhere.</span>
          </h1>
          <p className="text-brand-200 text-base leading-relaxed max-w-md">
            A compliance platform for any industry — restaurants, construction, healthcare, hospitality.
            Inspect, certify, track, and report — all in one place.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={15} className="text-brand-200" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{title}</p>
                <p className="text-brand-300 text-xs mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-auto pt-10 text-brand-400 text-xs">
          Self-hosted · Docker-ready · Any industry
        </p>
      </div>

      {/* Right — login form */}
      <div className="lg:w-[420px] xl:w-[480px] flex items-center justify-center p-8 lg:p-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your organization's account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input" placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input" placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-base"
            >
              {loading ? 'Signing in…' : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-2">Default admin credentials</p>
            <p className="text-xs text-gray-600 font-mono">admin@compliance.local</p>
            <p className="text-xs text-gray-600 font-mono">admin123</p>
          </div>

          <p className="mt-6 text-sm text-gray-500 text-center">
            New organization?{' '}
            <Link to="/register" className="text-teal-500 font-medium hover:underline">
              Start a free trial
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <Link to="/superadmin/login" className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
              Platform Console
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
