import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from './useAuth'

export function usePermissions() {
  const { user } = useAuth()
  const { data } = useQuery<{ role: string; modules: string[] }>({
    queryKey: ['my-permissions'],
    queryFn: () => api.get('/roles/my-permissions').then(r => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
  return {
    canView: (module: string) => data?.modules.includes(module) ?? false,
    modules: data?.modules ?? [],
  }
}
