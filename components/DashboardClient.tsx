'use client'

import { useState } from 'react'
import AIChat from './AIChat'
import CalendarView from './CalendarView'

export default function DashboardClient({ initialEvents }: { initialEvents: any[] }) {
  const [events, setEvents] = useState(initialEvents)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = async () => {
    const response = await fetch('/api/events')
    const data = await response.json()
    setEvents(data.events)
    setRefreshKey(prev => prev + 1)
  }

  return (
    <>
      <AIChat onEventChange={handleRefresh} />
      <CalendarView key={refreshKey} initialEvents={events} />
    </>
  )
}