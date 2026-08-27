import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ShieldAlert, ArrowRight, Lock, Building2,
  Users, BarChart2, Globe, Activity, CheckCircle,
} from 'lucide-react'
import axios from 'axios'
import { CompliNowMark } from '../components/ui/CompliNowMark'

const BASE = (import.meta as any).env?.VITE_API_URL ?? '/api'

const CAPABILITIES = [
  { icon: Building2, label: 'Tenant Management', desc: 'Create, suspend, and configure organizations across the platform.' },
  { icon: Users, label: 'User Oversight', desc: 'View all users, roles, and activity across every tenant.' },
  { icon: BarChart2, label: 'Platform Analytics', desc: 'Inspections, audits, certifications, and corrective actions — all tenants.' },
  { icon: Globe, label: 'Plan Control', desc: 'Upgrade, downgrade, or suspend any organization\'s subscription.' },
]

export function SuperAdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.post(`${BASE}/superadmin/login`, { email, password })
      localStorage.setItem('sa_access_token', data.access_token)
      navigate('/superadmin/dashboard')
    } catch (err: any) {
      setError(err?.response?.status === 401 ? 'Invalid credentials. Access denied.' : 'Login failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#060D1A' }}>

      {/* ── LEFT PANEL ── */}
      <div className="lg:flex-1 relative flex flex-col p-8 lg:p-12 xl:p-16 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(#00C4A0 1px,transparent 1px),linear-gradient(90deg,#00C4A0 1px,transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        {/* Glow */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,196,160,0.08) 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 mb-16">
          <Link to="/home">
            <CompliNowMark size={38} />
          </Link>
          <div>
            <p className="text-white font-bold text-base leading-none">CompliNow</p>
            <p className="text-xs font-mono tracking-widest uppercase mt-0.5" style={{ color: '#00C4A0' }}>
              Platform Console
            </p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-5"
            style={{ borderColor: 'rgba(0,196,160,0.25)', background: 'rgba(0,196,160,0.07)' }}>
            <Activity size={12} style={{ color: '#00C4A0' }} />
            <span className="text-xs font-mono tracking-wider" style={{ color: '#00C4A0' }}>OPERATOR ACCESS</span>
          </div>
          <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
            CompliNow<br />
            <span style={{ color: '#00C4A0' }}>Platform Console</span>
          </h1>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: '#4A6EA8' }}>
            Centralized control for platform operators. Manage tenants, monitor usage, and oversee compliance activity across every organization.
          </p>
        </div>

        {/* Capabilities */}
        <div className="relative z-10 space-y-4 flex-1">
          {CAPABILITIES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(0,196,160,0.1)', border: '1px solid rgba(0,196,160,0.15)' }}>
                <Icon size={16} style={{ color: '#00C4A0' }} />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: '#4A6EA8' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="relative z-10 mt-12 text-xs" style={{ color: '#2E4472' }}>
          All access is logged and monitored. Unauthorized access is prohibited.
        </p>
      </div>

      {/* ── RIGHT PANEL — LOGIN ── */}
      <div className="lg:w-[420px] xl:w-[460px] flex items-center justify-center p-8 lg:p-12 relative"
        style={{ background: 'rgba(255,255,255,0.025)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>

        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <ShieldAlert size={17} className="text-amber-400" />
              </div>
              <span className="text-amber-400 text-sm font-semibold">Restricted Access</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Sign in</h2>
            <p className="text-sm mt-1" style={{ color: '#4A6EA8' }}>
              Platform operators only. Credentials are stored as environment variables.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Admin Email
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                placeholder="superadmin@complinow.app"
                autoComplete="email"
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,196,160,0.5)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Password
              </label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,196,160,0.5)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Lock size={13} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 mt-2"
              style={{ background: '#00C4A0', color: '#07142A' }}
            >
              {loading ? 'Authenticating…' : <><span>Enter Platform Console</span><ArrowRight size={15} /></>}
            </button>
          </form>

          {/* Access note */}
          <div className="mt-8 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={13} style={{ color: '#00C4A0' }} />
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>What you can do here</span>
            </div>
            <ul className="space-y-1.5">
              {['View all organizations and their stats', 'Change subscription plans', 'Suspend or reactivate tenants'].map(item => (
                <li key={item} className="text-xs flex items-start gap-2" style={{ color: '#4A6EA8' }}>
                  <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#00C4A0' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: '#2E4472' }}>
            Not a platform operator?{' '}
            <Link to="/login" className="hover:text-white transition-colors" style={{ color: '#4A6EA8' }}>
              Go to workspace login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
