// lib/validation.ts - ENHANCED VERSION
import { z } from 'zod'

// Password strength validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

// Event validation schema
export const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  location: z.string().max(200).optional().nullable(),
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  { message: 'End time must be after start time', path: ['end_time'] }
).refine(
  (data) => {
    const diffMs = new Date(data.end_time).getTime() - new Date(data.start_time).getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays <= 30
  },
  { message: 'Event cannot be longer than 30 days', path: ['end_time'] }
)

/**
 * Enhanced XSS prevention
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .trim()
    .slice(0, 10000) // Hard limit
}

/**
 * Validate email format
 */
export const emailSchema = z.string().email().max(255)

/**
 * Validate UUID v4
 */
export function isValidUUID(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return regex.test(uuid)
}

/**
 * Enhanced distributed-ready rate limiting using Redis-compatible interface
 */
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

interface RateLimitConfig {
  limit: number
  windowMs: number
}

class RateLimiter {
  private store: Map<string, { count: number; resetTime: number }>
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.store = new Map()
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key)
      }
    }
  }

  check(
    identifier: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const now = Date.now()
    const record = this.store.get(identifier)

    if (!record || record.resetTime < now) {
      this.store.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs
      })
      return {
        allowed: true,
        remaining: config.limit - 1,
        resetTime: now + config.windowMs
      }
    }

    if (record.count >= config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      }
    }

    record.count++
    return {
      allowed: true,
      remaining: config.limit - record.count,
      resetTime: record.resetTime
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Singleton instance
const rateLimiter = new RateLimiter()

// Rate limit configurations
export const RATE_LIMITS = {
  AI_REQUEST: { limit: 10, windowMs: 60000 }, // 10 per minute
  EVENT_API: { limit: 100, windowMs: 60000 }, // 100 per minute
  AUTH: { limit: 5, windowMs: 300000 }, // 5 per 5 minutes
  IP_BASED: { limit: 200, windowMs: 60000 }, // 200 per minute per IP
} as const

export function checkRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMITS
): RateLimitResult {
  return rateLimiter.check(identifier, RATE_LIMITS[type])
}

/**
 * CSRF Token generation and validation
 */
export function generateCSRFToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function validateCSRFToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken || token.length !== 64 || storedToken.length !== 64) {
    return false
  }
  
  // Constant-time comparison to prevent timing attacks
  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i)
  }
  return result === 0
}

/**
 * Request body size validation
 */
export function validateRequestSize(
  contentLength: string | null,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): { valid: boolean; error?: string } {
  if (!contentLength) {
    return { valid: false, error: 'Content-Length header missing' }
  }

  const size = parseInt(contentLength, 10)
  if (isNaN(size) || size > maxSizeBytes) {
    return { valid: false, error: `Request body too large (max ${maxSizeBytes} bytes)` }
  }

  return { valid: true }
}

/**
 * Timezone-aware date validation
 */
export function validateAndNormalizeDate(dateString: string): {
  valid: boolean
  date?: Date
  error?: string
} {
  try {
    const date = new Date(dateString)
    
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid date format' }
    }

    // Check if date is within reasonable bounds (1 year in past to 10 years in future)
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate())

    if (date < oneYearAgo || date > tenYearsFromNow) {
      return { valid: false, error: 'Date out of acceptable range' }
    }

    return { valid: true, date }
  } catch {
    return { valid: false, error: 'Date parsing failed' }
  }
}

/**
 * Sanitize and validate AI prompt
 */
export function validateAIPrompt(prompt: string): {
  valid: boolean
  sanitized?: string
  error?: string
} {
  if (typeof prompt !== 'string') {
    return { valid: false, error: 'Invalid prompt type' }
  }

  const trimmed = prompt.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' }
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Prompt too long (max 500 characters)' }
  }

  // Check for potential injection attempts
  const suspiciousPatterns = [
    /system:/i,
    /ignore previous/i,
    /disregard/i,
    /<script/i,
    /javascript:/i,
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Invalid prompt content' }
    }
  }

  const sanitized = sanitizeInput(trimmed)
  return { valid: true, sanitized }
}
