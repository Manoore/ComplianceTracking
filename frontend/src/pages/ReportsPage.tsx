import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'

export function ReportsPage() {
  const { data: trends } = useQuery({
    queryKey: ['compliance-trends'],
    queryFn: () => api.get('/reports/compliance-trends').then(r => r.data),
  })

  const handleExport = async (resource: string) => {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['inspections', 'actions', 'certifications'].map(r => (
          <button key={r} onClick={() => handleExport(r)}
            className="card flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left">
            <div className="p-2 bg-brand-50 rounded-lg">
              <Download className="text-brand-600" size={20} />
            </div>
            <div>
              <p className="font-medium text-gray-900 capitalize">Export {r}</p>
              <p className="text-xs text-gray-400">Download CSV</p>
            </div>
          </button>
        ))}
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
