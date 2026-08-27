import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { saApi, saApiError } from '../services/saApi'
import { CompliNowMark } from '../components/ui/CompliNowMark'
import {
  Building2, Users, ClipboardList, ShieldOff,
  LogOut, ChevronDown, CheckCircle, XCircle, RefreshCw, Shield,
  CreditCard, Zap, Star, Rocket, Crown, ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

const PLANS = ['free', 'starter', 'pro', 'enterprise']

const PLAN_META: Record<string, {
  label: string; price: string; color: string; border: string;
  icon: any; features: string[]; limits: string;
}> = {
  free: {
    label: 'Free', price: '$0 / mo', color: 'text-gray-400', border: 'border-gray-600',
    icon: Zap,
    limits: '1 location · 5 users · 14-day trial',
    features: ['Basic inspections', 'Standard checklists', 'PDF certificates', 'Email notifications'],
  },
  starter: {
    label: 'Starter', price: '$49 / mo', color: 'text-blue-400', border: 'border-blue-600',
    icon: Star,
    limits: '5 locations · 25 users',
    features: ['Everything in Free', 'Custom checklists', 'Analytics dashboard', 'Corrective actions', 'Excel/CSV exports'],
  },
  pro: {
    label: 'Pro', price: '$149 / mo', color: 'text-teal-400', border: 'border-teal-500',
    icon: Rocket,
    limits: 'Unlimited locations · 100 users',
    features: ['Everything in Starter', 'Custom branding', 'Accreditation engine', 'Role-based permissions', 'Priority email support'],
  },
  enterprise: {
    label: 'Enterprise', price: 'Custom', color: 'text-amber-400', border: 'border-amber-500',
    icon: Crown,
    limits: 'Unlimited everything',
    features: ['Everything in Pro', 'SSO / SAML', 'Dedicated support', 'SLA guarantee', 'Custom integrations', 'Audit log export'],
  },
}

const PLAN_BG: Record<string, string> = {
  free: 'rgba(156,163,175,0.06)',
  starter: 'rgba(59,130,246,0.06)',
  pro: 'rgba(0,196,160,0.06)',
  enterprise: 'rgba(245,158,11,0.06)',
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

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,196,160,0.1)' }}>
          <Icon size={16} style={{ color: '#00C4A0' }} />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      </div>
      <p className="text-white text-3xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const m = PLAN_META[plan] ?? PLAN_META.free
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${m.border} ${m.color}`}
      style={{ background: PLAN_BG[plan] }}>
      {m.label}
    </span>
  )
}

type Tab = 'orgs' | 'plans'

export function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [openPlanMenu, setOpenPlanMenu] = useState<number | null>(null)
  const [planMenuPos, setPlanMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [tab, setTab] = useState<Tab>('orgs')
  const [planFilter, setPlanFilter] = useState<string | null>(null)

  const handlePlanButtonClick = (e: React.MouseEvent, tenantId: number) => {
    if (openPlanMenu === tenantId) { setOpenPlanMenu(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPlanMenuPos({ top: rect.bottom + 6, left: rect.left })
    setOpenPlanMenu(tenantId)
  }

  const { data: stats } = useQuery<Stats>({
    queryKey: ['sa-stats'],
    queryFn: () => saApi.get('/stats').then(r => r.data),
  })

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ['sa-tenants'],
    queryFn: () => saApi.get('/tenants').then(r => r.data),
  })

  const updateTenant = useMutation({
    mutationFn: ({ id, ...payload }: { id: number; is_active?: boolean; plan?: string }) =>
      saApi.put(`/tenants/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-tenants'] })
      qc.invalidateQueries({ queryKey: ['sa-stats'] })
      setOpenPlanMenu(null)
      toast.success('Organization updated')
    },
    onError: (e: any) => toast.error(saApiError(e)),
  })

  const handleLogout = () => {
    localStorage.removeItem('sa_access_token')
    navigate('/superadmin/login')
  }

  const planCounts = PLANS.reduce((acc, p) => {
    acc[p] = tenants.filter(t => t.plan === p).length
    return acc
  }, {} as Record<string, number>)

  const filtered = tenants.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
    const matchPlan = planFilter ? t.plan === planFilter : true
    return matchSearch && matchPlan
  })

  return (
    <div className="min-h-screen text-white" style={{ background: '#060D1A' }}>

      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,13,26,0.95)' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CompliNowMark size={28} />
            <div>
              <span className="text-white font-semibold text-sm">CompliNow</span>
              <span className="text-xs font-mono ml-2 uppercase tracking-widest" style={{ color: '#00C4A0' }}>Platform Console</span>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {/* Tab nav */}
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {([['orgs', 'Organizations'], ['plans', 'Plans & Pricing']] as [Tab, string][]).map(([t, l]) => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={tab === t
                    ? { background: 'rgba(0,196,160,0.15)', color: '#00C4A0', border: '1px solid rgba(0,196,160,0.25)' }
                    : { color: 'rgba(255,255,255,0.4)' }}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <Shield size={13} style={{ color: '#00C4A0' }} />
              <span>Super Admin</span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs transition-colors hover:text-red-400"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── ORGANIZATIONS TAB ── */}
        {tab === 'orgs' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white">Organization Overview</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Manage all tenants across the CompliNow platform</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={Building2} label="Total Orgs" value={stats?.total_tenants ?? '—'} />
              <StatCard icon={CheckCircle} label="Active" value={stats?.active_tenants ?? '—'} />
              <StatCard icon={ShieldOff} label="Suspended" value={stats?.suspended_tenants ?? '—'} />
              <StatCard icon={Users} label="Total Users" value={stats?.total_users ?? '—'} />
              <StatCard icon={ClipboardList} label="Inspections" value={stats?.total_inspections ?? '—'} />
              <StatCard icon={RefreshCw} label="Certifications" value={stats?.total_certifications ?? '—'} />
            </div>

            {/* Plan distribution chips */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Filter by plan:</span>
              <button onClick={() => setPlanFilter(null)}
                className="text-xs px-3 py-1 rounded-full transition-all"
                style={planFilter === null
                  ? { background: 'rgba(0,196,160,0.15)', color: '#00C4A0', border: '1px solid rgba(0,196,160,0.3)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                All ({tenants.length})
              </button>
              {PLANS.map(p => {
                const m = PLAN_META[p]
                return (
                  <button key={p} onClick={() => setPlanFilter(planFilter === p ? null : p)}
                    className="text-xs px-3 py-1 rounded-full transition-all capitalize"
                    style={planFilter === p
                      ? { background: PLAN_BG[p], color: m.color.replace('text-', ''), border: `1px solid ${m.border.replace('border-', '')}` }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {m.label} ({planCounts[p] ?? 0})
                  </button>
                )
              })}
            </div>

            {/* Tenant table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-white font-semibold text-sm">All Organizations</h2>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or slug…"
                  className="text-white text-sm placeholder-white/20 focus:outline-none transition w-56 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              {isLoading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#00C4A0' }} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {['Organization', 'Plan', 'Users', 'Inspections', 'Open Actions', 'Trial Ends', 'Joined', 'Status', 'Actions'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                            style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</th>
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
                            <button className="flex items-center gap-1"
                              onClick={e => handlePlanButtonClick(e, t.id)}>
                              <PlanBadge plan={t.plan} />
                              <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                            </button>
                          </td>
                          <td className="px-5 py-4 tabular-nums" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.user_count}</td>
                          <td className="px-5 py-4 tabular-nums" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.inspection_count}</td>
                          <td className="px-5 py-4 tabular-nums">
                            <span style={{ color: t.open_actions > 0 ? '#F59E0B' : 'rgba(255,255,255,0.25)' }}>{t.open_actions}</span>
                          </td>
                          <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-5 py-4">
                            {t.is_active ? (
                              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#00C4A0' }}>
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00C4A0' }} />Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Suspended
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {t.is_active ? (
                              <button onClick={() => updateTenant.mutate({ id: t.id, is_active: false })}
                                disabled={updateTenant.isPending}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg transition-colors"
                                style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                                <XCircle size={12} /> Suspend
                              </button>
                            ) : (
                              <button onClick={() => updateTenant.mutate({ id: t.id, is_active: true })}
                                disabled={updateTenant.isPending}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                                style={{ color: '#00C4A0', border: '1px solid rgba(0,196,160,0.2)' }}>
                                <CheckCircle size={12} /> Activate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-5 py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
                            No organizations found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── PLANS & PRICING TAB ── */}
        {tab === 'plans' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white">Plans & Pricing</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Subscription tiers available to organizations. Assign a plan to any org from the Organizations tab.
              </p>
            </div>

            {/* Plan distribution */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {PLANS.map(p => {
                const m = PLAN_META[p]
                const Icon = m.icon
                const count = planCounts[p] ?? 0
                return (
                  <div key={p} className="rounded-xl p-5 flex items-center gap-4"
                    style={{ background: PLAN_BG[p], border: `1px solid rgba(255,255,255,0.07)` }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <Icon size={18} className={m.color} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${m.color}`}>{m.label}</p>
                      <p className="text-white text-2xl font-extrabold tabular-nums">{count}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>organization{count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Plan detail cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {PLANS.map(p => {
                const m = PLAN_META[p]
                const Icon = m.icon
                const count = planCounts[p] ?? 0
                const isPopular = p === 'pro'
                return (
                  <div key={p} className="rounded-2xl p-6 flex flex-col relative overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)', border: isPopular ? `1px solid rgba(0,196,160,0.35)` : '1px solid rgba(255,255,255,0.07)' }}>
                    {isPopular && (
                      <div className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: 'rgba(0,196,160,0.15)', color: '#00C4A0', border: '1px solid rgba(0,196,160,0.3)' }}>
                        Most Popular
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: PLAN_BG[p] }}>
                        <Icon size={20} className={m.color} />
                      </div>
                      <div>
                        <p className={`font-bold text-base ${m.color}`}>{m.label}</p>
                        <p className="text-white font-extrabold text-lg">{m.price}</p>
                      </div>
                    </div>

                    <p className="text-xs mb-4 font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{m.limits}</p>

                    <ul className="space-y-2 flex-1 mb-6">
                      {m.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          <CheckCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#00C4A0' }} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="rounded-lg p-3 flex items-center justify-between"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {count} org{count !== 1 ? 's' : ''} on this plan
                      </span>
                      <button
                        onClick={() => { setTab('orgs'); setPlanFilter(p) }}
                        className="flex items-center gap-1 text-xs transition-colors hover:text-white"
                        style={{ color: 'rgba(255,255,255,0.35)' }}>
                        View <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* How to assign plans note */}
            <div className="rounded-xl p-5 flex items-start gap-4"
              style={{ background: 'rgba(0,196,160,0.05)', border: '1px solid rgba(0,196,160,0.15)' }}>
              <CreditCard size={18} style={{ color: '#00C4A0', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-white font-semibold text-sm mb-1">Assigning plans to organizations</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Go to the <button onClick={() => setTab('orgs')} className="underline hover:text-white transition-colors" style={{ color: '#00C4A0' }}>Organizations</button> tab,
                  find the org, and click the plan badge in the Plan column to open the plan selector dropdown.
                  Changes take effect immediately. Stripe payment integration can be connected
                  to enforce plan limits automatically — contact your developer to wire in the webhook.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Plan dropdown — rendered as fixed to escape overflow:auto clipping */}
      {openPlanMenu !== null && planMenuPos && (() => {
        const t = tenants.find(x => x.id === openPlanMenu)
        if (!t) return null
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPlanMenu(null)} />
            <div className="fixed z-50 rounded-xl shadow-2xl overflow-hidden min-w-[140px] py-1"
              style={{ top: planMenuPos.top, left: planMenuPos.left, background: '#0E1829', border: '1px solid rgba(255,255,255,0.12)' }}>
              <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Change plan
              </p>
              {PLANS.map(p => (
                <button key={p} onClick={() => updateTenant.mutate({ id: t.id, plan: p })}
                  className="w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors hover:bg-white/5"
                  style={{ color: t.plan === p ? '#00C4A0' : 'rgba(255,255,255,0.7)' }}>
                  <div>
                    <span className="font-medium">{PLAN_META[p].label}</span>
                    <span className="ml-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{PLAN_META[p].price}</span>
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
