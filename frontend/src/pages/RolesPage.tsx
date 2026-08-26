import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { RoleConfig } from '../types'
import { Plus, Trash2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [name, setName] = useState('')
  const [display, setDisplay] = useState('')

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/roles', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role created'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Create New Role</h2>
        </div>
        <form className="p-6 space-y-4" onSubmit={e => { e.preventDefault(); mutation.mutate({ name, display_name: display }) }}>
          <div>
            <label className="label">Display Name *</label>
            <input required className="input" placeholder="e.g. Field Inspector"
              value={display} onChange={e => { setDisplay(e.target.value); setName(e.target.value.toLowerCase().replace(/\s+/g, '_')) }} />
            {name && <p className="text-xs text-gray-400 mt-1">Internal name: <code>{name}</code></p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Role'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function RolesPage() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)

  const { data: roles = [], isLoading } = useQuery<RoleConfig[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })

  const updatePerms = useMutation({
    mutationFn: ({ roleName, modules }: { roleName: string; modules: string[] }) =>
      api.put(`/roles/${roleName}/permissions`, { modules }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); qc.invalidateQueries({ queryKey: ['my-permissions'] }) },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const deleteRole = useMutation({
    mutationFn: (name: string) => api.delete(`/roles/${name}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role deleted') },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const toggleModule = (role: RoleConfig, module: string) => {
    if (role.name === 'admin') return
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
          <p className="text-sm text-gray-500 mt-0.5">Control which screens each role can access</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> New Role
        </button>
      </div>

      {/* Admin notice */}
      <div className="card flex items-center gap-3 bg-purple-50 border border-purple-200">
        <Shield size={20} className="text-purple-600 flex-shrink-0" />
        <p className="text-sm text-purple-800">
          <strong>Admin</strong> always has access to everything and cannot be restricted.
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
                <th className="text-left py-3 px-4 text-gray-500 font-medium w-36">Screen</th>
                {nonAdminRoles.map(r => (
                  <th key={r.name} className="py-3 px-3 text-center text-gray-500 font-medium min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <span>{r.display_name}</span>
                      {!r.is_system && (
                        <button
                          onClick={() => { if (confirm(`Delete role "${r.display_name}"?`)) deleteRole.mutate(r.name) }}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_MODULES.map(mod => (
                <tr key={mod.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-700">{mod.label}</td>
                  {nonAdminRoles.map(role => {
                    const checked = role.modules.includes(mod.key)
                    return (
                      <td key={role.name} className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModule(role, mod.key)}
                          className="w-4 h-4 accent-brand-600 cursor-pointer"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Changes take effect the next time the user refreshes the app. Dashboard is always visible to all roles.
      </p>

      {showNew && <NewRoleModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
