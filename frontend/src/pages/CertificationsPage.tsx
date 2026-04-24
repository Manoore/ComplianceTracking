import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { Course, CertificationLink, TeamCertification } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge } from '../components/ui/Badge'
import { Plus, Copy, Bell, ExternalLink, Award } from 'lucide-react'
import toast from 'react-hot-toast'

function NewCourseModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: '', description: '', pass_threshold: 80, validity_days: 365 })
  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/certifications/courses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); toast.success('Course created'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">New Course</h2>
        </div>
        <form className="p-6 space-y-4" onSubmit={e => { e.preventDefault(); mutation.mutate(form) }}>
          <div><label className="label">Title *</label>
            <input required className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div><label className="label">Description</label>
            <textarea rows={3} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Pass Threshold (%)</label>
              <input type="number" min={0} max={100} className="input" value={form.pass_threshold}
                onChange={e => setForm(f => ({ ...f, pass_threshold: parseInt(e.target.value) }))} />
            </div>
            <div><label className="label">Validity (days)</label>
              <input type="number" min={1} className="input" value={form.validity_days}
                onChange={e => setForm(f => ({ ...f, validity_days: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Course'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GenerateLinkModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: courses } = useQuery<Course[]>({ queryKey: ['courses'], queryFn: () => api.get('/certifications/courses').then(r => r.data) })
  const [form, setForm] = useState({ course_id: '', assigned_email: '', assigned_name: '', expires_days: '' })

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/certifications/links', data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['cert-links'] })
      navigator.clipboard.writeText(r.data.url).then(() => toast.success('Link copied to clipboard!'))
      onClose()
    },
    onError: (e: any) => toast.error(apiError(e)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold">Generate Certification Link</h2></div>
        <form className="p-6 space-y-4" onSubmit={e => {
          e.preventDefault()
          mutation.mutate({
            course_id: parseInt(form.course_id),
            assigned_email: form.assigned_email || null,
            assigned_name: form.assigned_name || null,
            expires_days: form.expires_days ? parseInt(form.expires_days) : null,
          })
        }}>
          <div><label className="label">Course *</label>
            <select required className="input" value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}>
              <option value="">Select…</option>
              {(courses ?? []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div><label className="label">Assign to Email (optional)</label>
            <input type="email" className="input" value={form.assigned_email} onChange={e => setForm(f => ({ ...f, assigned_email: e.target.value }))} placeholder="team.member@clinic.com" />
          </div>
          <div><label className="label">Name (optional)</label>
            <input className="input" value={form.assigned_name} onChange={e => setForm(f => ({ ...f, assigned_name: e.target.value }))} />
          </div>
          <div><label className="label">Expires in (days, optional)</label>
            <input type="number" min={1} className="input" value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))} placeholder="e.g. 30" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>Generate & Copy Link</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CertificationsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'courses' | 'links' | 'completions'>('courses')
  const [showNewCourse, setShowNewCourse] = useState(false)
  const [showNewLink, setShowNewLink] = useState(false)

  const { data: courses, isLoading: loadingCourses } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () => api.get('/certifications/courses').then(r => r.data),
  })
  const { data: links } = useQuery<CertificationLink[]>({
    queryKey: ['cert-links'],
    queryFn: () => api.get('/certifications/links').then(r => r.data),
    enabled: tab === 'links' && (user?.role === 'admin'),
  })
  const { data: completions } = useQuery<TeamCertification[]>({
    queryKey: ['certifications'],
    queryFn: () => api.get('/certifications').then(r => r.data),
    enabled: tab === 'completions',
  })

  const remind = useMutation({
    mutationFn: (linkId: number) => api.post(`/certifications/remind/${linkId}`),
    onSuccess: () => toast.success('Reminder sent'),
    onError: (e: any) => toast.error(apiError(e)),
  })

  const isAdmin = user?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Certifications</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowNewLink(true)}>
              <Copy size={15} /> Generate Link
            </button>
            <button className="btn-primary" onClick={() => setShowNewCourse(true)}>
              <Plus size={16} /> New Course
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {['courses', ...(isAdmin ? ['links'] : []), 'completions'].map(t => (
          <button key={t} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
            onClick={() => setTab(t as any)}>{t}</button>
        ))}
      </div>

      {tab === 'courses' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(courses ?? []).map(c => (
            <div key={c.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                  <Award className="text-purple-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.quiz_count} quiz{c.quiz_count !== 1 ? 'zes' : ''}</p>
                </div>
              </div>
              {c.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{c.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>Pass: {c.pass_threshold}%</span>
                <span>·</span>
                <span>Valid: {c.validity_days}d</span>
              </div>
            </div>
          ))}
          {!loadingCourses && (courses?.length ?? 0) === 0 && (
            <p className="col-span-3 text-center py-16 text-gray-400">No courses yet</p>
          )}
        </div>
      )}

      {tab === 'links' && isAdmin && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Course</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Assigned To</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Expires</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Completions</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(links ?? []).map(lnk => (
                <tr key={lnk.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium">{lnk.course_title}</td>
                  <td className="py-3 px-4 text-gray-500">{lnk.assigned_email || <span className="text-gray-300">Public link</span>}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {lnk.expires_at ? new Date(lnk.expires_at).toLocaleDateString() : <span className="text-gray-300">Never</span>}
                  </td>
                  <td className="py-3 px-4">{lnk.completions}</td>
                  <td className="py-3 px-4">{lnk.is_active ? <span className="badge bg-green-100 text-green-800">Active</span> : <span className="badge bg-gray-100 text-gray-600">Inactive</span>}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button title="Copy link" className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/certify/${lnk.token}`); toast.success('Copied!') }}>
                        <Copy size={14} />
                      </button>
                      <a href={`${window.location.origin}/certify/${lnk.token}`} target="_blank" rel="noopener"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                        <ExternalLink size={14} />
                      </a>
                      {lnk.assigned_email && (
                        <button title="Send reminder" className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                          onClick={() => remind.mutate(lnk.id)}>
                          <Bell size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(links?.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No links generated yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'completions' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Participant</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Course</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Score</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(completions ?? []).map(cert => (
                <tr key={cert.id} className="border-b border-gray-100">
                  <td className="py-3 px-4">
                    <p className="font-medium">{cert.participant_name}</p>
                    <p className="text-xs text-gray-400">{cert.participant_email}</p>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{cert.course_title}</td>
                  <td className="py-3 px-4">{cert.score != null ? `${cert.score.toFixed(1)}%` : '—'}</td>
                  <td className="py-3 px-4">{statusBadge(cert.status)}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {cert.certificate_path && (
                      <a href={cert.certificate_path} target="_blank" rel="noopener"
                        className="p-1.5 hover:bg-green-50 rounded text-green-600 inline-flex">
                        <Award size={16} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {(completions?.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No completions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNewCourse && <NewCourseModal onClose={() => setShowNewCourse(false)} />}
      {showNewLink && <GenerateLinkModal onClose={() => setShowNewLink(false)} />}
    </div>
  )
}
