// Custom roles created via Roles & Permissions that represent oversight positions in the
// Clinic Lead -> Regional Manager -> Director of Operations reporting chain. Anyone assigned
// one of these gets their base `role` forced to `team_member` (see backend users.py), so a
// plain `user.role === 'team_member'` check treats them as line staff by mistake -- use
// `hasOversight` instead anywhere that distinction matters (dashboards, checklist lists, etc).
export const HIERARCHY_ROLES = ['clinic_lead', 'regional_manager', 'director_of_operations', 'executive']

export function hasOversight(user: { role: string; custom_role?: string | null } | null | undefined): boolean {
  if (!user) return false
  if (user.role !== 'team_member') return true
  return !!user.custom_role && HIERARCHY_ROLES.includes(user.custom_role)
}
