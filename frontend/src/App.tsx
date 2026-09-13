import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePermissions } from './hooks/usePermissions'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClinicsPage } from './pages/ClinicsPage'
import { ClinicProfilePage } from './pages/ClinicProfilePage'
import { ChecklistsPage } from './pages/ChecklistsPage'
import { InspectionsPage } from './pages/InspectionsPage'
import { InspectionDetailPage } from './pages/InspectionDetailPage'
import { AuditsPage } from './pages/AuditsPage'
import { CertificationsPage } from './pages/CertificationsPage'
import { TakeCertificationPage } from './pages/TakeCertificationPage'
import { VerifyCertificatePage } from './pages/VerifyCertificatePage'
import { CorrectiveActionsPage } from './pages/CorrectiveActionsPage'
import { ReportsPage } from './pages/ReportsPage'
import { UsersPage } from './pages/UsersPage'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { RolesPage } from './pages/RolesPage'
import { RegisterPage } from './pages/RegisterPage'
import { SuperAdminLoginPage } from './pages/SuperAdminLoginPage'
import { SuperAdminDashboardPage } from './pages/SuperAdminDashboardPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ProfilePage } from './pages/ProfilePage'
import { PoliciesPage } from './pages/PoliciesPage'
import { ExecutiveDashboardPage } from './pages/ExecutiveDashboardPage'
import { DepartmentsPage } from './pages/DepartmentsPage'
import { CredentialsPage } from './pages/CredentialsPage'
import { DocumentHubPage } from './pages/DocumentHubPage'
import { StandardsPage } from './pages/StandardsPage'
import { NotFoundPage } from './pages/NotFoundPage'

function SuperAdminPrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('sa_access_token')
  if (!token) return <Navigate to="/superadmin/login" replace />
  return <>{children}</>
}

function PrivateRoute({ children, roles, module }: { children: React.ReactNode; roles?: string[]; module?: string }) {
  const { user, loading } = useAuth()
  const { canView, isLoading: permissionsLoading } = usePermissions()
  // A custom role (Clinic Lead, Regional Manager, ...) always has its base `role` forced to
  // team_member, so the `roles` array alone would lock these users out. `module` checks what
  // their custom role was actually granted in Roles & Permissions instead -- either path in.
  // Until that real permissions data has loaded, canView() falls back to a base-role-only
  // guess that's wrong for exactly these users -- wait for it rather than redirect on a
  // guess that's about to be replaced by the real answer.
  const allowedByBaseRole = !roles || roles.includes(user?.role ?? '')
  if (loading || (!!module && !allowedByBaseRole && permissionsLoading)) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
  )
  if (!user) return <Navigate to="/home" replace />
  const allowedByModule = !!module && canView(module)
  if (roles && !allowedByBaseRole && !allowedByModule) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/home" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
      <Route path="/superadmin/dashboard" element={<SuperAdminPrivateRoute><SuperAdminDashboardPage /></SuperAdminPrivateRoute>} />
      <Route path="/certify/:token" element={<TakeCertificationPage />} />
      <Route path="/verify/:certId" element={<VerifyCertificatePage />} />

      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="clinics" element={<ClinicsPage />} />
        <Route path="clinics/:id/profile" element={<ClinicProfilePage />} />
        <Route path="checklists" element={<PrivateRoute roles={['admin']}><ChecklistsPage /></PrivateRoute>} />
        <Route path="inspections" element={<InspectionsPage />} />
        <Route path="inspections/:id" element={<InspectionDetailPage />} />
        <Route path="audits" element={<PrivateRoute roles={['admin', 'auditor', 'manager']} module="audits"><AuditsPage /></PrivateRoute>} />
        <Route path="certifications" element={<CertificationsPage />} />
        <Route path="corrective-actions" element={<CorrectiveActionsPage />} />
        <Route path="reports" element={<PrivateRoute roles={['admin', 'auditor']} module="reports"><ReportsPage /></PrivateRoute>} />
        <Route path="users" element={<PrivateRoute roles={['admin']}><UsersPage /></PrivateRoute>} />
        <Route path="roles" element={<PrivateRoute roles={['admin']}><RolesPage /></PrivateRoute>} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="executive" element={<PrivateRoute roles={['admin', 'manager', 'auditor']} module="executive"><ExecutiveDashboardPage /></PrivateRoute>} />
        <Route path="departments" element={<PrivateRoute roles={['admin', 'manager']}><DepartmentsPage /></PrivateRoute>} />
        <Route path="credentials" element={<CredentialsPage />} />
        <Route path="document-hub" element={<DocumentHubPage />} />
        <Route path="standards" element={<PrivateRoute roles={['admin', 'manager', 'auditor']}><StandardsPage /></PrivateRoute>} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="settings" element={<PrivateRoute roles={['admin']}><SettingsPage /></PrivateRoute>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
