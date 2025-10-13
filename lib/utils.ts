import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns'

export function formatEventTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'h:mm a')
}

export function formatEventDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  
  return format(d, 'MMM d, yyyy')
}

export function formatRelativeTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function getEventColor(index: number) {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-green-500 to-green-600',
    'from-orange-500 to-orange-600',
    'from-cyan-500 to-cyan-600',
  ]
  return colors[index % colors.length]
}