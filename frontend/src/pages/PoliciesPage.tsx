import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  FileText, Plus, Eye, CheckCircle, Clock, AlertCircle,
  Send, Pencil, Trash2, Users, ChevronRight, BookOpen, X, Check
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { PolicyDocument, PolicyAttestation, QuizQuestion } from '../types'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'team_member', label: 'Team Member' },
]

const CATEGORIES = ['HR', 'Safety', 'OSHA', 'HIPAA', 'Clinical', 'Operations', 'Quality', 'IT', 'Finance', 'Other']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-800' },
    read: { label: 'Read', cls: 'bg-blue-100 text-blue-800' },
    signed: { label: 'Signed', cls: 'bg-green-100 text-green-800' },
    quiz_failed: { label: 'Quiz Failed', cls: 'bg-red-100 text-red-800' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>
}

interface PolicyFormState {
  title: string
  description: string
  content: string
  version: string
  category: string
  target_roles: string[]
  requires_quiz: boolean
  pass_threshold: number
  effective_date: string
  quiz_questions: QuizQuestion[]
}

const emptyForm = (): PolicyFormState => ({
  title: '',
  description: '',
  content: '',
  version: '1.0',
  category: '',
  target_roles: [],
  requires_quiz: false,
  pass_threshold: 80,
  effective_date: '',
  quiz_questions: [],
})

function QuizEditor({ questions, onChange }: {
  questions: QuizQuestion[]
  onChange: (q: QuizQuestion[]) => void
}) {
  const addQ = () => onChange([...questions, { question: '', options: ['', ''], answer_index: 0 }])
  const removeQ = (i: number) => onChange(questions.filter((_, idx) => idx !== i))
  const updateQ = (i: number, q: QuizQuestion) => onChange(questions.map((old, idx) => idx === i ? q : old))
  const addOption = (qi: number) => {
    const q = { ...questions[qi], options: [...questions[qi].options, ''] }
    updateQ(qi, q)
  }
  const removeOption = (qi: number, oi: number) => {
    const q = { ...questions[qi], options: questions[qi].options.filter((_, idx) => idx !== oi) }
    updateQ(qi, { ...q, answer_index: Math.min(q.answer_index, q.options.length - 1) })
  }

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => (
        <div key={qi} className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Question {qi + 1}</span>
            <button onClick={() => removeQ(qi)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
          </div>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Question text"
            value={q.question}
            onChange={e => updateQ(qi, { ...q, question: e.target.value })}
          />
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.answer_index === oi}
                  onChange={() => updateQ(qi, { ...q, answer_index: oi })}
                  className="text-brand-600"
                />
                <input
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
                  placeholder={`Option ${oi + 1}`}
                  value={opt}
                  onChange={e => {
                    const opts = [...q.options]
                    opts[oi] = e.target.value
                    updateQ(qi, { ...q, options: opts })
                  }}
                />
                {q.options.length > 2 && (
                  <button onClick={() => removeOption(qi, oi)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                )}
              </div>
            ))}
            <button onClick={() => addOption(qi)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              + Add option
            </button>
          </div>
          <p className="text-xs text-gray-500">Select the radio button next to the correct answer.</p>
        </div>
      ))}
      <button
        onClick={addQ}
        className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
      >
        <Plus size={14} /> Add question
      </button>
    </div>
  )
}

function PolicyModal({ policy, onClose }: {
  policy?: PolicyDocument
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<PolicyFormState>(policy ? {
    title: policy.title,
    description: policy.description ?? '',
    content: policy.content,
    version: policy.version,
    category: policy.category ?? '',
    target_roles: policy.target_roles,
    requires_quiz: policy.requires_quiz,
    pass_threshold: policy.pass_threshold,
    effective_date: policy.effective_date ? policy.effective_date.split('T')[0] : '',
    quiz_questions: policy.quiz_questions ?? [],
  } : emptyForm())

  const save = useMutation({
    mutationFn: (data: object) => policy
      ? api.put(`/policies/${policy.id}`, data).then(r => r.data)
      : api.post('/policies', data).then(r => r.data),
    onSuccess: () => {
      toast.success(policy ? 'Policy updated' : 'Policy created')
      qc.invalidateQueries({ queryKey: ['policies'] })
      onClose()
    },
    onError: () => toast.error('Failed to save policy'),
  })

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter(r => r !== role)
        : [...f.target_roles, role],
    }))
  }

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required')
      return
    }
    save.mutate({
      ...form,
      quiz_questions: form.requires_quiz ? form.quiz_questions : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{policy ? 'Edit Policy' : 'New Policy'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">— Select —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.effective_date}
                onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Brief summary shown in policy list"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Policy Content *</label>
            <textarea
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="Full policy text. Markdown supported."
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Who must read this?</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => toggleRole(r.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    form.target_roles.includes(r.value)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                  }`}
                >
                  {r.label}
                </button>
              ))}
              {form.target_roles.length === 0 && (
                <span className="text-xs text-gray-500 self-center ml-1">No roles selected = everyone</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="requires_quiz"
              checked={form.requires_quiz}
              onChange={e => setForm(f => ({ ...f, requires_quiz: e.target.checked }))}
              className="mt-0.5"
            />
            <div>
              <label htmlFor="requires_quiz" className="text-sm font-medium text-gray-700 cursor-pointer">
                Require comprehension quiz to complete
              </label>
              <p className="text-xs text-gray-500 mt-0.5">Users must pass the quiz to mark the policy as signed.</p>
            </div>
          </div>

          {form.requires_quiz && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Pass threshold</label>
                <input
                  type="number"
                  min={0} max={100}
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                  value={form.pass_threshold}
                  onChange={e => setForm(f => ({ ...f, pass_threshold: parseInt(e.target.value) || 80 }))}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <QuizEditor
                questions={form.quiz_questions}
                onChange={q => setForm(f => ({ ...f, quiz_questions: q }))}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={save.isPending}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60"
          >
            {save.isPending ? 'Saving…' : 'Save Policy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AttestationModal({ policy, onClose }: { policy: PolicyDocument; onClose: () => void }) {
  const { data: attestations, isLoading } = useQuery<PolicyAttestation[]>({
    queryKey: ['policy-attestations', policy.id],
    queryFn: () => api.get(`/policies/${policy.id}/attestations`).then(r => r.data),
  })

  const pending = attestations?.filter(a => a.status === 'pending') ?? []
  const read = attestations?.filter(a => a.status === 'read') ?? []
  const signed = attestations?.filter(a => a.status === 'signed') ?? []
  const failed = attestations?.filter(a => a.status === 'quiz_failed') ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Attestation Status</h2>
            <p className="text-sm text-gray-500">{policy.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Signed', items: signed, icon: CheckCircle, color: 'text-green-600' },
                { label: 'Read (not signed)', items: read, icon: Eye, color: 'text-blue-600' },
                { label: 'Quiz Failed', items: failed, icon: AlertCircle, color: 'text-red-600' },
                { label: 'Pending (not opened)', items: pending, icon: Clock, color: 'text-yellow-600' },
              ].map(({ label, items, icon: Icon, color }) => items.length > 0 && (
                <div key={label}>
                  <div className={`flex items-center gap-2 mb-2 ${color}`}>
                    <Icon size={16} />
                    <span className="text-sm font-semibold">{label} ({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{a.user_name}</span>
                          <span className="text-gray-400 text-xs ml-2">{a.user_email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {a.quiz_score !== null && a.quiz_score !== undefined && (
                            <span className="text-xs text-gray-500">Quiz: {a.quiz_score.toFixed(0)}%</span>
                          )}
                          {a.signed_at && (
                            <span className="text-xs text-gray-400">{new Date(a.signed_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(!attestations || attestations.length === 0) && (
                <p className="text-gray-500 text-sm text-center py-8">No attestations yet. Publish to assign users.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReadPolicyModal({ policy, onClose }: { policy: PolicyDocument; onClose: () => void }) {
  const qc = useQueryClient()
  const [answers, setAnswers] = useState<number[]>(
    (policy.quiz_questions ?? []).map(() => -1)
  )
  const [quizResult, setQuizResult] = useState<{ status: string; score?: number } | null>(null)

  const acknowledge = useMutation({
    mutationFn: (payload: { quiz_answers?: number[] }) =>
      api.post(`/policies/${policy.id}/acknowledge`, payload).then(r => r.data),
    onSuccess: (data) => {
      if (data.status === 'quiz_failed') {
        setQuizResult(data)
        toast.error(`Quiz failed — ${data.score?.toFixed(0)}% (need ${policy.pass_threshold}%)`)
      } else {
        toast.success('Policy acknowledged!')
        qc.invalidateQueries({ queryKey: ['policies'] })
        onClose()
      }
    },
    onError: () => toast.error('Failed to acknowledge'),
  })

  const myStatus = policy.my_attestation?.status
  const alreadySigned = myStatus === 'signed'

  const handleSign = () => {
    if (policy.requires_quiz) {
      if (answers.some(a => a === -1)) {
        toast.error('Please answer all questions')
        return
      }
      acknowledge.mutate({ quiz_answers: answers })
    } else {
      acknowledge.mutate({})
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{policy.title}</h2>
            <p className="text-sm text-gray-500">Version {policy.version}{policy.category ? ` · ${policy.category}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {policy.description && (
            <p className="text-sm text-gray-600 italic border-l-4 border-brand-300 pl-3">{policy.description}</p>
          )}

          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
            {policy.content}
          </div>

          {policy.requires_quiz && !alreadySigned && (
            <div className="border-t border-gray-200 pt-4 space-y-5">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen size={16} className="text-brand-600" /> Comprehension Quiz
              </h3>
              {quizResult?.status === 'quiz_failed' && (
                <div className="bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
                  You scored {quizResult.score?.toFixed(0)}%. Need {policy.pass_threshold}% to pass. Review the policy and try again.
                </div>
              )}
              {(policy.quiz_questions ?? []).map((q, qi) => (
                <div key={qi} className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">{qi + 1}. {q.question}</p>
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input
                        type="radio"
                        name={`q${qi}`}
                        checked={answers[qi] === oi}
                        onChange={() => setAnswers(a => { const n = [...a]; n[qi] = oi; return n })}
                        className="text-brand-600"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div>
            {alreadySigned && (
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                <CheckCircle size={16} /> Signed on {policy.my_attestation?.signed_at ? new Date(policy.my_attestation.signed_at).toLocaleDateString() : ''}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Close
            </button>
            {!alreadySigned && (
              <button
                onClick={handleSign}
                disabled={acknowledge.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60 flex items-center gap-2"
              >
                <Check size={16} />
                {policy.requires_quiz ? 'Submit & Sign' : 'I have read and acknowledge'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PoliciesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const [showModal, setShowModal] = useState(false)
  const [editPolicy, setEditPolicy] = useState<PolicyDocument | undefined>()
  const [viewPolicy, setViewPolicy] = useState<PolicyDocument | undefined>()
  const [attPolicy, setAttPolicy] = useState<PolicyDocument | undefined>()
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('my')

  const { data: policies = [], isLoading } = useQuery<PolicyDocument[]>({
    queryKey: ['policies'],
    queryFn: () => api.get('/policies').then(r => r.data),
  })

  const publish = useMutation({
    mutationFn: (id: number) => api.post(`/policies/${id}/publish`).then(r => r.data),
    onSuccess: () => { toast.success('Policy published and users notified'); qc.invalidateQueries({ queryKey: ['policies'] }) },
    onError: () => toast.error('Failed to publish'),
  })

  const unpublish = useMutation({
    mutationFn: (id: number) => api.post(`/policies/${id}/unpublish`).then(r => r.data),
    onSuccess: () => { toast.success('Policy unpublished'); qc.invalidateQueries({ queryKey: ['policies'] }) },
    onError: () => toast.error('Failed to unpublish'),
  })

  const archive = useMutation({
    mutationFn: (id: number) => api.delete(`/policies/${id}`).then(r => r.data),
    onSuccess: () => { toast.success('Policy archived'); qc.invalidateQueries({ queryKey: ['policies'] }) },
    onError: () => toast.error('Failed to archive'),
  })

  const myPolicies = policies.filter(p => p.is_published)
  const allPolicies = policies

  const displayList = isAdmin && activeTab === 'all' ? allPolicies : myPolicies

  const pendingMine = myPolicies.filter(p => p.my_attestation?.status === 'pending' || !p.my_attestation).length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-brand-600" size={26} /> Policies & Acknowledgment
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Read, sign, and track policy compliance across your team.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditPolicy(undefined); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
          >
            <Plus size={16} /> New Policy
          </button>
        )}
      </div>

      {pendingMine > 0 && activeTab === 'my' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            You have <strong>{pendingMine}</strong> {pendingMine === 1 ? 'policy' : 'policies'} awaiting your acknowledgment.
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {([['my', 'My Policies'], ['all', 'All Policies']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" /></div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No policies yet</p>
          {isAdmin && <p className="text-sm mt-1">Create your first policy to get started.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map(p => {
            const myStatus = p.my_attestation?.status ?? (p.is_published ? 'pending' : null)
            const compliance = p.total_assigned > 0
              ? Math.round((p.signed_count / p.total_assigned) * 100)
              : null

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
                      <span className="text-xs text-gray-400">v{p.version}</span>
                      {p.category && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{p.category}</span>
                      )}
                      {!p.is_published && isAdmin && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">Draft</span>
                      )}
                      {myStatus && <StatusBadge status={myStatus} />}
                    </div>
                    {p.description && <p className="text-sm text-gray-500 mt-1">{p.description}</p>}

                    <div className="flex items-center gap-4 mt-2">
                      {isAdmin && compliance !== null && (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${compliance >= 80 ? 'bg-green-500' : compliance >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${compliance}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{compliance}% signed ({p.signed_count}/{p.total_assigned})</span>
                        </div>
                      )}
                      {p.effective_date && (
                        <span className="text-xs text-gray-400">Effective: {new Date(p.effective_date).toLocaleDateString()}</span>
                      )}
                      {p.requires_quiz && (
                        <span className="text-xs text-purple-600 flex items-center gap-1"><BookOpen size={12} /> Quiz required</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Team member: read button */}
                    {p.is_published && (
                      <button
                        onClick={() => setViewPolicy(p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          myStatus === 'signed'
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                        }`}
                      >
                        {myStatus === 'signed' ? <CheckCircle size={14} /> : <ChevronRight size={14} />}
                        {myStatus === 'signed' ? 'View' : 'Read & Sign'}
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        {!p.is_published ? (
                          <button
                            onClick={() => publish.mutate(p.id)}
                            disabled={publish.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
                          >
                            <Send size={14} /> Publish
                          </button>
                        ) : (
                          <button
                            onClick={() => unpublish.mutate(p.id)}
                            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          onClick={() => setAttPolicy(p)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                          title="View attestations"
                        >
                          <Users size={16} />
                        </button>
                        <button
                          onClick={() => { setEditPolicy(p); setShowModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Archive this policy?')) archive.mutate(p.id)
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Archive"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <PolicyModal
          policy={editPolicy}
          onClose={() => { setShowModal(false); setEditPolicy(undefined) }}
        />
      )}
      {viewPolicy && (
        <ReadPolicyModal
          policy={viewPolicy}
          onClose={() => setViewPolicy(undefined)}
        />
      )}
      {attPolicy && (
        <AttestationModal
          policy={attPolicy}
          onClose={() => setAttPolicy(undefined)}
        />
      )}
    </div>
  )
}
