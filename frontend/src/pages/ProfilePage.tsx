import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import api, { apiError } from '../services/api'
import toast from 'react-hot-toast'
import { User, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    admin: 'bg-blue-100 text-blue-700',
    manager: 'bg-indigo-100 text-indigo-700',
    auditor: 'bg-amber-100 text-amber-700',
    team_member: 'bg-emerald-100 text-emerald-700',
  }
  return map[role] ?? 'bg-gray-100 text-gray-600'
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.full_name ?? '')
  const [nameLoading, setNameLoading] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  if (!user) return null

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setNameLoading(true)
    try {
      await api.put(`/users/${user.id}`, { full_name: name.trim() })
      await refreshUser()
      toast.success('Name updated successfully')
    } catch (err) {
      toast.error(apiError(err, 'Failed to update name'))
    } finally {
      setNameLoading(false)
    }
  }

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    setPwLoading(true)
    try {
      await api.put(`/users/${user.id}`, { password: newPw })
      toast.success('Password changed successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      toast.error(apiError(err, 'Failed to change password'))
    } finally {
      setPwLoading(false)
    }
  }

  const displayRole = (user.custom_role || user.role).replace('_', ' ')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your personal information and security settings</p>
      </div>

      {/* Avatar + info card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
          style={{ background: '#1B3260' }}>
          {initials(user.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-gray-900 truncate">{user.full_name}</p>
          <p className="text-gray-500 text-sm truncate">{user.email}</p>
          <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${roleBadge(user.role)}`}>
            {displayRole}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck size={13} style={{ color: '#00C4A0' }} />
            <span>Verified account</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">ID #{user.id}</p>
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EEF4FF' }}>
            <User size={16} style={{ color: '#1B3260' }} />
          </div>
          <h2 className="font-semibold text-gray-900">Personal Information</h2>
        </div>
        <form onSubmit={handleNameSave} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email address</label>
            <input className="input bg-gray-50 cursor-not-allowed" value={user.email} disabled
              title="Email cannot be changed. Contact your admin." />
            <p className="text-xs text-gray-400 mt-1">Email address cannot be changed directly.</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={nameLoading || name.trim() === user.full_name}
              className="btn-primary px-6 py-2 text-sm disabled:opacity-50">
              {nameLoading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FFF8EE' }}>
            <KeyRound size={16} className="text-amber-500" />
          </div>
          <h2 className="font-semibold text-gray-900">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div className="relative">
            <label className="label">New password</label>
            <input className="input pr-10" type={showNew ? 'text' : 'password'} minLength={8}
              value={newPw} onChange={e => setNewPw(e.target.value)} required
              placeholder="At least 8 characters" autoComplete="new-password" />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="relative">
            <label className="label">Confirm new password</label>
            <input className="input pr-10" type={showCurrent ? 'text' : 'password'}
              value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
              placeholder="Repeat password" autoComplete="new-password" />
            <button type="button" onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
          {newPw.length > 0 && newPw.length < 8 && (
            <p className="text-xs text-red-500">Must be at least 8 characters</p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={pwLoading || !newPw || !confirmPw}
              className="btn-primary px-6 py-2 text-sm disabled:opacity-50">
              {pwLoading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
