import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  FolderOpen, Upload, Search, Trash2, Download, History,
  FileText, File, X, Plus, Tag, RefreshCw
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

interface HubDocument {
  id: number
  title: string
  description?: string
  category?: string
  tags?: string
  current_version: number
  file_url: string
  file_name: string
  file_size?: number
  uploader_name?: string
  created_at?: string
  updated_at?: string
  version_count: number
  versions?: Array<{
    version_number: number
    file_url: string
    file_name: string
    change_notes?: string
    uploader_name?: string
    created_at?: string
  }>
}

const CATEGORIES = [
  'Clinical Protocol', 'HR Policy', 'Safety Procedure', 'OSHA', 'HIPAA',
  'Quality Assurance', 'Operations', 'Training Material', 'Form / Template', 'Other',
]

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext ?? '')) return '📄'
  if (['doc', 'docx'].includes(ext ?? '')) return '📝'
  if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
  if (['ppt', 'pptx'].includes(ext ?? '')) return '📑'
  if (['jpg', 'jpeg', 'png'].includes(ext ?? '')) return '🖼️'
  return '📁'
}

function UploadModal({ doc, onClose }: { doc?: HubDocument; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState(doc?.title ?? '')
  const [description, setDescription] = useState(doc?.description ?? '')
  const [category, setCategory] = useState(doc?.category ?? '')
  const [tags, setTags] = useState(doc?.tags ?? '')
  const [changeNotes, setChangeNotes] = useState('')
  const isNewVersion = !!doc

  const upload = useMutation({
    mutationFn: async () => {
      if (!file && !isNewVersion) throw new Error('File required')
      if (!title.trim()) throw new Error('Title required')
      if (isNewVersion && file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('change_notes', changeNotes)
        await api.post(`/document-hub/${doc!.id}/new-version`, fd)
      } else if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('title', title)
        fd.append('description', description)
        fd.append('category', category)
        fd.append('tags', tags)
        await api.post('/document-hub', fd)
      }
    },
    onSuccess: () => { toast.success(isNewVersion ? 'New version uploaded' : 'Document uploaded'); qc.invalidateQueries({ queryKey: ['documents'] }); onClose() },
    onError: (e: any) => toast.error(e?.message || 'Upload failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNewVersion ? `New Version — ${doc!.title}` : 'Upload Document'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">{file ? file.name : 'Click or drag a file here'}</p>
          <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, PowerPoint, Image</p>
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>

        {isNewVersion ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Change Notes</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2}
              value={changeNotes} onChange={e => setChangeNotes(e.target.value)}
              placeholder="What changed in this version?" />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">— None —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="OSHA, urgent care" value={tags} onChange={e => setTags(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => upload.mutate()} disabled={upload.isPending || (!file && !isNewVersion)}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60 flex items-center gap-2">
            <Upload size={14} />
            {upload.isPending ? 'Uploading…' : isNewVersion ? 'Upload New Version' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

function VersionModal({ doc, onClose }: { doc: HubDocument; onClose: () => void }) {
  const { data: detail } = useQuery<HubDocument>({
    queryKey: ['document', doc.id],
    queryFn: () => api.get(`/document-hub/${doc.id}`).then(r => r.data),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
            <p className="text-sm text-gray-500">{doc.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {(detail?.versions ?? []).map(v => (
            <div key={v.version_number} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div>
                <p className="text-sm font-semibold text-gray-800">Version {v.version_number}</p>
                {v.change_notes && <p className="text-xs text-gray-500 mt-0.5">{v.change_notes}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  {v.uploader_name} · {v.created_at ? new Date(v.created_at).toLocaleDateString() : ''}
                </p>
              </div>
              <a href={v.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 rounded">
                <Download size={12} /> Download
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DocumentHubPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [newVersionDoc, setNewVersionDoc] = useState<HubDocument | undefined>()
  const [versionDoc, setVersionDoc] = useState<HubDocument | undefined>()

  const { data: documents = [], isLoading } = useQuery<HubDocument[]>({
    queryKey: ['documents', catFilter, search],
    queryFn: () => api.get('/document-hub', { params: { category: catFilter || undefined, search: search || undefined } }).then(r => r.data),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/document-hub/${id}`),
    onSuccess: () => { toast.success('Archived'); qc.invalidateQueries({ queryKey: ['documents'] }) },
    onError: () => toast.error('Failed to archive'),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen className="text-brand-600" size={26} /> Document Hub
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">SOPs, protocols, forms, and reference documents.</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
          <Upload size={16} /> Upload Document
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" /></div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No documents yet</p>
          <p className="text-sm mt-1">Upload your SOPs, protocols, and forms to build your document library.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{fileIcon(d.file_name)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{d.title}</h3>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {d.category && (
                          <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs">{d.category}</span>
                        )}
                        <span className="text-xs text-gray-400">v{d.current_version}</span>
                        {d.file_size && <span className="text-xs text-gray-400">{formatBytes(d.file_size)}</span>}
                      </div>
                    </div>
                  </div>
                  {d.description && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{d.description}</p>}
                  {d.tags && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Tag size={10} className="text-gray-400" />
                      <span className="text-xs text-gray-400">{d.tags}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">
                    Uploaded by {d.uploader_name} · {d.updated_at ? new Date(d.updated_at).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg text-xs font-medium hover:bg-brand-100">
                  <Download size={13} /> Download
                </a>
                {d.version_count > 1 && (
                  <button onClick={() => setVersionDoc(d)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100">
                    <History size={13} /> {d.version_count} versions
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button onClick={() => setNewVersionDoc(d)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 ml-auto">
                      <RefreshCw size={13} /> New Version
                    </button>
                    <button onClick={() => { if (confirm('Archive this document?')) del.mutate(d.id) }}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {newVersionDoc && <UploadModal doc={newVersionDoc} onClose={() => setNewVersionDoc(undefined)} />}
      {versionDoc && <VersionModal doc={versionDoc} onClose={() => setVersionDoc(undefined)} />}
    </div>
  )
}
