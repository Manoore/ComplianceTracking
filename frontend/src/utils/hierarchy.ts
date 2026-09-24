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

// Who a flag on a reviewer_only item escalates to -- the level ABOVE whoever's
// doing the reviewing right now, not their own level. A Clinic Lead's flag goes
// to the Regional Manager; a Regional Manager (or anyone above them) reviewing
// their own queue isn't meant to flag their own role, since that notification
// would just reach no one. Mirrors the backend's _notify_next_level_up.
export function escalationTarget(user: { role: string; custom_role?: string | null } | null | undefined): string {
  const customRole = (user?.custom_role ?? '').toLowerCase()
  if (customRole === 'clinic_lead' || user?.role === 'manager') return 'Regional Manager'
  return 'Leadership'
}
