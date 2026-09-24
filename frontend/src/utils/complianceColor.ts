import type { ComplianceThresholds } from '../hooks/useComplianceThresholds'

// Single source of truth for how a compliance score (0-100) maps to green/amber/red,
// matching the legend on the Enterprise Compliance Report (and the source spreadsheet
// it was built from). Every score display should use these instead of its own hardcoded
// cutoffs, so a score reads the same color everywhere in the app.

export function scoreTextClass(score: number | null | undefined, t: ComplianceThresholds): string {
  if (score == null) return 'text-gray-400'
  if (score >= t.green) return 'text-green-600'
  if (score >= t.amber) return 'text-amber-600'
  return 'text-red-600'
}

// Soft badge/cell style: bg + text pair, for table cells and pills.
export function scoreBandClass(score: number | null | undefined, t: ComplianceThresholds): string {
  if (score == null) return 'text-gray-300'
  if (score >= t.green) return 'bg-green-50 text-green-700'
  if (score >= t.amber) return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

// Just the soft background, for KPI tiles that pair it with their own icon color.
export function scoreSoftBgClass(score: number | null | undefined, t: ComplianceThresholds): string {
  if (score == null) return 'bg-gray-50'
  if (score >= t.green) return 'bg-green-50'
  if (score >= t.amber) return 'bg-amber-50'
  return 'bg-red-50'
}

// Solid fill, for progress bars.
export function scoreSolidBgClass(score: number | null | undefined, t: ComplianceThresholds): string {
  if (score == null) return 'bg-gray-300'
  if (score >= t.green) return 'bg-green-500'
  if (score >= t.amber) return 'bg-amber-500'
  return 'bg-red-500'
}

// Hex, for SVG/canvas/recharts and inline styles where a Tailwind class won't apply.
export function scoreHex(score: number | null | undefined, t: ComplianceThresholds): string {
  if (score == null) return '#94a3b8'
  if (score >= t.green) return '#16a34a'
  if (score >= t.amber) return '#d97706'
  return '#dc2626'
}
