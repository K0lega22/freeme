// lib/validation.ts
import { z } from 'zod'

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

/**
 * Validate event data
 */
export function validateEventData(event: any): { valid: boolean; error?: string } {
  if (!event || typeof event !== 'object') {
    return { valid: false, error: 'Invalid event data' }
  }

  if (!event.title || typeof event.title !== 'string' || event.title.length > 200) {
    return { valid: false, error: 'Invalid title' }
  }

  if (!event.start_time || !event.end_time) {
    return { valid: false, error: 'Missing time data' }
  }

  try {
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { valid: false, error: 'Invalid date format' }
    }

    if (end <= start) {
      return { valid: false, error: 'End time must be after start time' }
    }

    const diffMs = end.getTime() - start.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays > 30) {
      return { valid: false, error: 'Event too long (max 30 days)' }
    }
  } catch {
    return { valid: false, error: 'Invalid date values' }
  }

  return { valid: true }
}

/**
 * Validate UUID
 */
export function isValidUUID(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return regex.test(uuid)
}

/**
 * Rate limiting in-memory store
 */
interface RateLimitStore {
  [key: string]: { count: number; resetTime: number }
}

const rateLimitStore: RateLimitStore = {}

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const record = rateLimitStore[identifier]

  if (!record || record.resetTime < now) {
    rateLimitStore[identifier] = {
      count: 1,
      resetTime: now + windowMs
    }
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs }
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  record.count++
  return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime }
}
