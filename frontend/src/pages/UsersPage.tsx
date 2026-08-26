import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { User, UserRole, RoleConfig } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Plus, Edit2, UserX } from 'lucide-react'
import toast from 'react-hot-toast'

const SYSTEM_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'team_member', label: 'Team Member' },
]

function UserForm({ user, customRoles, onClose }: { user?: User; customRoles: RoleConfig[]; onClose: () => void }) {
  const qc = useQueryClient()
  const effectiveRole = user?.custom_role ?? user?.role ?? 'team_member'
  const [form, setForm] = useState({
    email: user?.email ?? '',
    full_name: user?.full_name ?? '',
    selectedRole: effectiveRole,
    password: '',
  })

  const buildPayload = () => {
    const isCustom = !SYSTEM_ROLES.find(r => r.value === form.selectedRole)
    return {
      email: form.email,
      full_name: form.full_name,
      password: form.password || undefined,
      role: isCustom ? 'team_member' : form.selectedRole,
      custom_role: isCustom ? form.selectedRole : '',
    }
  }

  const mutation = useMutation({
    mutationFn: (data: any) => user ? api.put(`/users/${user.id}`, data) : api.post('/users', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(user ? 'User updated' : 'User created'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{user ? 'Edit User' : 'Add User'}</h2>
        </div>
        <form className="p-6 space-y-4" onSubmit={e => { e.preventDefault(); mutation.mutate(buildPayload()) }}>
          <div>
            <label className="label">Full Name *</label>
            <input required className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email *</label>
            <input required type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="input" value={form.selectedRole} onChange={e => setForm(f => ({ ...f, selectedRole: e.target.value }))}>
              <optgroup label="System Roles">
                {SYSTEM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </optgroup>
              {customRoles.length > 0 && (
                <optgroup label="Custom Roles">
                  {customRoles.map(r => <option key={r.name} value={r.name}>{r.display_name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="label">{user ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" required={!user} className="input" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={user ? 'Leave blank to keep current' : '••••••••'} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  auditor: 'bg-yellow-100 text-yellow-800',
  team_member: 'bg-gray-100 text-gray-800',
}

export function UsersPage() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<User | undefined>()

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const { data: allRoles = [] } = useQuery<RoleConfig[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })
  const customRoles = allRoles.filter(r => !r.is_system)

  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated') },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button className="btn-primary" onClick={() => { setEditing(undefined); setShowForm(true) }}>
          <Plus size={16} /> Add User
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Email</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Role</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">
                    {u.full_name}
                    {u.id === me?.id && <span className="ml-2 text-xs text-brand-500">(you)</span>}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${roleColors[u.custom_role ?? u.role] || roleColors[u.role] || 'bg-gray-100 text-gray-800'}`}>
                      {(u.custom_role ?? u.role).replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {u.is_active
                      ? <span className="badge bg-green-100 text-green-800">Active</span>
                      : <span className="badge bg-red-100 text-red-800">Inactive</span>}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button className="p-1.5 hover:bg-brand-50 rounded text-gray-400 hover:text-brand-600"
                        onClick={() => { setEditing(u); setShowForm(true) }}>
                        <Edit2 size={15} />
                      </button>
                      {u.id !== me?.id && u.is_active && (
                        <button className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                          onClick={() => { if (confirm(`Deactivate ${u.full_name}?`)) deactivate.mutate(u.id) }}>
                          <UserX size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <UserForm user={editing} customRoles={customRoles} onClose={() => { setShowForm(false); setEditing(undefined) }} />}
    </div>
  )
}
