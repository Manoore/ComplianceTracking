import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useComplianceThresholds } from '../hooks/useComplianceThresholds'
import { scoreBandClass } from '../utils/complianceColor'

interface DayCell { score: number; inspection_id: number; count: number }
interface CalendarClinicRow {
  clinic_id: number
  clinic_name: string
  region: string | null
  days: Record<string, DayCell>
}
interface CalendarData {
  scope_label: string
  template: { id: number; name: string }
  year: number
  month: number
  days_in_month: number
  clinics: CalendarClinicRow[]
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function InspectionCalendarPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const thresholds = useComplianceThresholds()
  const now = new Date()
  // Arriving from a matrix cell scopes the view to the clinic that cell belonged to
  // (and, for a "3-Mo Avg" cell, to the start of that trailing window) -- otherwise
  // this defaults to every clinic, current month, same as clicking the column header.
  const highlightClinicId = searchParams.get('clinic_id') ? Number(searchParams.get('clinic_id')) : null
  const [year, setYear] = useState(() => {
    const y = searchParams.get('year')
    return y ? Number(y) : now.getFullYear()
  })
  const [month, setMonth] = useState(() => {
    const m = searchParams.get('month')
    return m ? Number(m) : now.getMonth() + 1
  })

  const { data, isLoading } = useQuery<CalendarData>({
    queryKey: ['inspection-calendar', templateId, year, month],
    queryFn: () => api.get('/reports/inspection-calendar', {
      params: { template_id: templateId, year, month },
    }).then(r => r.data),
  })

  const highlightedRowRef = useRef<HTMLTableRowElement>(null)
  useEffect(() => {
    if (highlightClinicId != null && data) {
      highlightedRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [highlightClinicId, data])

  const goToMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y += 1 }
    if (m < 1) { m = 12; y -= 1 }
    setMonth(m)
    setYear(y)
  }

  const daysInMonth = data?.days_in_month ?? new Date(year, month, 0).getDate()
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="text-brand-700" size={20} />
            {data?.template.name ?? 'Checklist'} — Inspection Wise Report
          </h1>
          {data?.scope_label && <p className="text-sm text-gray-500">{data.scope_label}</p>}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => goToMonth(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
              <ChevronLeft size={18} />
            </button>
            <span className="font-semibold text-gray-900 w-40 text-center">{MONTH_NAMES[month - 1]} {year}</span>
            <button onClick={() => goToMonth(1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> 90%+</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 80-89%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Below 80%</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : (data?.clinics.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No clinics in view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium sticky left-0 bg-white">Clinic</th>
                  {dayNumbers.map(d => (
                    <th key={d} className="py-2 px-1 text-gray-400 font-medium text-center w-9 min-w-[36px]">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.clinics.map(c => (
                  <tr key={c.clinic_id} ref={c.clinic_id === highlightClinicId ? highlightedRowRef : undefined}
                    className={`border-t border-gray-100 ${c.clinic_id === highlightClinicId ? 'bg-brand-50' : ''}`}>
                    <td className={`py-1.5 px-3 whitespace-nowrap sticky left-0 ${c.clinic_id === highlightClinicId ? 'bg-brand-50 font-semibold text-brand-800' : 'bg-white text-gray-800'}`}>{c.clinic_name}</td>
                    {dayNumbers.map(d => {
                      const cell = c.days[String(d)]
                      return (
                        <td key={d} className="p-0.5 text-center">
                          {cell ? (
                            <button
                              onClick={() => navigate(`/inspections/${cell.inspection_id}`)}
                              title={`${cell.score}%${cell.count > 1 ? ` (avg of ${cell.count} inspections)` : ''}`}
                              className={`w-8 h-8 rounded text-xs font-semibold hover:ring-2 hover:ring-brand-300 transition-shadow ${scoreBandClass(cell.score, thresholds)}`}>
                              {Math.round(cell.score)}
                            </button>
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-50" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link to="/executive" className="text-sm text-brand-700 hover:underline">← Back to Executive Dashboard</Link>
    </div>
  )
}
