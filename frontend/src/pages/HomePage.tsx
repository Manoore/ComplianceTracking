import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260206_044704_dd33cb15-c23f-4cfc-aa09-a0465d4dcb54.mp4'

export function HomePage() {
  return (
    <section
      className="relative min-h-screen w-full overflow-hidden"
      style={{ backgroundColor: '#21346e' }}
    >
      {/* Background video */}
      <video
        className="absolute inset-0 w-full h-full object-cover z-0"
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
      />
      {/* Subtle overlay for legibility */}
      <div className="absolute inset-0 bg-[#21346e]/30 z-0" />

      {/* Top-aligned content */}
      <div className="relative z-10 container mx-auto px-6 lg:px-8 pt-32 lg:pt-48 pb-16">
        {/* Nav */}
        <nav className="absolute top-6 left-0 right-0 px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <span className="font-rubik font-semibold text-white text-lg tracking-tight">
              COMPLIANCETRACK
            </span>
          </div>
          <Link
            to="/login"
            className="font-rubik font-medium text-white text-sm hover:text-white/80 transition-colors"
          >
            Sign In
          </Link>
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

        {/* CTA */}
        <div className="mt-10 lg:mt-12">
          <Link
            to="/login"
            aria-label="Get Started"
            className="relative inline-flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            style={{ width: 184, height: 65 }}
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 184 65"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M 34 1
                   C 14 2 2 14 2 32.5
                   C 2 51 14 63 34 64
                   L 150 64
                   C 170 63 182 51 182 32.5
                   C 182 14 170 2 150 1
                   Z"
                fill="white"
              />
            </svg>
            <span
              className="relative z-10 font-rubik font-bold uppercase"
              style={{ color: '#161a20', fontSize: 20 }}
            >
              Get Started
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
