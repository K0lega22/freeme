'use client'

import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="p-4 bg-red-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
          <AlertCircle className="text-red-600" size={40} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Oops! Something went wrong</h2>
        <p className="text-gray-600">{error.message}</p>
        <button
          onClick={reset}
          className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition shadow-md"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}