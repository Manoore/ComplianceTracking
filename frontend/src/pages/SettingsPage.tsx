import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import { Save, Upload, Shield, Bell, Database, Key } from 'lucide-react'
import toast from 'react-hot-toast'

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
        <div className="p-2 bg-brand-50 rounded-lg"><Icon className="text-brand-600" size={20} /></div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export function SettingsPage() {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  })

  const [org, setOrg] = useState({ org_name: '', primary_color: '#1E40AF', secondary_color: '#3B82F6' })
  const [sso, setSso] = useState({ sso_enabled: false, sso_provider: '', sso_client_id: '', sso_discovery_url: '' })
  const [notif, setNotif] = useState({ cert_reminder_days: '3,7,14', cert_expiry_warning_days: '7,14,30', action_overdue_escalation_days: 3 })
  const [retention, setRetention] = useState({ inspection_retention_days: 2555, audit_log_retention_days: 2555 })
  const [backup, setBackup] = useState({ backup_enabled: true, backup_frequency: 'daily', backup_retention_count: 30 })

  useEffect(() => {
    if (!settings) return
    setOrg({ org_name: settings.org_name || '', primary_color: settings.primary_color, secondary_color: settings.secondary_color })
    setSso({ sso_enabled: settings.sso_enabled, sso_provider: settings.sso_provider || '', sso_client_id: settings.sso_client_id || '', sso_discovery_url: settings.sso_discovery_url || '' })
    setNotif({
      cert_reminder_days: (settings.cert_reminder_days || [3, 7, 14]).join(','),
      cert_expiry_warning_days: (settings.cert_expiry_warning_days || [7, 14, 30]).join(','),
      action_overdue_escalation_days: settings.action_overdue_escalation_days || 3,
    })
    setRetention({ inspection_retention_days: settings.inspection_retention_days, audit_log_retention_days: settings.audit_log_retention_days })
    setBackup({ backup_enabled: settings.backup_enabled, backup_frequency: settings.backup_frequency, backup_retention_count: settings.backup_retention_count })
  }, [settings])

  const save = useMutation({
    mutationFn: (data: any) => api.put('/settings', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved') },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Logo uploaded')
    } catch (err: any) {
      toast.error(apiError(err, 'Upload failed'))
    }
    e.target.value = ''
  }

  const handleSave = () => {
    save.mutate({
      ...org,
      ...sso,
      ...retention,
      ...backup,
      cert_reminder_days: notif.cert_reminder_days.split(',').map(Number).filter(Boolean),
      cert_expiry_warning_days: notif.cert_expiry_warning_days.split(',').map(Number).filter(Boolean),
      action_overdue_escalation_days: Number(notif.action_overdue_escalation_days),
    })
  }

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings & Administration</h1>
        <button className="btn-primary" onClick={handleSave} disabled={save.isPending}>
          <Save size={16} /> {save.isPending ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {/* Organization Profile */}
      <Section title="Organization Profile" icon={Shield}>
        <div className="space-y-4">
          <div>
            <label className="label">Organization Name</label>
            <input className="input" value={org.org_name} onChange={e => setOrg(o => ({ ...o, org_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Logo</label>
            <div className="flex items-center gap-4">
              {settings?.org_logo_url && (
                <img src={settings.org_logo_url} alt="Logo" className="h-12 w-auto rounded border border-gray-200" />
              )}
              <label className="btn-secondary cursor-pointer">
                <Upload size={15} /> Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Primary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" className="h-9 w-16 rounded border border-gray-300 cursor-pointer p-1"
                  value={org.primary_color} onChange={e => setOrg(o => ({ ...o, primary_color: e.target.value }))} />
                <input className="input flex-1" value={org.primary_color} onChange={e => setOrg(o => ({ ...o, primary_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Secondary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" className="h-9 w-16 rounded border border-gray-300 cursor-pointer p-1"
                  value={org.secondary_color} onChange={e => setOrg(o => ({ ...o, secondary_color: e.target.value }))} />
                <input className="input flex-1" value={org.secondary_color} onChange={e => setOrg(o => ({ ...o, secondary_color: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* SSO */}
      <Section title="Single Sign-On (SSO)" icon={Key}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={sso.sso_enabled} onChange={e => setSso(s => ({ ...s, sso_enabled: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
            <span className="text-sm font-medium">Enable SSO Authentication</span>
          </label>
          {sso.sso_enabled && (
            <>
              <div>
                <label className="label">Provider</label>
                <select className="input" value={sso.sso_provider} onChange={e => setSso(s => ({ ...s, sso_provider: e.target.value }))}>
                  <option value="">Select…</option>
                  <option value="okta">Okta</option>
                  <option value="azure">Azure AD</option>
                  <option value="google">Google Workspace</option>
                  <option value="saml">Generic SAML 2.0</option>
                  <option value="oidc">Generic OIDC</option>
                </select>
              </div>
              <div>
                <label className="label">Client ID</label>
                <input className="input" value={sso.sso_client_id} onChange={e => setSso(s => ({ ...s, sso_client_id: e.target.value }))} />
              </div>
              <div>
                <label className="label">OIDC Discovery URL</label>
                <input className="input" type="url" placeholder="https://provider/.well-known/openid-configuration"
                  value={sso.sso_discovery_url} onChange={e => setSso(s => ({ ...s, sso_discovery_url: e.target.value }))} />
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                SSO client secret must be set via the <code>SSO_CLIENT_SECRET</code> environment variable, not stored here.
              </p>
            </>
          )}
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notification Schedule" icon={Bell}>
        <div className="space-y-4">
          <div>
            <label className="label">Certification reminder days before due (comma-separated)</label>
            <input className="input" value={notif.cert_reminder_days}
              onChange={e => setNotif(n => ({ ...n, cert_reminder_days: e.target.value }))}
              placeholder="3,7,14" />
            <p className="text-xs text-gray-400 mt-1">e.g. "3,7,14" sends reminders 3, 7 and 14 days before due date</p>
          </div>
          <div>
            <label className="label">Certification expiry warnings (days before expiry)</label>
            <input className="input" value={notif.cert_expiry_warning_days}
              onChange={e => setNotif(n => ({ ...n, cert_expiry_warning_days: e.target.value }))}
              placeholder="7,14,30" />
          </div>
          <div>
            <label className="label">Corrective action overdue escalation (days past due)</label>
            <input type="number" min={1} className="input w-32"
              value={notif.action_overdue_escalation_days}
              onChange={e => setNotif(n => ({ ...n, action_overdue_escalation_days: parseInt(e.target.value) }))} />
          </div>
        </div>
      </Section>

      {/* Data Retention */}
      <Section title="Data Retention" icon={Database}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Inspection records (days)</label>
            <input type="number" className="input" value={retention.inspection_retention_days}
              onChange={e => setRetention(r => ({ ...r, inspection_retention_days: parseInt(e.target.value) }))} />
            <p className="text-xs text-gray-400 mt-1">Default: 2555 days (7 years)</p>
          </div>
          <div>
            <label className="label">Audit log (days)</label>
            <input type="number" className="input" value={retention.audit_log_retention_days}
              onChange={e => setRetention(r => ({ ...r, audit_log_retention_days: parseInt(e.target.value) }))} />
          </div>
        </div>
      </Section>

      {/* Backup */}
      <Section title="Automated Backups" icon={Database}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={backup.backup_enabled} onChange={e => setBackup(b => ({ ...b, backup_enabled: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
            <span className="text-sm font-medium">Enable automated backups</span>
          </label>
          {backup.backup_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Frequency</label>
                <select className="input" value={backup.backup_frequency}
                  onChange={e => setBackup(b => ({ ...b, backup_frequency: e.target.value }))}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className="label">Keep last N backups</label>
                <input type="number" min={1} max={365} className="input"
                  value={backup.backup_retention_count}
                  onChange={e => setBackup(b => ({ ...b, backup_retention_count: parseInt(e.target.value) }))} />
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400">Backups are stored in the <code>./backups</code> volume mount. Configure off-site sync externally.</p>
        </div>
      </Section>
    </div>
  )
}
