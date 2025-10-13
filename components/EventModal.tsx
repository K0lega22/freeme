'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Calendar, Clock, MapPin, FileText } from 'lucide-react'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  event: any
  slot: { start: Date; end: Date } | null
  onEventChange: (events: any[]) => void
}

export default function EventModal({ isOpen, onClose, event, slot, onEventChange }: EventModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setDescription(event.description || '')
      setStartTime(new Date(event.start_time).toISOString().slice(0, 16))
      setEndTime(new Date(event.end_time).toISOString().slice(0, 16))
      setLocation(event.location || '')
    } else if (slot) {
      setTitle('')
      setDescription('')
      setStartTime(slot.start.toISOString().slice(0, 16))
      setEndTime(slot.end.toISOString().slice(0, 16))
      setLocation('')
    }
  }, [event, slot])

  const refreshEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('start_time', { ascending: true })
    if (data) onEventChange(data)
  }

  const handleSave = async () => {
    setLoading(true)

    const eventData = {
      title,
      description,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      location,
    }

    if (event) {
      await supabase.from('events').update(eventData).eq('id', event.id)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('events').insert({ ...eventData, user_id: user?.id })
    }

    await refreshEvents()
    setLoading(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!event) return
    setLoading(true)
    await supabase.from('events').delete().eq('id', event.id)
    await refreshEvents()
    setLoading(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {event ? 'Edit Event' : 'New Event'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} />
              Event Title
            </label>
            <input
              type="text"
              placeholder="Team meeting, Lunch with Alex..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText size={16} />
              Description
            </label>
            <textarea
              placeholder="Add details about this event..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MapPin size={16} />
              Location
            </label>
            <input
              type="text"
              placeholder="Office, Zoom, Coffee shop..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock size={16} />
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock size={16} />
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={loading || !title}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition"
            >
              {loading ? 'Saving...' : 'Save Event'}
            </button>
            {event && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-6 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}