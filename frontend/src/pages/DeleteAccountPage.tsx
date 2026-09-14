import { Link } from 'react-router-dom'
import { CompliNowMark } from '../components/ui/CompliNowMark'
import { Trash2, LogIn, Mail } from 'lucide-react'

export function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-800 text-white">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center gap-3">
          <Link to="/home" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <CompliNowMark size={32} />
            <span className="font-semibold">CompliNow</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Trash2 size={22} className="text-red-600" /> Delete Your Account
        </h1>
        <p className="text-sm text-gray-600 mt-3 leading-7">
          You can permanently delete your CompliNow account and its associated personal data at any time.
          Deleting your account removes your login, profile, and personal identifiers. Compliance records
          you created (inspections, corrective actions, certifications) stay attached to your organization's
          history for its own regulatory record-keeping, but are no longer linked to your personal account.
        </p>

        <div className="mt-8 card p-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <LogIn size={16} className="text-brand-700" /> If you can still log in
          </h2>
          <p className="text-sm text-gray-600 leading-6">
            Open the app (web or mobile), go to your <strong>Profile</strong> page, and select
            <strong> "Delete my account"</strong> near the bottom. You'll confirm with your password, and
            your account is deleted immediately — no waiting period.
          </p>
        </div>

        <div className="mt-4 card p-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <Mail size={16} className="text-brand-700" /> If you can't log in (lost access, uninstalled the app, etc.)
          </h2>
          <p className="text-sm text-gray-600 leading-6">
            Email <a href="mailto:privacy@complinow.app?subject=Account%20deletion%20request" className="text-brand-700 hover:underline">privacy@complinow.app</a> from
            the address on your account, with the subject "Account deletion request." Include your full name and
            organization so we can verify it's really you. We'll confirm your identity, delete your account, and
            reply once it's done — normally within a few business days.
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          For details on what data we collect and how it's used, see our{' '}
          <Link to="/privacy" className="text-brand-700 hover:underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  )
}
