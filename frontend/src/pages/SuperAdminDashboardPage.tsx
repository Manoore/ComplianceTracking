import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { saApi, saApiError } from '../services/saApi'
import { CompliNowMark } from '../components/ui/CompliNowMark'
import {
  Building2, Users, ClipboardList, ShieldOff, LogOut, ChevronDown,
  CheckCircle, XCircle, RefreshCw, Shield, CreditCard, Zap, Star,
  Rocket, Crown, ArrowRight, Plus, X, BarChart2, TrendingUp, DollarSign,
  Pencil, Save,
} from 'lucide-react'
import toast from 'react-hot-toast'

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise']

const PLAN_ICONS: Record<string, any> = { free: Zap, starter: Star, pro: Rocket, enterprise: Crown }
const PLAN_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  free:       { text: '#9CA3AF', border: '#4B5563', bg: 'rgba(156,163,175,0.07)' },
  starter:    { text: '#60A5FA', border: '#2563EB', bg: 'rgba(59,130,246,0.07)' },
  pro:        { text: '#00C4A0', border: '#00C4A0', bg: 'rgba(0,196,160,0.07)' },
  enterprise: { text: '#FBBF24', border: '#D97706', bg: 'rgba(245,158,11,0.07)' },
}

interface Tenant {
  id: number; name: string; slug: string; plan: string;
  is_active: boolean; trial_ends_at: string | null;
  created_at: string | null; user_count: number;
  inspection_count: number; open_actions: number;
}
interface Stats {
  total_tenants: number; active_tenants: number; suspended_tenants: number;
  total_users: number; total_inspections: number; total_certifications: number;
}
interface PlanConfig {
  label: string; price_monthly: number; price_annual: number;
  max_locations: number; max_users: number; features: string[];
}
interface Analytics {
  signups_by_month: { month: string; count: number }[];
  inspections_by_month: { month: string; count: number }[];
  plan_distribution: { plan: string; count: number }[];
  mrr: number; open_actions: number; total_courses: number; total_certifications: number;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,196,160,0.1)' }}>
          <Icon size={16} style={{ color: '#00C4A0' }} />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      </div>
      <p className="text-white text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] ?? PLAN_COLORS.free
  const label = plan.charAt(0).toUpperCase() + plan.slice(1)
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
      style={{ color: c.text, borderColor: c.border, background: c.bg }}>{label}</span>
  )
}

function MiniBarChart({ data, color = '#00C4A0' }: { data: { month: string; count: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map(d => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-sm transition-all" style={{ height: `${Math.max((d.count / max) * 52, 2)}px`, background: color, opacity: 0.8 }} />
          <span className="text-[9px] truncate w-full text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {d.month.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  )
}

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ org_name: '', admin_email: '', admin_password: '', plan: 'free', trial_days: 14 })
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await saApi.post('/tenants', form)
      toast.success(`Organization "${form.org_name}" created`)
      onCreated()
      onClose()
    } catch (err: any) {
      toast.error(saApiError(err) || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none transition"
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#0E1829', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">Create Organization</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Organization Name</label>
            <input className={inputCls} style={inputStyle} required value={form.org_name} onChange={set('org_name')} placeholder="Acme Corp" />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Admin Email</label>
            <input className={inputCls} style={inputStyle} type="email" required value={form.admin_email} onChange={set('admin_email')} placeholder="admin@acme.com" />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Admin Password</label>
            <input className={inputCls} style={inputStyle} type="password" required minLength={8} value={form.admin_password} onChange={set('admin_password')} placeholder="Min 8 characters" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Plan</label>
              <select className={inputCls} style={inputStyle} value={form.plan} onChange={set('plan')}>
                {PLAN_ORDER.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Trial Days</label>
              <input className={inputCls} style={inputStyle} type="number" min={0} max={365} value={form.trial_days}
                onChange={e => setForm(f => ({ ...f, trial_days: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: '#00C4A0', color: '#07142A' }}>
              {loading ? 'Creating…' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

type Tab = 'orgs' | 'analytics' | 'plans'

export function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [openPlanMenu, setOpenPlanMenu] = useState<number | null>(null)
  const [planMenuPos, setPlanMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [tab, setTab] = useState<Tab>('orgs')
  const [planFilter, setPlanFilter] = useState<string | null>(null)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [planDraft, setPlanDraft] = useState<PlanConfig | null>(null)

  const { data: stats } = useQuery<Stats>({ queryKey: ['sa-stats'], queryFn: () => saApi.get('/stats').then(r => r.data) })
  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({ queryKey: ['sa-tenants'], queryFn: () => saApi.get('/tenants').then(r => r.data) })
  const { data: analytics } = useQuery<Analytics>({ queryKey: ['sa-analytics'], queryFn: () => saApi.get('/analytics').then(r => r.data), enabled: tab === 'analytics' })
  const { data: planConfigs = {} } = useQuery<Record<string, PlanConfig>>({ queryKey: ['sa-plans'], queryFn: () => saApi.get('/plans').then(r => r.data) })

  const updateTenant = useMutation({
    mutationFn: ({ id, ...p }: { id: number; is_active?: boolean; plan?: string }) => saApi.put(`/tenants/${id}`, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-tenants'] }); qc.invalidateQueries({ queryKey: ['sa-stats'] }); setOpenPlanMenu(null); toast.success('Updated') },
    onError: (e: any) => toast.error(saApiError(e)),
  })

  const savePlans = useMutation({
    mutationFn: (configs: Record<string, PlanConfig>) => saApi.put('/plans', { configs }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-plans'] }); setEditingPlan(null); toast.success('Plan saved') },
    onError: (e: any) => toast.error(saApiError(e)),
  })

  const handleLogout = () => { localStorage.removeItem('sa_access_token'); navigate('/superadmin/login') }

  const handlePlanButtonClick = (e: React.MouseEvent, tenantId: number) => {
    if (openPlanMenu === tenantId) { setOpenPlanMenu(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPlanMenuPos({ top: rect.bottom + 6, left: rect.left })
    setOpenPlanMenu(tenantId)
  }

  const startEdit = (plan: string) => {
    const base = planConfigs[plan] ?? { label: plan, price_monthly: 0, price_annual: 0, max_locations: 0, max_users: 0, features: [] }
    setPlanDraft({ ...base, features: [...(base.features ?? [])] })
    setEditingPlan(plan)
  }

  const saveEdit = () => {
    if (!editingPlan || !planDraft) return
    const cleaned = { ...planDraft, features: planDraft.features.filter(f => f.trim() !== '') }
    const updated = { ...planConfigs, [editingPlan]: cleaned }
    savePlans.mutate(updated)
  }

  const planCounts = PLAN_ORDER.reduce((acc, p) => { acc[p] = tenants.filter(t => t.plan === p).length; return acc }, {} as Record<string, number>)

  const filtered = tenants.filter(t => {
    const s = t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
    return s && (planFilter ? t.plan === planFilter : true)
  })

  const TABS: [Tab, string][] = [['orgs', 'Organizations'], ['analytics', 'Analytics'], ['plans', 'Plans & Pricing']]

  return (
    <div className="min-h-screen text-white" style={{ background: '#060D1A' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,13,26,0.95)' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <CompliNowMark size={28} />
            <div>
              <span className="text-white font-semibold text-sm">CompliNow</span>
              <span className="text-xs font-mono ml-2 uppercase tracking-widest" style={{ color: '#00C4A0' }}>Platform Console</span>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {TABS.map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-1.5 rounded-md text-xs font-medium transition-all"
                style={tab === t ? { background: 'rgba(0,196,160,0.15)', color: '#00C4A0', border: '1px solid rgba(0,196,160,0.25)' } : { color: 'rgba(255,255,255,0.4)' }}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <Shield size={13} style={{ color: '#00C4A0' }} /><span>Super Admin</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs transition-colors hover:text-red-400" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── ORGANIZATIONS ── */}
        {tab === 'orgs' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Organizations</h1>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Manage all tenants across the platform</p>
              </div>
              <button onClick={() => setShowCreateOrg(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                style={{ background: '#00C4A0', color: '#07142A' }}>
                <Plus size={16} /> New Organization
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={Building2} label="Total Orgs" value={stats?.total_tenants ?? '—'} />
              <StatCard icon={CheckCircle} label="Active" value={stats?.active_tenants ?? '—'} />
              <StatCard icon={ShieldOff} label="Suspended" value={stats?.suspended_tenants ?? '—'} />
              <StatCard icon={Users} label="Total Users" value={stats?.total_users ?? '—'} />
              <StatCard icon={ClipboardList} label="Inspections" value={stats?.total_inspections ?? '—'} />
              <StatCard icon={RefreshCw} label="Certifications" value={stats?.total_certifications ?? '—'} />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Filter:</span>
              <button onClick={() => setPlanFilter(null)} className="text-xs px-3 py-1 rounded-full transition-all"
                style={!planFilter ? { background: 'rgba(0,196,160,0.15)', color: '#00C4A0', border: '1px solid rgba(0,196,160,0.3)' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                All ({tenants.length})
              </button>
              {PLAN_ORDER.map(p => {
                const c = PLAN_COLORS[p]
                return (
                  <button key={p} onClick={() => setPlanFilter(planFilter === p ? null : p)} className="text-xs px-3 py-1 rounded-full transition-all capitalize"
                    style={planFilter === p ? { background: c.bg, color: c.text, border: `1px solid ${c.border}` } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {p} ({planCounts[p] ?? 0})
                  </button>
                )
              })}
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-white font-semibold text-sm">All Organizations</h2>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or slug…"
                  className="text-white text-sm placeholder-white/20 focus:outline-none w-56 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              {isLoading ? <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#00C4A0' }} /></div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {['Organization', 'Plan', 'Users', 'Inspections', 'Open Actions', 'Trial Ends', 'Joined', 'Status', 'Actions'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(t => (
                        <tr key={t.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="px-5 py-4">
                            <p className="text-white font-medium">{t.name}</p>
                            <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>{t.slug}</p>
                          </td>
                          <td className="px-5 py-4">
                            <button className="flex items-center gap-1" onClick={e => handlePlanButtonClick(e, t.id)}>
                              <PlanBadge plan={t.plan} />
                              <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                            </button>
                          </td>
                          <td className="px-5 py-4 tabular-nums" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.user_count}</td>
                          <td className="px-5 py-4 tabular-nums" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.inspection_count}</td>
                          <td className="px-5 py-4 tabular-nums"><span style={{ color: t.open_actions > 0 ? '#F59E0B' : 'rgba(255,255,255,0.25)' }}>{t.open_actions}</span></td>
                          <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : '—'}</td>
                          <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                          <td className="px-5 py-4">
                            {t.is_active
                              ? <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#00C4A0' }}><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00C4A0' }} />Active</span>
                              : <span className="flex items-center gap-1.5 text-xs font-medium text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Suspended</span>}
                          </td>
                          <td className="px-5 py-4">
                            {t.is_active
                              ? <button onClick={() => updateTenant.mutate({ id: t.id, is_active: false })} disabled={updateTenant.isPending} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg" style={{ border: '1px solid rgba(239,68,68,0.2)' }}><XCircle size={12} /> Suspend</button>
                              : <button onClick={() => updateTenant.mutate({ id: t.id, is_active: true })} disabled={updateTenant.isPending} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg" style={{ color: '#00C4A0', border: '1px solid rgba(0,196,160,0.2)' }}><CheckCircle size={12} /> Activate</button>}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={9} className="px-5 py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>No organizations found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Aggregated usage across all organizations</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="Monthly MRR" value={analytics ? `$${analytics.mrr.toLocaleString()}` : '—'} sub="from active paid plans" />
              <StatCard icon={Building2} label="Total Orgs" value={stats?.total_tenants ?? '—'} />
              <StatCard icon={BarChart2} label="Total Inspections" value={stats?.total_inspections ?? '—'} />
              <StatCard icon={RefreshCw} label="Certifications Issued" value={analytics?.total_certifications ?? '—'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Signups chart */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} style={{ color: '#00C4A0' }} />
                  <h3 className="text-white font-semibold text-sm">New Organizations (6 months)</h3>
                </div>
                {analytics ? <MiniBarChart data={analytics.signups_by_month} color="#00C4A0" /> : <div className="h-16 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />}
              </div>

              {/* Inspections chart */}
              <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList size={16} style={{ color: '#60A5FA' }} />
                  <h3 className="text-white font-semibold text-sm">Inspections (6 months)</h3>
                </div>
                {analytics ? <MiniBarChart data={analytics.inspections_by_month} color="#60A5FA" /> : <div className="h-16 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />}
              </div>
            </div>

            {/* Plan distribution */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-white font-semibold text-sm mb-5">Plan Distribution</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {(analytics?.plan_distribution ?? PLAN_ORDER.map(p => ({ plan: p, count: 0 }))).map(({ plan, count }) => {
                  const c = PLAN_COLORS[plan] ?? PLAN_COLORS.free
                  const Icon = PLAN_ICONS[plan] ?? Zap
                  const total = analytics?.plan_distribution.reduce((s, x) => s + x.count, 0) || 1
                  const pct = Math.round((count / total) * 100)
                  return (
                    <div key={plan} className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid rgba(255,255,255,0.06)` }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon size={16} style={{ color: c.text }} />
                        <span className="text-sm font-bold capitalize" style={{ color: c.text }}>{plan}</span>
                      </div>
                      <p className="text-white text-2xl font-extrabold tabular-nums">{count}</p>
                      <div className="mt-2 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: c.text }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{pct}% of orgs</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── PLANS & PRICING ── */}
        {tab === 'plans' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white">Plans & Pricing</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Edit plan pricing, limits, and features. Changes save to the database instantly.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {PLAN_ORDER.map(p => {
                const c = PLAN_COLORS[p]; const Icon = PLAN_ICONS[p] ?? Zap
                return (
                  <div key={p} className="rounded-xl p-4 flex items-center gap-3" style={{ background: c.bg, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <Icon size={17} style={{ color: c.text }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold capitalize" style={{ color: c.text }}>{p}</p>
                      <p className="text-white text-xl font-extrabold">{planCounts[p] ?? 0}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>orgs</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {PLAN_ORDER.map(p => {
                const cfg: PlanConfig = planConfigs[p] ?? { label: p, price_monthly: 0, price_annual: 0, max_locations: 0, max_users: 0, features: [] }
                const c = PLAN_COLORS[p]
                const Icon = PLAN_ICONS[p] ?? Zap
                const isEditing = editingPlan === p
                const draft = isEditing && planDraft ? planDraft : cfg

                return (
                  <div key={p} className="rounded-2xl p-5 flex flex-col" style={{ background: 'rgba(255,255,255,0.03)', border: isEditing ? `1px solid ${c.border}` : '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.bg }}>
                          <Icon size={16} style={{ color: c.text }} />
                        </div>
                        <span className="font-bold text-sm capitalize" style={{ color: c.text }}>{p}</span>
                      </div>
                      {isEditing
                        ? <button onClick={saveEdit} disabled={savePlans.isPending} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: '#00C4A0', color: '#07142A' }}><Save size={11} /> Save</button>
                        : <button onClick={() => startEdit(p)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}><Pencil size={11} /> Edit</button>}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 flex-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Monthly $</label>
                            <input type="number" min={0} value={draft.price_monthly}
                              onChange={e => setPlanDraft(d => d ? { ...d, price_monthly: +e.target.value } : d)}
                              className="w-full rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Annual $</label>
                            <input type="number" min={0} value={draft.price_annual}
                              onChange={e => setPlanDraft(d => d ? { ...d, price_annual: +e.target.value } : d)}
                              className="w-full rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Max Locations</label>
                            <input type="number" min={0} value={draft.max_locations}
                              onChange={e => setPlanDraft(d => d ? { ...d, max_locations: +e.target.value } : d)}
                              className="w-full rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Max Users</label>
                            <input type="number" min={0} value={draft.max_users}
                              onChange={e => setPlanDraft(d => d ? { ...d, max_users: +e.target.value } : d)}
                              className="w-full rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Features (one per line)</label>
                          <textarea rows={5} value={draft.features.join('\n')}
                            onChange={e => setPlanDraft(d => d ? { ...d, features: e.target.value.split('\n') } : d)}
                            className="w-full rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none resize-none"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                        </div>
                        <button onClick={() => { setEditingPlan(null); setPlanDraft(null) }} className="w-full py-1.5 rounded-lg text-xs transition-colors"
                          style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-lg py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <p className="text-white font-bold text-base">{cfg.price_monthly === 0 ? (p === 'enterprise' ? 'Custom' : 'Free') : `$${cfg.price_monthly}`}</p>
                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>/ month</p>
                          </div>
                          <div className="rounded-lg py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <p className="text-white font-bold text-base">{cfg.price_annual === 0 ? '—' : `$${cfg.price_annual}`}</p>
                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>/ year</p>
                          </div>
                        </div>
                        <p className="text-[10px] font-mono text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {cfg.max_locations === 0 ? '∞ locations' : `${cfg.max_locations} locations`} · {cfg.max_users === 0 ? '∞ users' : `${cfg.max_users} users`}
                        </p>
                        <ul className="space-y-1.5 mt-2">
                          {cfg.features.map(f => (
                            <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                              <CheckCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#00C4A0' }} />{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{planCounts[p] ?? 0} org{planCounts[p] !== 1 ? 's' : ''}</span>
                      <button onClick={() => { setTab('orgs'); setPlanFilter(p) }} className="flex items-center gap-1 text-xs hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        View <ArrowRight size={10} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: 'rgba(0,196,160,0.05)', border: '1px solid rgba(0,196,160,0.15)' }}>
              <CreditCard size={18} style={{ color: '#00C4A0', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-white font-semibold text-sm mb-1">Stripe Integration</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Plan limits and pricing stored here are used for display and MRR calculation. To enforce plan limits automatically and collect payments, connect a Stripe webhook to the backend. Contact your developer to wire in <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: 'rgba(255,255,255,0.08)' }}>POST /webhooks/stripe</code>.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Create Org Modal */}
      {showCreateOrg && <CreateOrgModal onClose={() => setShowCreateOrg(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['sa-tenants'] }); qc.invalidateQueries({ queryKey: ['sa-stats'] }) }} />}

      {/* Plan dropdown (fixed position to escape overflow clipping) */}
      {openPlanMenu !== null && planMenuPos && (() => {
        const t = tenants.find(x => x.id === openPlanMenu)
        if (!t) return null
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPlanMenu(null)} />
            <div className="fixed z-50 rounded-xl shadow-2xl overflow-hidden min-w-[150px] py-1"
              style={{ top: planMenuPos.top, left: planMenuPos.left, background: '#0E1829', border: '1px solid rgba(255,255,255,0.12)' }}>
              <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Change plan</p>
              {PLAN_ORDER.map(p => (
                <button key={p} onClick={() => updateTenant.mutate({ id: t.id, plan: p })}
                  className="w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors hover:bg-white/5"
                  style={{ color: t.plan === p ? '#00C4A0' : 'rgba(255,255,255,0.7)' }}>
                  <div>
                    <span className="font-medium capitalize">{p}</span>
                    <span className="ml-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {(planConfigs[p]?.price_monthly ?? 0) === 0 ? (p === 'enterprise' ? 'Custom' : 'Free') : `$${planConfigs[p]?.price_monthly}/mo`}
                    </span>
                  </div>
                  {t.plan === p && <CheckCircle size={13} style={{ color: '#00C4A0' }} />}
                </button>
              ))}
            </div>
          </>
        )
      })()}
    </div>
  )
}
