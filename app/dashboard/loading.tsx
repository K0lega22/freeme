import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="animate-spin h-12 w-12 text-indigo-600 mx-auto" />
        <p className="text-lg text-gray-600 font-medium">Loading your calendar...</p>
      </div>
    </div>
  )
}