import { Link } from 'react-router-dom'
import {
  ShieldCheck, ArrowRight, Download, ClipboardList, ClipboardCheck,
  Award, Plus, Building2, AlertTriangle, BarChart2, QrCode,
  MapPin, Users, CheckSquare
} from 'lucide-react'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260206_044704_dd33cb15-c23f-4cfc-aa09-a0465d4dcb54.mp4'

const STATS = [
  { value: '7+', label: 'Preset checklist categories' },
  { value: '4', label: 'Role tiers — Admin to Team Member' },
  { value: 'PDF', label: 'Certificates auto-issued on pass' },
  { value: '1-click', label: 'Excel, CSV & PDF exports' },
]

const FEATURES = [
  { icon: Building2, title: 'Clinic Registry', desc: 'Multiple locations with type classifications, license numbers, and risk-weighted scorecards calculated from every inspection.' },
  { icon: ClipboardList, title: 'Custom Checklists', desc: 'Build templates with Critical/Major/Minor weightings or deploy 7 preset categories — HIPAA, OSHA, Fire Safety, Infection Control — in one click.' },
  { icon: MapPin, title: 'Field Inspections', desc: 'Mobile-friendly submissions with photo evidence, GPS pinning, file attachments per finding, and auto-calculated compliance scores.' },
  { icon: ClipboardCheck, title: 'Auditor Review', desc: 'Submit → Audit → Approve or Reject with a full reason trail. Critical findings automatically spawn a Corrective Action.' },
  { icon: Award, title: 'Accreditation Courses', desc: 'Build multi-section quizzes. Share a tokenized link — no login required. Pass threshold met? PDF certificate issued instantly.' },
  { icon: QrCode, title: 'Certificate Verification', desc: 'Every certificate has a public verify URL. Anyone can confirm the participant, course, score, issue date, and validity window.' },
  { icon: AlertTriangle, title: 'Corrective Actions', desc: 'Track remediation from opened → assigned → in-progress → resolved → verified. Every closure requires attached evidence.' },
  { icon: BarChart2, title: 'Reports & Analytics', desc: 'Per-clinic PDF scorecards, Excel exports for inspections and audits, CSV dumps, and a live risk-breakdown donut chart on the dashboard.' },
]

const STEPS = [
  { n: '01', title: 'Configure', desc: 'Register your clinics, invite team members, assign roles, upload your organization logo and branding.' },
  { n: '02', title: 'Inspect', desc: 'Field staff run inspections against any checklist — with photos, GPS, and evidence captured on any device.' },
  { n: '03', title: 'Review & Close', desc: 'Auditors validate submissions, raise Corrective Actions on Critical findings, and approve or reject with reasons.' },
  { n: '04', title: 'Certify & Report', desc: 'Issue accreditation certificates, export compliance data to Excel, and track clinic scores on the dashboard.' },
]

const ROLES = [
  { title: 'Admin', border: 'border-blue-400', points: ['Manage clinics, users, courses & settings', 'Deploy presets, brand the org, full read/write'] },
  { title: 'Manager', border: 'border-indigo-400', points: ['View all inspections, audits & actions', 'Create corrective actions & announcements'] },
  { title: 'Auditor', border: 'border-amber-400', points: ['Review and approve/reject submissions', 'Assign corrective actions to staff'] },
  { title: 'Team Member', border: 'border-emerald-400', points: ['Run inspections with photo evidence', 'Complete accreditations & view certifications'] },
]

export function HomePage() {
  return (
    <div className="text-gray-900 font-display">
      {/* ── HERO ─────────────────────────────────────── */}
      <section
        className="relative min-h-screen w-full overflow-hidden"
        style={{ backgroundColor: '#21346e' }}
      >
        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          src={VIDEO_URL}
          autoPlay loop muted playsInline
        />
        <div className="absolute inset-0 bg-[#21346e]/35 z-0" />

        <div className="relative z-10 container mx-auto px-6 lg:px-8 pt-32 lg:pt-48 pb-16">
          {/* Nav */}
          <nav className="absolute top-6 left-0 right-0 px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <ShieldCheck className="text-white" size={20} />
              </div>
              <span className="font-rubik font-semibold text-white text-lg tracking-tight">COMPLIANCETRACK</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#features" className="text-white/70 hover:text-white text-sm transition-colors hidden md:block">Features</a>
              <a href="#how-it-works" className="text-white/70 hover:text-white text-sm transition-colors hidden md:block">How it works</a>
              <Link to="/login" className="font-rubik font-medium text-white text-sm bg-white/15 backdrop-blur px-4 py-2 rounded-full hover:bg-white/25 transition-colors">Sign In</Link>
            </div>
          </nav>

          {/* Headline */}
          <h1
            className="font-rubik font-bold uppercase text-white text-6xl md:text-8xl lg:text-[100px]"
            style={{ lineHeight: 0.98, letterSpacing: '-4px' }}
          >
            <span className="block">A New Era</span>
            <span className="block">Of Compliance</span>
            <span className="block">Starts Now</span>
          </h1>

          {/* Subline */}
          <p className="mt-6 text-white/70 text-base md:text-lg max-w-md leading-relaxed">
            A self-hosted audit platform built for healthcare teams — from field inspections to accreditation certificates.
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="relative inline-flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              style={{ width: 184, height: 65 }}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 184 65" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true">
                <path d="M34,1 C14,2 2,14 2,32.5 C2,51 14,63 34,64 L150,64 C170,63 182,51 182,32.5 C182,14 170,2 150,1 Z" fill="white" />
              </svg>
              <span className="relative z-10 font-rubik font-bold uppercase" style={{ color: '#161a20', fontSize: 20 }}>Get Started</span>
            </Link>
            <a href="#features" className="text-white/70 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
              Explore features <ArrowRight size={14} />
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 animate-bounce">
          <div className="w-0.5 h-8 bg-white/30 rounded-full" />
          <p className="text-white/40 text-xs tracking-widest uppercase">Scroll</p>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-4xl lg:text-5xl font-extrabold text-brand-600">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1.5 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────── */}
      <section id="features" className="bg-gray-50 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-brand-600 text-sm font-semibold uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">Eight modules that replace the binder.</h2>
            <p className="mt-4 text-gray-500 leading-relaxed">Inspections, audits, corrective actions, accreditation, reports — all interconnected, all auditable.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-brand-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-brand-600 text-sm font-semibold uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">From first login to a compliance report in four steps.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-brand-100 z-0" />
                )}
                <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-extrabold text-sm mb-5 relative z-10">{s.n}</div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACCREDITATION SPOTLIGHT ──────────────────── */}
      <section className="bg-gradient-to-br from-brand-800 via-brand-800 to-brand-900 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-brand-300 text-sm font-semibold uppercase tracking-widest mb-4">Accreditation Engine</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-5 leading-tight">Build a course. Share a link. Certify your team automatically.</h2>
            <p className="text-brand-200 leading-relaxed mb-8">No third-party LMS needed. Create multi-section quizzes with multiple-choice questions, generate a shareable link, and the system auto-issues a PDF certificate the moment a participant passes — with a public verification URL on every certificate.</p>
            <Link to="/login" className="inline-flex items-center gap-2 bg-white text-brand-800 font-semibold text-sm px-6 py-3 rounded-full hover:bg-brand-50 transition-colors">
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
              <div key={item.step} className="flex gap-4 bg-white/10 backdrop-blur rounded-2xl px-5 py-4">
                <span className="text-brand-300 font-extrabold text-sm mt-0.5 flex-shrink-0 w-6">{item.step}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{item.label}</p>
                  <p className="text-brand-200 text-xs mt-0.5 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES ────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-brand-600 text-sm font-semibold uppercase tracking-widest mb-3">Access control</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">Four roles, each seeing exactly what they need.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROLES.map(r => (
              <div key={r.title} className={`bg-white rounded-2xl p-6 border-l-4 border border-gray-100 ${r.border}`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Users size={16} className="text-gray-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">{r.title}</h3>
                </div>
                <ul className="space-y-2">
                  {r.points.map(p => (
                    <li key={p} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckSquare size={14} className="flex-shrink-0 mt-0.5 text-brand-500" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────── */}
      <section className="bg-white py-20 lg:py-28 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <ShieldCheck className="text-white" size={26} />
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">Ready to run a tighter compliance program?</h2>
          <p className="text-gray-500 leading-relaxed mb-8">Sign in and start creating clinics, checklists, and accreditation courses in the next five minutes.</p>
          <Link to="/login" className="inline-flex items-center gap-2 bg-brand-600 text-white font-semibold px-8 py-4 rounded-full hover:bg-brand-700 transition-colors text-base hover:scale-105 active:scale-95 transition-transform">
            Sign In to Your Workspace <ArrowRight size={16} />
          </Link>
          <p className="mt-5 text-xs text-gray-400">
            Default admin: <span className="font-mono">admin@compliance.local</span> / <span className="font-mono">admin123</span>
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────── */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">CompliNow</p>
              <p className="text-gray-400 text-xs">Audit anything, anywhere · All industries</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
          </div>
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} CompliNow</p>
        </div>
      </footer>
    </div>
  )
}
