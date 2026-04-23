import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

const CSV_EXPORTS = [
  { resource: 'inspections', label: 'Inspections' },
  { resource: 'actions', label: 'Corrective Actions' },
  { resource: 'certifications', label: 'Certifications' },
]

const EXCEL_EXPORTS = [
  { resource: 'inspections', label: 'Inspections Report' },
  { resource: 'actions', label: 'Corrective Actions Report' },
  { resource: 'certifications', label: 'Certifications Report' },
  { resource: 'clinic_scorecard', label: 'Clinic Scorecard' },
]

export function ReportsPage() {
  const { data: trends } = useQuery({
    queryKey: ['compliance-trends'],
    queryFn: () => api.get('/reports/compliance-trends').then(r => r.data),
  })

  const handleCsvExport = async (resource: string) => {
    try {
      const response = await api.get(`/reports/export/csv?resource=${resource}`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resource}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  const handleExcelExport = async (resource: string) => {
    try {
      const response = await api.get(`/reports/export/excel?resource=${resource}`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resource}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel export downloaded')
    } catch {
      toast.error('Excel export failed')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Exports */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">CSV Exports</h2>
          </div>
          <div className="space-y-2">
            {CSV_EXPORTS.map(r => (
              <button key={r.resource} onClick={() => handleCsvExport(r.resource)}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-brand-300 transition-colors text-left">
                <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                  <Download className="text-gray-600" size={16} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{r.label}</p>
                  <p className="text-xs text-gray-400">Download as .csv</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Excel Exports */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet size={18} className="text-green-600" />
            <h2 className="text-base font-semibold text-gray-900">Excel Reports</h2>
          </div>
          <div className="space-y-2">
            {EXCEL_EXPORTS.map(r => (
              <button key={r.resource} onClick={() => handleExcelExport(r.resource)}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors text-left">
                <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                  <FileSpreadsheet className="text-green-600" size={16} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{r.label}</p>
                  <p className="text-xs text-gray-400">Download as .xlsx</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Compliance Score Over Time</h2>
        {(trends?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No inspection data available yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
              <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
