import { Link } from 'react-router-dom'
import {
  ShieldCheck, ArrowRight, Sparkles, Download,
  ClipboardList, ClipboardCheck, Award, Plus,
  Twitter, Linkedin, Instagram, Menu
} from 'lucide-react'

export function HomePage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden font-display text-white bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700">
      {/* Animated gradient blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="bg-drift-blob absolute w-[640px] h-[640px] rounded-full bg-brand-500/50 blur-3xl -top-48 -left-32" />
        <div className="bg-drift-blob-slow absolute w-[520px] h-[520px] rounded-full bg-brand-400/40 blur-3xl top-[25%] right-[-120px]" />
        <div className="bg-drift-blob absolute w-[480px] h-[480px] rounded-full bg-blue-300/25 blur-3xl bottom-[-160px] left-[18%]" />
        <div className="bg-drift-blob-slow absolute w-[360px] h-[360px] rounded-full bg-brand-200/15 blur-3xl top-[55%] left-[35%]" />
      </div>
      {/* Subtle darkening overlay for legibility */}
      <div className="absolute inset-0 bg-brand-900/20 z-0" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* LEFT PANEL */}
        <div className="lg:w-[52%] relative">
          <div className="liquid-glass-strong absolute inset-4 lg:inset-6 rounded-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col min-h-screen px-8 lg:px-12 py-8 lg:py-10">
            {/* Nav */}
            <nav className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                  <ShieldCheck size={18} className="text-white" />
                </div>
                <span className="font-semibold text-2xl tracking-tighter">compliancetrack</span>
              </div>
              <button className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-sm hover:scale-105 transition-transform">
                <Menu size={14} /> Menu
              </button>
            </nav>

            {/* Hero center */}
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-7 py-10">
              <div className="w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm shadow-lg">
                <ShieldCheck size={40} className="text-white" />
              </div>

              <h1 className="text-6xl lg:text-7xl font-medium tracking-[-0.05em] leading-[0.95] text-white">
                Medical compliance,<br />
                <em className="font-serif italic text-white/80">made effortless</em>
              </h1>

              <Link
                to="/login"
                className="liquid-glass-strong rounded-full pl-2 pr-6 py-2 inline-flex items-center gap-3 text-sm font-medium hover:scale-105 active:scale-95 transition-transform mt-2"
              >
                <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
                  <Download size={14} />
                </span>
                <span>Sign In to Your Workspace</span>
              </Link>

              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Clinic Registry', 'Accreditation', 'Auditor Review'].map(label => (
                  <span
                    key={label}
                    className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom quote */}
            <div className="mt-auto">
              <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-3">
                VISIONARY COMPLIANCE
              </p>
              <p className="text-xl lg:text-2xl font-medium leading-snug max-w-md">
                We built the system where every finding,{' '}
                <em className="font-serif italic text-white/80">photograph,</em> and
                certificate has a permanent home.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <div className="h-px w-8 bg-white/30" />
                <p className="text-xs tracking-[0.25em] text-white/60">
                  THE COMPLIANCE TEAM
                </p>
                <div className="h-px flex-1 bg-white/30" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL (desktop only) */}
        <div className="hidden lg:flex lg:w-[48%] p-6 flex-col gap-4">
          {/* Top bar */}
          <div className="flex justify-between items-start">
            <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-4">
              <a href="#" className="text-white hover:text-white/80 transition-colors">
                <Twitter size={14} />
              </a>
              <a href="#" className="text-white hover:text-white/80 transition-colors">
                <Linkedin size={14} />
              </a>
              <a href="#" className="text-white hover:text-white/80 transition-colors">
                <Instagram size={14} />
              </a>
              <div className="w-px h-4 bg-white/20" />
              <ArrowRight size={14} className="text-white/60" />
            </div>
            <Link
              to="/login"
              className="liquid-glass rounded-full w-10 h-10 flex items-center justify-center hover:scale-105 transition-transform"
              title="Go to app"
            >
              <Sparkles size={15} />
            </Link>
          </div>

          {/* Community card */}
          <div className="liquid-glass rounded-2xl p-4 w-56 self-end">
            <p className="text-sm font-medium mb-1">Enter your workspace</p>
            <p className="text-xs text-white/60 leading-relaxed">
              Centralize inspections, audits, and certifications in one secure environment.
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom feature section */}
          <div className="liquid-glass-strong rounded-[2.5rem] p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="liquid-glass rounded-3xl p-5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <ClipboardList size={16} />
                </div>
                <p className="text-sm font-medium mb-1">Inspections</p>
                <p className="text-xs text-white/60 leading-relaxed">
                  Field checklists with photo evidence, GPS, and auto-scoring.
                </p>
              </div>
              <div className="liquid-glass rounded-3xl p-5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <ClipboardCheck size={16} />
                </div>
                <p className="text-sm font-medium mb-1">Audit Archive</p>
                <p className="text-xs text-white/60 leading-relaxed">
                  Every review, reason, and approval preserved with a full audit trail.
                </p>
              </div>
            </div>

            <div className="liquid-glass rounded-3xl p-3 flex items-center gap-3">
              <div className="w-24 h-16 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Award size={28} className="text-white/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Advanced Accreditation Engine</p>
                <p className="text-xs text-white/60 leading-relaxed mt-0.5">
                  Build quiz courses, share tokenized links, auto-issue PDF certificates.
                </p>
              </div>
              <Link
                to="/login"
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0"
                title="Open"
              >
                <Plus size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
