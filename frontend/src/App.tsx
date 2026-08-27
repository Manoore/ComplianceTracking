import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
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

function SuperAdminPrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('sa_access_token')
  if (!token) return <Navigate to="/superadmin/login" replace />
  return <>{children}</>
}

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
  )
  if (!user) return <Navigate to="/home" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
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
        <Route path="audits" element={<PrivateRoute roles={['admin', 'auditor', 'manager']}><AuditsPage /></PrivateRoute>} />
        <Route path="certifications" element={<CertificationsPage />} />
        <Route path="corrective-actions" element={<CorrectiveActionsPage />} />
        <Route path="reports" element={<PrivateRoute roles={['admin', 'auditor']}><ReportsPage /></PrivateRoute>} />
        <Route path="users" element={<PrivateRoute roles={['admin']}><UsersPage /></PrivateRoute>} />
        <Route path="roles" element={<PrivateRoute roles={['admin']}><RolesPage /></PrivateRoute>} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="settings" element={<PrivateRoute roles={['admin']}><SettingsPage /></PrivateRoute>} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
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
