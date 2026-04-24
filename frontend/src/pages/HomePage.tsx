import { Link } from 'react-router-dom'
import {
  ShieldCheck, Building2, ClipboardList, ClipboardCheck, CheckSquare, QrCode,
  AlertTriangle, BarChart2, Award, Users, MapPin, FileSpreadsheet,
  ArrowRight, Sparkles, Lock, Share2, Download
} from 'lucide-react'

const STATS = [
  { value: '7', label: 'Preset checklist categories' },
  { value: '4', label: 'Role tiers with granular access' },
  { value: 'PDF', label: 'Certificates auto-issued on pass' },
  { value: '1-click', label: 'Excel, CSV, and PDF exports' },
]

const FEATURES = [
  {
    icon: Building2, color: 'bg-blue-50 text-blue-600',
    title: 'Clinic Registry',
    desc: 'Track multiple clinic locations by type (dental, medical, pharmacy, urgent care, specialty) with license numbers, websites, and risk-weighted scorecards rolled up from every inspection.',
  },
  {
    icon: ClipboardList, color: 'bg-indigo-50 text-indigo-600',
    title: 'Custom Checklists',
    desc: 'Build templates with Critical / Major / Minor finding weights, or deploy one of 7 preset categories — HIPAA, OSHA, Fire Safety, Infection Control, Pharmacy, Biohazard, Patient Safety — in a single click.',
  },
  {
    icon: MapPin, color: 'bg-emerald-50 text-emerald-600',
    title: 'Mobile Inspections',
    desc: 'Inspectors capture findings from the field with photo evidence, GPS pinning, file attachments per item, and compliance scores calculated automatically as they go.',
  },
  {
    icon: ClipboardCheck, color: 'bg-amber-50 text-amber-600',
    title: 'Two-Stage Auditor Review',
    desc: 'Submit → Audit → Approve or Reject. Every rejection keeps a reason trail, and Critical findings automatically spawn a Corrective Action with an assignee and due date.',
  },
  {
    icon: Award, color: 'bg-purple-50 text-purple-600',
    title: 'Accreditation Courses',
    desc: 'Build multi-section quizzes with multiple-choice questions. Generate a shareable link, track completions, and auto-issue a PDF certificate when a participant hits the pass threshold.',
  },
  {
    icon: QrCode, color: 'bg-pink-50 text-pink-600',
    title: 'Certificate Verification',
    desc: 'Every issued certificate carries a public verification URL. Anyone can confirm the participant name, course, score, issue date, and validity window — no login required.',
  },
  {
    icon: AlertTriangle, color: 'bg-red-50 text-red-600',
    title: 'Corrective Action Lifecycle',
    desc: 'Track remediation from opened → assigned → in-progress → resolved → verified. Each action has a due date, owner, and linked evidence, so nothing gets closed without proof.',
  },
  {
    icon: BarChart2, color: 'bg-cyan-50 text-cyan-600',
    title: 'Reports & Analytics',
    desc: 'Per-clinic PDF scorecards, Excel exports for inspections / audits / certifications, CSV dumps for finance, and a dashboard with risk-breakdown donut charts and trendlines.',
  },
]

const STEPS = [
  { n: 1, title: 'Configure', desc: 'Register clinics, invite team members, set roles, and upload branding for your organization.' },
  { n: 2, title: 'Inspect', desc: 'Assign inspections against any checklist. Field staff submit findings with photos and evidence from any device.' },
  { n: 3, title: 'Review', desc: 'Auditors validate submissions, raise Corrective Actions on Critical items, and approve or reject with a reason.' },
  { n: 4, title: 'Certify & Report', desc: 'Issue accreditation certificates, export Excel reports, and watch compliance trend upward on the dashboard.' },
]

const ROLES = [
  { title: 'Admin', color: 'border-brand-500', points: ['Manage clinics, users, courses & settings', 'Deploy checklist presets & brand the org', 'Full read/write across every module'] },
  { title: 'Manager', color: 'border-indigo-500', points: ['View all inspections, audits & actions', 'Oversee team compliance scorecards', 'Create corrective actions & announcements'] },
  { title: 'Auditor', color: 'border-amber-500', points: ['Review inspection submissions', 'Approve, reject, or request changes', 'Assign corrective actions to owners'] },
  { title: 'Team Member', color: 'border-emerald-500', points: ['Conduct inspections with photo evidence', 'Complete assigned accreditations', 'View own certifications & notifications'] },
]

export function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-none">ComplianceTrack</p>
            <p className="text-gray-500 text-[11px]">Medical Audit Suite</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
          <a href="#features" className="hover:text-gray-900">Features</a>
          <a href="#how" className="hover:text-gray-900">How it works</a>
          <a href="#accreditation" className="hover:text-gray-900">Accreditation</a>
          <a href="#roles" className="hover:text-gray-900">Roles</a>
        </div>
        <Link to="/login" className="btn-primary text-sm">
          Sign In <ArrowRight size={14} />
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-28 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
              <Sparkles size={12} /> Built for medical compliance teams
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight">
              Medical compliance,<br />
              <span className="text-brand-600">without the clipboard.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl">
              A self-hosted platform for healthcare organizations to run inspections, review audits, deliver accreditation courses, and prove compliance — with every finding, photo, and certificate in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="btn-primary px-6 py-3 text-base">
                Sign In to Your Workspace <ArrowRight size={16} />
              </Link>
              <a href="#how" className="btn-secondary px-6 py-3 text-base">See How It Works</a>
            </div>
            <p className="mt-5 text-xs text-gray-400 flex items-center gap-2">
              <Lock size={12} /> Self-hosted · HIPAA-aware · JWT auth · Docker-ready
            </p>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl lg:text-4xl font-extrabold text-brand-600">{s.value}</p>
              <p className="text-xs lg:text-sm text-gray-500 mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem statement */}
      <section className="max-w-4xl mx-auto px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Audit binders, missed expiries, unsigned forms.</h2>
        <p className="text-gray-600 text-lg leading-relaxed">
          Compliance teams juggle spreadsheets, paper checklists, shared drives, and email reminders. Something always slips — a certification expires unseen, a critical finding loses its evidence, a corrective action sits unclosed for months. ComplianceTrack consolidates every step into one auditable system of record.
        </p>
      </section>

      {/* Features grid */}
      <section id="features" className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Everything a compliance team needs</h2>
            <p className="mt-4 text-gray-600">Eight integrated modules replace the spreadsheets, PDFs, and reminder emails you're running today.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">How it works</h2>
          <p className="mt-4 text-gray-600">From first login to a month-end compliance report in four steps.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map(s => (
            <div key={s.n} className="relative">
              <div className="w-11 h-11 bg-brand-600 text-white rounded-xl flex items-center justify-center font-bold text-lg mb-4 shadow-sm">{s.n}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Accreditation spotlight */}
      <section id="accreditation" className="bg-gradient-to-br from-purple-600 to-brand-700 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-3 py-1 rounded-full mb-6">
              <Award size={12} /> Accreditation &amp; Training
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-5 leading-tight">Turn any policy into a graded course — and certify your team in minutes.</h2>
            <p className="text-purple-100 text-lg leading-relaxed mb-6">
              Build a quiz with multiple-choice questions, set a pass threshold, and generate a shareable link. Team members complete the quiz (no login required), and a PDF certificate is auto-generated the moment they pass.
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3"><CheckSquare size={18} className="flex-shrink-0 mt-0.5 text-purple-200" /><span>Build multi-section quizzes with pass thresholds and attempt limits</span></li>
              <li className="flex items-start gap-3"><Share2 size={18} className="flex-shrink-0 mt-0.5 text-purple-200" /><span>Share links publicly or assign to a specific email with an expiry</span></li>
              <li className="flex items-start gap-3"><Download size={18} className="flex-shrink-0 mt-0.5 text-purple-200" /><span>Auto-generated PDF certificates with validity dates and a public verify URL</span></li>
              <li className="flex items-start gap-3"><BarChart2 size={18} className="flex-shrink-0 mt-0.5 text-purple-200" /><span>Track every completion, score, and expiry from a single dashboard</span></li>
            </ul>
          </div>
          <div className="space-y-3">
            <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20">
              <p className="text-xs font-semibold text-purple-200 mb-2">STEP 1 · ADMIN</p>
              <p className="font-semibold mb-1">Create course with quiz questions</p>
              <p className="text-sm text-purple-100">Title, description, pass threshold (default 80%), validity window, and any number of multiple-choice questions.</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 ml-6">
              <p className="text-xs font-semibold text-purple-200 mb-2">STEP 2 · ADMIN</p>
              <p className="font-semibold mb-1">Generate shareable link</p>
              <p className="text-sm text-purple-100">One click copies a tokenized URL. Optional email assignment, optional expiry in days.</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 ml-12">
              <p className="text-xs font-semibold text-purple-200 mb-2">STEP 3 · TEAM MEMBER</p>
              <p className="font-semibold mb-1">Complete quiz, receive certificate</p>
              <p className="text-sm text-purple-100">No login needed. Passing participants download a PDF certificate with a verification QR immediately.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Role-based access, out of the box</h2>
          <p className="mt-4 text-gray-600">Four role tiers mean staff see only what's relevant to their work.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROLES.map(r => (
            <div key={r.title} className={`bg-white rounded-xl p-6 border-l-4 border border-gray-200 ${r.color}`}>
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-gray-500" />
                <h3 className="font-bold text-gray-900">{r.title}</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                {r.points.map(p => (
                  <li key={p} className="flex items-start gap-2">
                    <CheckSquare size={14} className="flex-shrink-0 mt-0.5 text-brand-500" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Tech strip */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <p className="text-center text-xs font-semibold text-gray-400 tracking-widest mb-6">BUILT ON A MODERN OPEN STACK</p>
          <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4 text-sm text-gray-500 font-medium">
            <span>React + TypeScript</span><span className="text-gray-300">·</span>
            <span>FastAPI + SQLAlchemy</span><span className="text-gray-300">·</span>
            <span>SQLite / PostgreSQL</span><span className="text-gray-300">·</span>
            <span>Tailwind CSS</span><span className="text-gray-300">·</span>
            <span>JWT Auth</span><span className="text-gray-300">·</span>
            <span>Docker-Ready</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-24 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-100 rounded-2xl mb-6">
          <FileSpreadsheet className="text-brand-600" size={26} />
        </div>
        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-5">Ready to run a tighter compliance program?</h2>
        <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
          Sign in to your workspace and start creating clinics, checklists, and accreditation courses in the next five minutes.
        </p>
        <Link to="/login" className="btn-primary text-base px-8 py-3 inline-flex">
          Sign In <ArrowRight size={16} />
        </Link>
        <p className="mt-5 text-xs text-gray-400">Default admin: <span className="font-mono">admin@compliance.local</span> / <span className="font-mono">admin123</span></p>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white" size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">ComplianceTrack</p>
              <p className="text-xs text-gray-500">A self-hosted audit suite for healthcare organizations.</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} ComplianceTrack · All rights reserved</p>
        </div>
      </footer>
    </div>
  )
}
