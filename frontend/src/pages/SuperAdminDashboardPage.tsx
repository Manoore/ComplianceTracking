import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { saApi, saApiError } from '../services/saApi'
import { CompliNowMark } from '../components/ui/CompliNowMark'
import {
  Building2, Users, ClipboardList, ShieldOff,
  LogOut, ChevronDown, CheckCircle, XCircle, RefreshCw, Shield
} from 'lucide-react'
import toast from 'react-hot-toast'

const PLANS = ['free', 'starter', 'pro', 'enterprise']

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-800 text-gray-300 border-gray-600',
  starter: 'bg-blue-900/60 text-blue-300 border-blue-600',
  pro: 'bg-teal-900/60 text-teal-300 border-teal-600',
  enterprise: 'bg-amber-900/60 text-amber-300 border-amber-600',
}

interface Tenant {
  id: number
  name: string
  slug: string
  plan: string
  is_active: boolean
  trial_ends_at: string | null
  created_at: string | null
  user_count: number
  inspection_count: number
  open_actions: number
}

interface Stats {
  total_tenants: number
  active_tenants: number
  suspended_tenants: number
  total_users: number
  total_inspections: number
  total_certifications: number
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
          <Icon size={16} className="text-teal-400" />
        </div>
        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-white text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`}>
      {plan}
    </span>
  )
}

export function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [openPlanMenu, setOpenPlanMenu] = useState<number | null>(null)

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
      toast.success('Tenant updated')
    },
    onError: (e: any) => toast.error(saApiError(e)),
  })

  const handleLogout = () => {
    localStorage.removeItem('sa_access_token')
    navigate('/superadmin/login')
  }

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#060D1A] text-white">
      {/* Top bar */}
      <header className="border-b border-white/8 bg-white/[0.02] backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CompliNowMark size={28} />
            <div>
              <span className="text-white font-semibold text-sm">CompliNow</span>
              <span className="text-teal-400 text-[10px] font-mono ml-2 uppercase tracking-widest">Platform Console</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-white/40 text-xs">
              <Shield size={13} className="text-teal-400" />
              <span>Super Admin</span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/40 hover:text-red-400 text-xs transition-colors">
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-white">Organization Overview</h1>
          <p className="text-white/40 text-sm mt-1">Manage all tenants across the CompliNow platform</p>
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

        {/* Tenant table */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between gap-4">
            <h2 className="text-white font-semibold text-sm">All Organizations</h2>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or slug…"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-teal-400/50 w-56 transition"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Organization', 'Plan', 'Users', 'Inspections', 'Open Actions', 'Trial Ends', 'Joined', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-white/30 font-medium text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-white font-medium">{t.name}</p>
                        <p className="text-white/30 text-xs font-mono">{t.slug}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="relative inline-block">
                          <button
                            className="flex items-center gap-1"
                            onClick={() => setOpenPlanMenu(openPlanMenu === t.id ? null : t.id)}
                          >
                            <PlanBadge plan={t.plan} />
                            <ChevronDown size={12} className="text-white/30" />
                          </button>
                          {openPlanMenu === t.id && (
                            <div className="absolute left-0 top-full mt-1 z-20 bg-[#0E1829] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[120px]">
                              {PLANS.map(p => (
                                <button key={p} onClick={() => updateTenant.mutate({ id: t.id, plan: p })}
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition-colors capitalize text-white/70 hover:text-white">
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 tabular-nums text-white/60">{t.user_count}</td>
                      <td className="px-5 py-4 tabular-nums text-white/60">{t.inspection_count}</td>
                      <td className="px-5 py-4 tabular-nums">
                        <span className={t.open_actions > 0 ? 'text-amber-400' : 'text-white/30'}>
                          {t.open_actions}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-white/40 text-xs">
                        {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4 text-white/40 text-xs">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {t.is_active ? (
                          <span className="flex items-center gap-1.5 text-teal-400 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {t.is_active ? (
                          <button
                            onClick={() => updateTenant.mutate({ id: t.id, is_active: false })}
                            disabled={updateTenant.isPending}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-400/40 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <XCircle size={12} /> Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => updateTenant.mutate({ id: t.id, is_active: true })}
                            disabled={updateTenant.isPending}
                            className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 border border-teal-500/20 hover:border-teal-400/40 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <CheckCircle size={12} /> Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center text-white/20 text-sm">
                        No organizations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Click-away for plan menu */}
      {openPlanMenu !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenPlanMenu(null)} />
      )}
    </div>
  )
}
