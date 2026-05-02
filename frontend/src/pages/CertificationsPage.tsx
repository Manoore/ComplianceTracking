import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiError } from '../services/api'
import type { Course, CertificationLink, TeamCertification } from '../types'
import { useAuth } from '../hooks/useAuth'
import { statusBadge } from '../components/ui/Badge'
import { Plus, Copy, Bell, ExternalLink, Award, Trash2, X, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

type OptionDraft = { text: string; is_correct: boolean }
type QuestionDraft = { text: string; options: OptionDraft[] }
type QuizDraft = { title: string; time_limit: string; max_attempts: number; questions: QuestionDraft[] }

const newOpt = (): OptionDraft => ({ text: '', is_correct: false })
const newQuestion = (): QuestionDraft => ({ text: '', options: [newOpt(), newOpt(), newOpt(), newOpt()] })
const newQuiz = (n = 1): QuizDraft => ({ title: `Quiz ${n}`, time_limit: '', max_attempts: 3, questions: [newQuestion()] })

function NewCourseModal({ onClose, courseId }: { onClose: () => void; courseId?: number }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [basics, setBasics] = useState({ title: '', description: '', pass_threshold: 80, validity_days: 365 })
  const [quizzes, setQuizzes] = useState<QuizDraft[]>([newQuiz()])

  const { data: existing } = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () => api.get(`/certifications/courses/${courseId}`).then(r => r.data),
    enabled: !!courseId,
  })

  useEffect(() => {
    if (!existing) return
    setBasics({ title: existing.title, description: existing.description || '', pass_threshold: existing.pass_threshold, validity_days: existing.validity_days })
    setQuizzes((existing.quizzes ?? []).map((qz: any) => ({
      title: qz.title, time_limit: qz.time_limit_minutes ? String(qz.time_limit_minutes) : '', max_attempts: qz.max_attempts ?? 3,
      questions: (qz.questions ?? []).map((q: any) => ({
        text: q.question_text, options: (q.options ?? []).map((o: any) => ({ text: o.option_text, is_correct: o.is_correct ?? false })),
      })),
    })))
  }, [existing?.id])

  const mutation = useMutation({
    mutationFn: (data: any) => courseId ? api.put(`/certifications/courses/${courseId}`, data) : api.post('/certifications/courses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); toast.success(courseId ? 'Course updated' : 'Course created'); onClose() },
    onError: (e: any) => toast.error(apiError(e)),
  })

  function submit() {
    const payload = {
      ...basics,
      quizzes: quizzes.map((qz, qi) => ({
        title: qz.title || `Quiz ${qi + 1}`,
        time_limit_minutes: qz.time_limit ? parseInt(qz.time_limit) : null,
        max_attempts: qz.max_attempts,
        order_index: qi,
        questions: qz.questions
          .filter(q => q.text.trim())
          .map((q, qqi) => ({
            question_text: q.text,
            order_index: qqi,
            options: q.options.filter(o => o.text.trim()).map(o => ({ option_text: o.text, is_correct: o.is_correct })),
          })),
      })),
    }
    mutation.mutate(payload)
  }

  const updQuiz = (qi: number, field: keyof QuizDraft, val: any) =>
    setQuizzes(qzs => qzs.map((qz, i) => i === qi ? { ...qz, [field]: val } : qz))

  const updQuestion = (qi: number, qqi: number, val: string) =>
    setQuizzes(qzs => qzs.map((qz, i) => i === qi
      ? { ...qz, questions: qz.questions.map((q, j) => j === qqi ? { ...q, text: val } : q) }
      : qz))

  const updOption = (qi: number, qqi: number, oi: number, val: string) =>
    setQuizzes(qzs => qzs.map((qz, i) => i === qi
      ? { ...qz, questions: qz.questions.map((q, j) => j === qqi
          ? { ...q, options: q.options.map((o, k) => k === oi ? { ...o, text: val } : o) }
          : q) }
      : qz))

  const setCorrect = (qi: number, qqi: number, oi: number) =>
    setQuizzes(qzs => qzs.map((qz, i) => i === qi
      ? { ...qz, questions: qz.questions.map((q, j) => j === qqi
          ? { ...q, options: q.options.map((o, k) => ({ ...o, is_correct: k === oi })) }
          : q) }
      : qz))

  const addOption = (qi: number, qqi: number) =>
    setQuizzes(qzs => qzs.map((qz, i) => i === qi
      ? { ...qz, questions: qz.questions.map((q, j) => j === qqi ? { ...q, options: [...q.options, newOpt()] } : q) }
      : qz))

  const removeQuestion = (qi: number, qqi: number) =>
    setQuizzes(qzs => qzs.map((qz, i) => i === qi
      ? { ...qz, questions: qz.questions.filter((_, j) => j !== qqi) }
      : qz))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{courseId ? 'Edit Course' : 'New Accreditation Course'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Step {step} of 2 — {step === 1 ? 'Course Details' : 'Build Quiz Questions'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>

        {step === 1 && (
          <form className="p-6 space-y-4 overflow-y-auto" onSubmit={e => { e.preventDefault(); setStep(2) }}>
            <div>
              <label className="label">Course Title *</label>
              <input required className="input" value={basics.title}
                onChange={e => setBasics(b => ({ ...b, title: e.target.value }))}
                placeholder="e.g. HIPAA Compliance Accreditation" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea rows={3} className="input" value={basics.description}
                onChange={e => setBasics(b => ({ ...b, description: e.target.value }))}
                placeholder="What will participants learn and be tested on?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Pass Threshold (%)</label>
                <input type="number" min={0} max={100} className="input" value={basics.pass_threshold}
                  onChange={e => setBasics(b => ({ ...b, pass_threshold: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Certificate Validity (days)</label>
                <input type="number" min={1} className="input" value={basics.validity_days}
                  onChange={e => setBasics(b => ({ ...b, validity_days: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary">Next: Add Questions →</button>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {quizzes.map((qz, qi) => (
                <div key={qi} className="border border-gray-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <input className="input flex-1" placeholder="Quiz / Section title" value={qz.title}
                      onChange={e => updQuiz(qi, 'title', e.target.value)} />
                    <input type="number" min={1} className="input w-32" placeholder="Time limit (min)"
                      value={qz.time_limit} onChange={e => updQuiz(qi, 'time_limit', e.target.value)}
                      title="Optional time limit in minutes" />
                    {quizzes.length > 1 && (
                      <button onClick={() => setQuizzes(qzs => qzs.filter((_, i) => i !== qi))}
                        className="p-1.5 hover:bg-red-50 text-red-400 rounded flex-shrink-0">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {qz.questions.map((q, qqi) => (
                    <div key={qqi} className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-gray-400 pt-2.5 w-5 flex-shrink-0">Q{qqi + 1}</span>
                        <input className="input flex-1" placeholder="Question text" value={q.text}
                          onChange={e => updQuestion(qi, qqi, e.target.value)} />
                        {qz.questions.length > 1 && (
                          <button onClick={() => removeQuestion(qi, qqi)}
                            className="p-1.5 hover:bg-red-50 text-red-400 rounded mt-1 flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="ml-7 space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input type="radio" name={`correct-${qi}-${qqi}`} checked={opt.is_correct}
                              onChange={() => setCorrect(qi, qqi, oi)}
                              className="accent-brand-600 flex-shrink-0" title="Mark as correct answer" />
                            <input className="input flex-1 text-sm py-1.5" placeholder={`Option ${oi + 1}`}
                              value={opt.text} onChange={e => updOption(qi, qqi, oi, e.target.value)} />
                          </div>
                        ))}
                        <p className="text-xs text-gray-400 ml-5">Select the radio button next to the correct answer</p>
                        <button type="button" className="text-xs text-brand-600 hover:underline ml-5"
                          onClick={() => addOption(qi, qqi)}>+ Add option</button>
                      </div>
                    </div>
                  ))}

                  <button type="button" className="btn-secondary text-sm py-1.5"
                    onClick={() => setQuizzes(qzs => qzs.map((qz2, i) => i === qi
                      ? { ...qz2, questions: [...qz2.questions, newQuestion()] } : qz2))}>
                    <Plus size={14} /> Add Question
                  </button>
                </div>
              ))}

              <button type="button" className="btn-secondary w-full"
                onClick={() => setQuizzes(qzs => [...qzs, newQuiz(qzs.length + 1)])}>
                <Plus size={14} /> Add Another Quiz Section
              </button>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
              <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn-primary" onClick={submit} disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : courseId ? 'Save Changes' : 'Create Course'}
              </button>
            </div>
          </>
        )}
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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Generate Certification Link</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
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
              <option value="">Select a course…</option>
              {(courses ?? []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div><label className="label">Assign to Email (optional)</label>
            <input type="email" className="input" value={form.assigned_email}
              onChange={e => setForm(f => ({ ...f, assigned_email: e.target.value }))}
              placeholder="Leave blank for a public link" />
          </div>
          <div><label className="label">Participant Name (optional)</label>
            <input className="input" value={form.assigned_name}
              onChange={e => setForm(f => ({ ...f, assigned_name: e.target.value }))} />
          </div>
          <div><label className="label">Expires in (days, optional)</label>
            <input type="number" min={1} className="input" value={form.expires_days}
              onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))} placeholder="e.g. 30" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Generating…' : 'Generate & Copy Link'}
            </button>
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
  const [editingId, setEditingId] = useState<number | undefined>()

  const deleteCourse = useMutation({
    mutationFn: (id: number) => api.delete(`/certifications/courses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); toast.success('Course deleted') },
    onError: (e: any) => toast.error(apiError(e)),
  })

  const { data: courses, isLoading: loadingCourses } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () => api.get('/certifications/courses').then(r => r.data),
  })
  const { data: links } = useQuery<CertificationLink[]>({
    queryKey: ['cert-links'],
    queryFn: () => api.get('/certifications/links').then(r => r.data),
    enabled: tab === 'links' && user?.role === 'admin',
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
        <h1 className="text-2xl font-bold text-gray-900">Accreditation &amp; Certifications</h1>
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <strong>How it works:</strong> Create a course with quiz questions → Generate a shareable link → Share with your team → They complete the quiz and automatically receive a downloadable certificate if they pass.
      </div>

      <div className="flex gap-2">
        {(['courses', ...(isAdmin ? ['links'] : []), 'completions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
            {t}
          </button>
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
                  <p className="text-xs text-gray-500 mt-0.5">{c.quiz_count} quiz section{c.quiz_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {c.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{c.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>Pass: {c.pass_threshold}%</span>
                <span>·</span>
                <span>Valid: {c.validity_days}d</span>
              </div>
              {isAdmin && (
                <div className="mt-3 flex gap-1.5">
                  <button className="btn-secondary text-xs py-1.5 flex-1 justify-center"
                    onClick={() => setEditingId(c.id)}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button className="btn-secondary text-xs py-1.5 flex-1 justify-center"
                    onClick={() => setShowNewLink(true)}>
                    <Copy size={12} /> Link
                  </button>
                  <button className="btn-secondary text-xs py-1.5 flex-1 justify-center text-red-500 hover:bg-red-50"
                    onClick={() => { if (confirm(`Delete "${c.title}"?`)) deleteCourse.mutate(c.id) }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loadingCourses && (courses?.length ?? 0) === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Award size={40} className="mx-auto mb-3 opacity-30" />
              <p>No courses yet. Create your first accreditation course.</p>
            </div>
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
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {(links ?? []).map(lnk => (
                <tr key={lnk.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{lnk.course_title}</td>
                  <td className="py-3 px-4 text-gray-500">{lnk.assigned_email || <span className="text-gray-300">Public link</span>}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {lnk.expires_at ? new Date(lnk.expires_at).toLocaleDateString() : <span className="text-gray-300">Never</span>}
                  </td>
                  <td className="py-3 px-4">{lnk.completions}</td>
                  <td className="py-3 px-4">
                    {lnk.is_active
                      ? <span className="badge bg-green-100 text-green-800">Active</span>
                      : <span className="badge bg-gray-100 text-gray-600">Inactive</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button title="Copy link" className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/certify/${lnk.token}`); toast.success('Copied!') }}>
                        <Copy size={14} />
                      </button>
                      <a href={`${window.location.origin}/certify/${lnk.token}`} target="_blank" rel="noopener"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500 inline-flex">
                        <ExternalLink size={14} />
                      </a>
                      {lnk.assigned_email && (
                        <button title="Send reminder email" className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                          onClick={() => remind.mutate(lnk.id)}>
                          <Bell size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(links?.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No links generated yet. Create a course first, then generate a link.</td></tr>
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
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {(completions ?? []).map(cert => (
                <tr key={cert.id} className="border-b border-gray-100 hover:bg-gray-50">
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
                        className="p-1.5 hover:bg-green-50 rounded text-green-600 inline-flex" title="Download certificate">
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
      {editingId && <NewCourseModal courseId={editingId} onClose={() => setEditingId(undefined)} />}
      {showNewLink && <GenerateLinkModal onClose={() => setShowNewLink(false)} />}
    </div>
  )
}
