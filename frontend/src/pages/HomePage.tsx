import { Link } from 'react-router-dom'
import {
  ShieldCheck, ArrowRight, ClipboardList, ClipboardCheck,
  Award, Building2, AlertTriangle, BarChart2, QrCode,
  MapPin, Users, CheckSquare, Bell, CheckCircle,
} from 'lucide-react'
import { CompliNowMark } from '../components/ui/CompliNowMark'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260206_044704_dd33cb15-c23f-4cfc-aa09-a0465d4dcb54.mp4'

const STATS = [
  { value: '8', label: 'Compliance modules' },
  { value: '7+', label: 'Preset checklist categories' },
  { value: 'PDF', label: 'Certificates auto-issued on pass' },
  { value: '1-click', label: 'Excel, CSV & PDF exports' },
]

const FEATURES = [
  { icon: Building2, title: 'Location Registry', desc: 'Manage all your sites with profiles, license numbers, risk scores, and full inspection history per location.' },
  { icon: ClipboardList, title: 'Smart Checklists', desc: 'Build templates with Critical/Major/Minor weightings or deploy 7 preset categories — HIPAA, OSHA, Fire Safety — in one click.' },
  { icon: MapPin, title: 'Field Inspections', desc: 'Mobile-friendly with photo evidence, GPS tagging, file attachments per finding, and auto-calculated compliance scores.' },
  { icon: ClipboardCheck, title: 'Auditor Review', desc: 'Submit → Audit → Approve or Reject with a full reason trail. Critical findings automatically spawn a Corrective Action.' },
  { icon: Award, title: 'Accreditation Courses', desc: 'Build multi-section quizzes. Share a tokenized link — no login required. Pass threshold met? PDF certificate issued instantly.' },
  { icon: QrCode, title: 'Certificate Verification', desc: 'Every certificate has a public verify URL. Anyone can confirm the participant, course, score, issue date, and validity window.' },
  { icon: AlertTriangle, title: 'Corrective Actions', desc: 'Track remediation from opened → assigned → in-progress → resolved → verified. Every closure requires attached evidence.' },
  { icon: BarChart2, title: 'Reports & Analytics', desc: 'Per-location PDF scorecards, Excel exports for inspections and audits, CSV dumps, and a live risk-breakdown chart on the dashboard.' },
]

const STEPS = [
  { n: '01', title: 'Set Up', desc: 'Register your locations, invite team members, assign roles, and upload your organization branding.' },
  { n: '02', title: 'Inspect', desc: 'Field staff run inspections against any checklist — with photos, GPS, and evidence captured on any device.' },
  { n: '03', title: 'Review & Close', desc: 'Auditors validate submissions, raise Corrective Actions on critical findings, and approve or reject with reasons.' },
  { n: '04', title: 'Certify & Report', desc: 'Issue accreditation certificates, export compliance data to Excel, and track location scores on the dashboard.' },
]

const ROLES = [
  { title: 'Admin', color: '#3B82F6', points: ['Manage locations, users, courses & settings', 'Deploy presets, brand the org, full read/write'] },
  { title: 'Manager', color: '#6366F1', points: ['View all inspections, audits & actions', 'Create corrective actions & announcements'] },
  { title: 'Auditor', color: '#F59E0B', points: ['Review and approve/reject submissions', 'Assign corrective actions to staff'] },
  { title: 'Team Member', color: '#10B981', points: ['Run inspections with photo evidence', 'Complete accreditations & view certifications'] },
]

const INDUSTRIES = [
  'Food & Beverage', 'Healthcare', 'Construction', 'Hospitality',
  'Retail', 'Manufacturing', 'Education', 'Logistics',
]

export function HomePage() {
  return (
    <div className="text-gray-900">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: '#07142A' }}>
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          src={VIDEO_URL}
          autoPlay loop muted playsInline
        />
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#07142A]/60 via-transparent to-[#07142A]/80" />

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-6">
          <div className="flex items-center gap-3">
            <CompliNowMark size={36} />
            <div>
              <p className="text-white font-bold text-lg leading-none">CompliNow</p>
              <p className="text-white/50 text-xs">Audit anything, anywhere</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="text-white/60 hover:text-white text-sm transition-colors hidden md:block">Features</a>
            <a href="#how-it-works" className="text-white/60 hover:text-white text-sm transition-colors hidden md:block">How it works</a>
            <Link
              to="/login"
              className="text-white/80 hover:text-white text-sm font-medium px-4 py-2 rounded-full border border-white/20 hover:border-white/40 transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
              style={{ background: '#00C4A0', color: '#07142A' }}
            >
              Start Free Trial
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-center pb-20">
          {/* Industry pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-lg">
            {INDUSTRIES.map(ind => (
              <span key={ind} className="text-xs font-medium px-3 py-1 rounded-full border border-white/15 text-white/60">
                {ind}
              </span>
            ))}
          </div>

          <h1 className="font-extrabold text-white text-5xl md:text-7xl lg:text-8xl leading-none tracking-tight max-w-4xl">
            Compliance Made<br />
            <span style={{ color: '#00C4A0' }}>Simple.</span>
          </h1>

          <p className="mt-6 text-white/60 text-lg md:text-xl max-w-xl leading-relaxed">
            Inspect, audit, certify, and report — one platform for any industry.
            No spreadsheets. No binders. No guesswork.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 font-bold text-base px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg"
              style={{ background: '#00C4A0', color: '#07142A' }}
            >
              Start your free trial <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 font-medium text-base px-8 py-4 rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors"
            >
              Sign in to workspace
            </Link>
          </div>

          <p className="mt-5 text-white/35 text-sm">14-day free trial · No credit card required · Cancel anytime</p>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-bounce">
          <div className="w-px h-10 bg-white/20 rounded-full" />
          <p className="text-white/30 text-xs tracking-widest uppercase">Scroll</p>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-4xl lg:text-5xl font-extrabold" style={{ color: '#1B3260' }}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-2 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section id="features" className="bg-gray-50 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#00C4A0' }}>Everything you need</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">Eight modules that replace the binder.</h2>
            <p className="mt-4 text-gray-500 leading-relaxed">Inspections, audits, corrective actions, accreditation, reports — all interconnected, all auditable.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors" style={{ background: '#EEF4FF' }}>
                  <Icon size={20} style={{ color: '#1B3260' }} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#00C4A0' }}>Simple process</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">From first login to a compliance report in four steps.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px z-0" style={{ background: '#E0E9F5' }} />
                )}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-sm mb-5 relative z-10" style={{ background: '#1B3260', color: '#fff' }}>
                  {s.n}
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACCREDITATION SPOTLIGHT ───────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #1B3260 0%, #07142A 100%)' }} className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#00C4A0' }}>Accreditation Engine</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-5 leading-tight">
              Build a course. Share a link.<br />Certify your team automatically.
            </h2>
            <p className="leading-relaxed mb-8" style={{ color: '#A8BFDC' }}>
              No third-party LMS needed. Create multi-section quizzes, generate a shareable link, and the system auto-issues a PDF certificate the moment a participant passes — with a public verification URL on every certificate.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 font-semibold text-sm px-6 py-3 rounded-full hover:scale-105 transition-transform"
              style={{ background: '#00C4A0', color: '#07142A' }}
            >
              Start issuing certificates <ArrowRight size={15} />
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { step: '01', label: 'Create Course', detail: 'Title, quiz sections, multiple-choice questions, pass threshold, validity window.' },
              { step: '02', label: 'Generate Link', detail: 'One click — token-based URL, optional email assignment, optional expiry date.' },
              { step: '03', label: 'Team Completes Quiz', detail: 'No login needed. Participants answer and submit from any device.' },
              { step: '04', label: 'Certificate Issued', detail: 'Pass threshold met → PDF certificate generated instantly, downloadable, publicly verifiable.' },
            ].map(item => (
              <div key={item.step} className="flex gap-4 rounded-2xl px-5 py-4" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <span className="font-extrabold text-sm mt-0.5 flex-shrink-0 w-6" style={{ color: '#00C4A0' }}>{item.step}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{item.label}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#A8BFDC' }}>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES ─────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#00C4A0' }}>Access control</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">Four roles, each seeing exactly what they need.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROLES.map(r => (
              <div key={r.title} className="bg-white rounded-2xl p-6 border border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: r.color }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                    <Users size={16} className="text-gray-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">{r.title}</h3>
                </div>
                <ul className="space-y-2">
                  {r.points.map(p => (
                    <li key={p} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckSquare size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#1B3260' }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section className="bg-white py-20 lg:py-28 border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: '#1B3260' }}>
            <ShieldCheck className="text-white" size={26} />
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
            Ready to run a tighter compliance program?
          </h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Set up your organization in under 2 minutes. Start with a free 14-day trial — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 font-bold text-base px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-md"
              style={{ background: '#1B3260', color: '#fff' }}
            >
              Start free trial <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 font-medium text-base px-8 py-4 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sign in to workspace
            </Link>
          </div>
          {/* Feature reassurances */}
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {['14-day free trial', 'No credit card', 'Any industry', 'Cancel anytime'].map(f => (
              <div key={f} className="flex items-center gap-1.5 text-sm text-gray-400">
                <CheckCircle size={14} style={{ color: '#00C4A0' }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer style={{ background: '#07142A' }} className="text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CompliNowMark size={32} />
            <div>
              <p className="font-bold text-sm">CompliNow</p>
              <p className="text-xs" style={{ color: '#4A6EA8' }}>Audit anything, anywhere · All industries</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: '#4A6EA8' }}>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
          </div>
          <p className="text-xs" style={{ color: '#2E4A72' }}>© {new Date().getFullYear()} CompliNow</p>
        </div>
      </footer>

    </div>
  )
}
