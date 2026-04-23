import { clsx } from 'clsx'

interface BadgeProps {
  label: string
  variant?: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple'
}

const variantStyles = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800',
}

export function Badge({ label, variant = 'gray' }: BadgeProps) {
  return (
    <span className={clsx('badge', variantStyles[variant])}>
      {label}
    </span>
  )
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    draft: { label: 'Draft', variant: 'gray' },
    in_progress: { label: 'In Progress', variant: 'blue' },
    submitted: { label: 'Submitted', variant: 'yellow' },
    under_review: { label: 'Under Review', variant: 'purple' },
    approved: { label: 'Approved', variant: 'green' },
    rejected: { label: 'Rejected', variant: 'red' },
    open: { label: 'Open', variant: 'red' },
    resolved: { label: 'Resolved', variant: 'blue' },
    verified: { label: 'Verified', variant: 'green' },
    closed: { label: 'Closed', variant: 'gray' },
    completed: { label: 'Completed', variant: 'green' },
    failed: { label: 'Failed', variant: 'red' },
    not_started: { label: 'Not Started', variant: 'gray' },
    expired: { label: 'Expired', variant: 'yellow' },
    overdue: { label: 'Overdue', variant: 'red' },
    low: { label: 'Low Risk', variant: 'green' },
    medium: { label: 'Medium Risk', variant: 'yellow' },
    high: { label: 'High Risk', variant: 'red' },
    critical: { label: 'Critical', variant: 'red' },
  }
  const conf = map[status] || { label: status, variant: 'gray' as const }
  return <Badge label={conf.label} variant={conf.variant} />
}

export function priorityBadge(priority: string) {
  const map: Record<string, BadgeProps['variant']> = {
    low: 'green', medium: 'yellow', high: 'red', critical: 'red',
  }
  return <Badge label={priority.charAt(0).toUpperCase() + priority.slice(1)} variant={map[priority] || 'gray'} />
}
