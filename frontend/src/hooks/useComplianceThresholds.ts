import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

export interface ComplianceThresholds { green: number; amber: number }

// Matches the backend's OrgSettings defaults -- shown until the real value loads, so
// score colors never flash unstyled or wrong before the fetch resolves.
const DEFAULT_THRESHOLDS: ComplianceThresholds = { green: 90, amber: 80 }

// Admin-configurable in Settings; every score display in the app reads from here
// instead of hardcoding its own cutoffs, so a score means the same color everywhere.
export function useComplianceThresholds(): ComplianceThresholds {
  const { data } = useQuery<ComplianceThresholds>({
    queryKey: ['compliance-thresholds'],
    queryFn: () => api.get('/settings/compliance-thresholds').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  return data ?? DEFAULT_THRESHOLDS
}
