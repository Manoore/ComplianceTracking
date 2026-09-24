import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { User, RoleConfig } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Plus, Edit2, UserX, Eye, MailWarning } from 'lucide-react'
import toast from 'react-hot-toast'
import { useConfirm } from '../components/ui/ConfirmDialog'

const SYSTEM_ROLE_NAMES = ['admin', 'manager', 'auditor', 'team_member']

function UserForm({ user, roles, onClose }: { user?: User; roles: RoleConfig[]; onClose: () => void }) {
  const qc = useQueryClient()
  const effectiveRole = user?.custom_role ?? user?.role ?? 'team_member'
  const [form, setForm] = useState({
    email: user?.email ?? '',
    full_name: user?.full_name ?? '',
    selectedRole: effectiveRole,
    managedRegion: user?.managed_region ?? '',
    password: '',
  })
  const { data: regions } = useQuery<{ region: string; clinic_count: number }[]>({
    queryKey: ['clinic-regions'],
    queryFn: () => api.get('/clinics/regions').then(r => r.data),
    enabled: form.selectedRole === 'regional_manager',
  })

  const buildPayload = () => {
    const isSystem = SYSTEM_ROLE_NAMES.includes(form.selectedRole)
    return {
      email: form.email,
      full_name: form.full_name,
      password: form.password || undefined,
      role: isSystem ? form.selectedRole : 'team_member',
      custom_role: isSystem ? '' : form.selectedRole,
      managed_region: form.selectedRole === 'regional_manager' ? form.managedRegion : '',
    }
  }

  const mutation = useMutation({
    mutationFn: (data: any) => user ? api.put(`/users/${user.id}`, data) : api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      if (user) toast.success('User updated')
      else toast.success(form.password ? 'User created' : 'User created — invite email sent')
      onClose()
    },
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
            <input required className="input" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email *</label>
            <input required type="email" className="input" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="input" value={form.selectedRole}
              onChange={e => setForm(f => ({ ...f, selectedRole: e.target.value }))}>
              {roles.map(r => (
                <option key={r.name} value={r.name}>{r.display_name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Manage roles and their screen access in <strong>Roles & Permissions</strong>.
            </p>
          </div>
          {form.selectedRole === 'regional_manager' && (
            <div>
              <label className="label">Managed Region *</label>
              <select required className="input" value={form.managedRegion}
                onChange={e => setForm(f => ({ ...f, managedRegion: e.target.value }))}>
                <option value="">— Select region —</option>
                {(regions ?? []).map(r => <option key={r.region} value={r.region}>{r.region} ({r.clinic_count})</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Which clinics this Regional Manager oversees on the hierarchy dashboard.
              </p>
            </div>
          )}
          <div>
            <label className="label">{user ? 'New Password (leave blank to keep)' : 'Password (optional)'}</label>
            <input type="password" className="input" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={user ? 'Leave blank to keep current' : 'Leave blank to email them an invite'} />
            {!user && (
              <p className="text-xs text-gray-400 mt-1">
                Leave blank to email them a secure link to verify their account and set their own password instead.
              </p>
            )}
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
  const { user: me, startImpersonation } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirmDialog = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<User | undefined>()
  const [viewingAsId, setViewingAsId] = useState<number | null>(null)

  const handleViewAs = async (u: User) => {
    setViewingAsId(u.id)
    try {
      await startImpersonation(u.id)
      navigate('/')
    } catch (e: any) {
      toast.error(apiError(e, "Couldn't view as this user"))
    } finally {
      setViewingAsId(null)
    }
  }

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const { data: roles = [] } = useQuery<RoleConfig[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  })

  const roleLabel = (u: User) => {
    const key = u.custom_role ?? u.role
    return roles.find(r => r.name === key)?.display_name ?? key.replace(/_/g, ' ')
  }

  const deactivate = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated') },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const resendVerification = useMutation({
    mutationFn: (id: number) => api.post(`/users/${id}/resend-verification`),
    onSuccess: () => toast.success('Verification email resent'),
    onError: (e: any) => toast.error(apiError(e, 'Could not resend verification email')),
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
                    <span className={`badge ${roleColors[u.custom_role ?? u.role] || 'bg-indigo-100 text-indigo-800'}`}>
                      {roleLabel(u)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {u.is_active
                        ? <span className="badge bg-green-100 text-green-800">Active</span>
                        : <span className="badge bg-red-100 text-red-800">Inactive</span>}
                      {u.is_active && u.is_verified === false && (
                        <span className="badge bg-amber-100 text-amber-800" title="Invited but hasn't verified their account yet">
                          Unverified
                        </span>
                      )}
                    </div>
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
                      {u.is_active && u.is_verified === false && (
                        <button className="p-1.5 hover:bg-amber-50 rounded text-gray-400 hover:text-amber-600 disabled:opacity-50"
                          title="Resend verification email"
                          disabled={resendVerification.isPending}
                          onClick={() => resendVerification.mutate(u.id)}>
                          <MailWarning size={15} />
                        </button>
                      )}
                      {u.id !== me?.id && u.is_active && (
                        <button className="p-1.5 hover:bg-purple-50 rounded text-gray-400 hover:text-purple-600 disabled:opacity-50"
                          title="View exactly what this user sees"
                          disabled={viewingAsId === u.id}
                          onClick={() => handleViewAs(u)}>
                          <Eye size={15} />
                        </button>
                      )}
                      {u.id !== me?.id && u.is_active && (
                        <button className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                          onClick={async () => { if (await confirmDialog(`Deactivate ${u.full_name}?`)) deactivate.mutate(u.id) }}>
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

      {showForm && (
        <UserForm user={editing} roles={roles} onClose={() => { setShowForm(false); setEditing(undefined) }} />
      )}
    </div>
  )
}
