import { Link } from 'react-router-dom'
import { CompliNowMark } from '../components/ui/CompliNowMark'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-7 whitespace-pre-line">{children}</div>
    </section>
  )
}

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-800 text-white">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-3">
          <Link to="/home" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <CompliNowMark size={32} />
            <span className="font-semibold">CompliNow</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900">CompliNow Privacy Policy</h1>
        <p className="text-xs text-gray-400 mt-1 mb-8">Last updated: 2025-01-01</p>

        <Section title="1. Information We Collect">
          {`CompliNow collects information necessary to provide compliance management services to the organizations that use it:\n\n`}
          {`• Account information: name, email address, role within your organization\n`}
          {`• Inspection data: checklist responses, photos, GPS coordinates of inspection sites\n`}
          {`• Credential data: professional license numbers and expiry dates\n`}
          {`• Usage data: app interactions and session timestamps for audit trail purposes`}
        </Section>

        <Section title="2. How We Use Your Information">
          {`We use collected information to:\n\n`}
          {`• Provide compliance tracking and reporting services\n`}
          {`• Generate inspection reports and corrective action workflows\n`}
          {`• Send compliance alerts and policy acknowledgment reminders\n`}
          {`• Maintain audit logs as required by applicable regulations`}
        </Section>

        <Section title="3. HIPAA Compliance">
          {`CompliNow is designed to support HIPAA compliance workflows for organizations that need them. We do not store Protected Health Information (PHI) within the app. Inspection data and compliance records are stored securely and transmitted over encrypted connections (TLS 1.2+).\n\n`}
          {`If your organization uses CompliNow as part of a HIPAA-covered program, please contact us to execute a Business Associate Agreement (BAA).`}
        </Section>

        <Section title="4. Data Security">
          {`We implement industry-standard security measures:\n\n`}
          {`• All data transmitted over HTTPS/TLS encryption\n`}
          {`• Authentication tokens stored in device secure storage (iOS Keychain / Android Keystore)\n`}
          {`• No cleartext storage of credentials\n`}
          {`• Automatic session expiry after inactivity\n`}
          {`• Cloud backup excluded for sensitive data`}
        </Section>

        <Section title="5. Data Sharing">
          {`We do not sell your personal information. Data is shared only:\n\n`}
          {`• Within your organization (role-based access control)\n`}
          {`• With service providers necessary to operate the platform (hosting, email delivery)\n`}
          {`• When required by law or regulatory authorities`}
        </Section>

        <Section title="6. Camera & Location">
          {`Camera access is used exclusively to capture inspection evidence photos. Location access is used to record GPS coordinates of inspection sites. Neither camera images nor location data are shared outside your organization without your consent.`}
        </Section>

        <Section title="7. Data Retention">
          {`Inspection records and compliance data are retained for the period required by your organization's policies and applicable regulations. You may request deletion of your account data by contacting your organization administrator or our support team.`}
        </Section>

        <Section title="8. Your Rights">
          {`Depending on your jurisdiction, you may have rights to:\n\n`}
          {`• Access the personal data we hold about you\n`}
          {`• Request correction of inaccurate data\n`}
          {`• Request deletion of your data\n`}
          {`• Object to certain processing\n\n`}
          {`To exercise these rights, contact `}<a href="mailto:privacy@complinow.app" className="text-brand-700 hover:underline">privacy@complinow.app</a>.
        </Section>

        <Section title="9. Contact Us">
          {`For privacy questions or to report a concern:\n\n`}
          {`Email: `}<a href="mailto:privacy@complinow.app" className="text-brand-700 hover:underline">privacy@complinow.app</a>{`\n`}
          {`Support: `}<a href="mailto:support@complinow.app" className="text-brand-700 hover:underline">support@complinow.app</a>
        </Section>
      </main>
    </div>
  )
}
