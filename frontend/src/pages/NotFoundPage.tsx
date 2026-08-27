import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg" style={{ background: '#1B3260' }}>
        <ShieldCheck size={30} className="text-white" />
      </div>
      <p className="text-8xl font-extrabold mb-4" style={{ color: '#E5E9F0' }}>404</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        The page you're looking for doesn't exist or you don't have permission to view it.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 font-semibold text-sm px-6 py-3 rounded-full transition-all hover:scale-105"
        style={{ background: '#1B3260', color: '#fff' }}
      >
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>
    </div>
  )
}
