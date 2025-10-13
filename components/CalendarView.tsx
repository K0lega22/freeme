'use client'

import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useState } from 'react'
import EventModal from './EventModal'

const locales = {
  'en-US': require('date-fns/locale/en-US'),
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface Event {
  id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
}

export default function CalendarView({ initialEvents }: { initialEvents: Event[] }) {
  const [events, setEvents] = useState(initialEvents)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)

  const calendarEvents = events.map(event => ({
    ...event,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
  }))

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedSlot({ start, end })
    setSelectedEvent(null)
    setIsModalOpen(true)
  }

  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event)
    setSelectedSlot(null)
    setIsModalOpen(true)
  }

  // Replace the existing return statement with:
return (
  <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border border-gray-200">
    <div className="h-[500px] md:h-[600px]">
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        selectable
        className="freeme-calendar"
      />
    </div>

    <EventModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      event={selectedEvent}
      slot={selectedSlot}
      onEventChange={(updatedEvents) => setEvents(updatedEvents)}
    />
  </div>
)
}