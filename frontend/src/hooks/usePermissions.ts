import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from './useAuth'

const FALLBACK: Record<string, string[]> = {
  admin: ['dashboard', 'clinics', 'checklists', 'inspections', 'audits', 'certifications',
          'corrective_actions', 'policies', 'executive', 'departments', 'credentials',
          'document_hub', 'standards', 'announcements', 'reports', 'users', 'roles', 'settings'],
  manager: ['dashboard', 'clinics', 'inspections', 'audits', 'certifications', 'corrective_actions',
            'policies', 'executive', 'departments', 'credentials', 'document_hub', 'standards', 'announcements'],
  auditor: ['dashboard', 'clinics', 'inspections', 'audits', 'certifications', 'corrective_actions',
            'policies', 'executive', 'credentials', 'document_hub', 'standards', 'announcements', 'reports'],
  team_member: ['dashboard', 'inspections', 'certifications', 'corrective_actions', 'policies',
                'credentials', 'document_hub', 'announcements'],
}

export function usePermissions() {
  const { user } = useAuth()

  const { data } = useQuery<{ role: string; modules: string[] }>({
    queryKey: ['my-permissions'],
    queryFn: () => api.get('/roles/my-permissions').then(r => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const modules = data?.modules ?? FALLBACK[user?.role ?? ''] ?? ['dashboard']

  return {
    canView: (module: string) => modules.includes(module),
    modules,
  }
}
