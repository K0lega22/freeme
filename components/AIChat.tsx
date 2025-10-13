'use client'

import { useState } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'

interface AIChatProps {
  onEventChange: () => void
}

export default function AIChat({ onEventChange }: AIChatProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/ai-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage(data.message)
        setInput('')
        onEventChange()
      } else {
        setMessage(data.error || 'Something went wrong')
      }
    } catch (error) {
      setMessage('Failed to process request')
    }

    setLoading(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
            <Sparkles className="text-blue-500" size={20} />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Freeme to schedule, find, or manage..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>

        {message && (
          <div 
            className={`mt-3 p-3 rounded-lg text-sm ${
              message.includes('Failed') || message.includes('error') || message.includes('Could not')
                ? 'bg-red-900/20 text-red-400 border border-red-800'
                : 'bg-green-900/20 text-green-400 border border-green-800'
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  )
}