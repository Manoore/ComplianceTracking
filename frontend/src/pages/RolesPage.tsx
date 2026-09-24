import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { RoleConfig } from '../types'
import { Plus, Trash2, Shield, Pencil, Check, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { HIERARCHY_ROLES } from '../utils/hierarchy'

// The "Rename" pencil only ever changes a role's display label -- the internal
// name (the slug every permission/scoping check actually compares against) is
// set once, permanently, from whatever was typed when the role was first
// created, and is never shown anywhere in this UI otherwise. A typo there (e.g.
// "reginal_manager" instead of "regional_manager") silently strips that role of
// every hierarchy behavior everywhere in the app, with no error and no way to
// notice short of reading this exact string. Flag anything close to one of the
// 4 reserved hierarchy slugs that isn't an exact match.
function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

function suspectedTypoOf(roleName: string): string | null {
  if (HIERARCHY_ROLES.includes(roleName)) return null
  for (const reserved of HIERARCHY_ROLES) {
    const dist = levenshtein(roleName, reserved)
    if (dist > 0 && dist <= 2) return reserved
  }
  return null
}

const ALL_MODULES = [
  { key: 'clinics', label: 'Clinics' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'inspections', label: 'Inspections' },
  { key: 'audits', label: 'Audits' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'corrective_actions', label: 'Corrective Actions' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'reports', label: 'Reports' },
]

function NewRoleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [display, setDisplay] = useState('')

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/roles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role created')
      onClose()
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const name = display.toLowerCase().replace(/\s+/g, '_')
  const typoOf = suspectedTypoOf(name)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Create New Role</h2>
        </div>
        <form className="p-6 space-y-4"
          onSubmit={e => { e.preventDefault(); mutation.mutate({ name, display_name: display }) }}>
          <div>
            <label className="label">Role Name *</label>
            <input required className="input" placeholder="e.g. Field Inspector"
              value={display} onChange={e => setDisplay(e.target.value)} />
            {display && <p className="text-xs text-gray-400 mt-1">Internal key: <code>{name}</code></p>}
            {typoOf && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-2 flex items-start gap-1.5">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  This looks like it might be a typo of "{typoOf.replace(/_/g, ' ')}" — if so, type it exactly that
                  way. A misspelled internal key won't get any of that role's special behavior (clinic
                  scoping, dashboards, review queue), even though the label looks right afterward.
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending || !display.trim()}>
              {mutation.isPending ? 'Creating…' : 'Create Role'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RoleHeader({ role, onDelete }: { role: RoleConfig; onDelete: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(role.display_name)

  const rename = useMutation({
    mutationFn: (display_name: string) => api.patch(`/roles/${role.name}`, { display_name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      setEditing(false)
      toast.success('Role renamed')
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-1">
        <input
          autoFocus
          className="input text-xs text-center py-1 w-28"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setDraft(role.display_name) } }}
        />
        <div className="flex gap-1">
          <button onClick={() => rename.mutate(draft)} className="text-green-600 hover:text-green-700">
            <Check size={13} />
          </button>
          <button onClick={() => { setEditing(false); setDraft(role.display_name) }} className="text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        </div>
      </div>
    )
  }

  const typoOf = suspectedTypoOf(role.name)

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="flex items-center gap-1">
        {role.display_name}
        {typoOf && (
          <span
            title={`This role's internal name is "${role.name}", which looks like a typo of the reserved "${typoOf}" role. As long as it's spelled differently, every Clinic Lead/Regional Manager/Director/Executive feature (clinic scoping, dashboards, review queue) silently doesn't apply to anyone assigned this role. This can't be fixed by renaming -- delete this role and recreate it with the name typed exactly as "${typoOf.replace(/_/g, ' ')}", then reassign anyone on it.`}>
            <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
          </span>
        )}
      </span>
      <span className="text-[10px] text-gray-400 font-mono" title="Internal role name -- what the app's permission checks actually compare against">
        {role.name}
      </span>
      <div className="flex gap-1.5">
        <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-brand-600" title="Rename (display label only -- see note above about the internal name)">
          <Pencil size={12} />
        </button>
        {!role.is_system && (
          <button onClick={onDelete} className="text-gray-400 hover:text-red-500" title="Delete role">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

export function RolesPage() {
  const qc = useQueryClient()
  const confirmDialog = useConfirm()
  const [showNew, setShowNew] = useState(false)

  const { data: roles = [], isLoading } = useQuery<RoleConfig[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })

  const updatePerms = useMutation({
    mutationFn: ({ roleName, modules }: { roleName: string; modules: string[] }) =>
      api.put(`/roles/${roleName}/permissions`, { modules }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['my-permissions'] })
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const deleteRole = useMutation({
    mutationFn: (name: string) => api.delete(`/roles/${name}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role deleted') },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const toggleModule = (role: RoleConfig, module: string) => {
    const has = role.modules.includes(module)
    const next = has ? role.modules.filter(m => m !== module) : [...role.modules, module]
    updatePerms.mutate({ roleName: role.name, modules: next })
  }

  const nonAdminRoles = roles.filter(r => r.name !== 'admin')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage roles here — they appear automatically in the Users page
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> New Role
        </button>
      </div>

      <div className="card flex items-center gap-3 bg-purple-50 border border-purple-200">
        <Shield size={20} className="text-purple-600 flex-shrink-0" />
        <p className="text-sm text-purple-800">
          <strong>Admin</strong> always has full access and cannot be restricted.
          Click the <Pencil size={12} className="inline" /> icon on any role to rename it.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium w-44">Screen</th>
                {nonAdminRoles.map(r => (
                  <th key={r.name} className="py-3 px-3 text-center text-gray-600 font-medium min-w-[130px]">
                    <RoleHeader
                      role={r}
                      onDelete={async () => { if (await confirmDialog(`Delete role "${r.display_name}"?`)) deleteRole.mutate(r.name) }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_MODULES.map(mod => (
                <tr key={mod.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-700">{mod.label}</td>
                  {nonAdminRoles.map(role => (
                    <td key={role.name} className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={role.modules.includes(mod.key)}
                        onChange={() => toggleModule(role, mod.key)}
                        className="w-4 h-4 accent-brand-600 cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Changes apply the next time users refresh. Dashboard is always visible to everyone.
      </p>

      {showNew && <NewRoleModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
