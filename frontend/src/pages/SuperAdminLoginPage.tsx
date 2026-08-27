import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowRight, Lock } from 'lucide-react'
import axios from 'axios'
import { CompliNowMark } from '../components/ui/CompliNowMark'

const BASE = (import.meta as any).env?.VITE_API_URL ?? '/api'

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
      setError(err?.response?.status === 401 ? 'Invalid super-admin credentials.' : 'Login failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#060D1A] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#00C4A0 1px,transparent 1px),linear-gradient(90deg,#00C4A0 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <CompliNowMark size={36} />
          <div>
            <p className="text-white font-bold text-base leading-none tracking-wide">CompliNow</p>
            <p className="text-teal-400 text-[11px] font-mono tracking-widest uppercase mt-0.5">Platform Admin</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert size={18} className="text-amber-400" />
            <p className="text-white font-semibold text-lg">Restricted Access</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                Admin Email
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-400/60 focus:ring-1 focus:ring-teal-400/30 transition"
                placeholder="superadmin@complinow.app"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-400/60 focus:ring-1 focus:ring-teal-400/30 transition"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <Lock size={13} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-teal-400 hover:bg-teal-300 text-[#07142A] font-semibold text-sm py-2.5 rounded-lg transition-colors mt-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating…' : <><span>Enter Platform Console</span><ArrowRight size={15} /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          This portal is for CompliNow platform operators only.<br />
          All access is logged and monitored.
        </p>
      </div>
    </div>
  )
}
