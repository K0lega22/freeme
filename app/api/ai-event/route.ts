// app/api/ai-event/route.ts - ENHANCED SECURE VERSION
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { 
  validateAIPrompt, 
  checkRateLimit, 
  validateRequestSize,
  eventSchema,
  isValidUUID 
} from '@/lib/validation'

// Initialize OpenAI client with error handling
function getOpenAIClient() {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://freeme.app',
      'X-Title': 'Freeme Calendar',
    },
    timeout: 30000, // 30 second timeout
    maxRetries: 2,
  })
}

// Standardized error responses
const ERROR_RESPONSES = {
  UNAUTHORIZED: { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
  RATE_LIMIT: { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
  INVALID_INPUT: { error: 'Invalid input', code: 'INVALID_INPUT' },
  PAYLOAD_TOO_LARGE: { error: 'Request too large', code: 'PAYLOAD_TOO_LARGE' },
  AI_ERROR: { error: 'AI processing failed', code: 'AI_ERROR' },
  DATABASE_ERROR: { error: 'Database operation failed', code: 'DB_ERROR' },
  NOT_FOUND: { error: 'Resource not found', code: 'NOT_FOUND' },
  SERVER_ERROR: { error: 'Internal server error', code: 'SERVER_ERROR' },
} as const

function extractJSON(text: string): any {
  try {
    // Try direct parse first
    return JSON.parse(text)
  } catch {
    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1])
    }
    
    // Try to find JSON object in text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    throw new Error('No valid JSON found in response')
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // 1. Validate request size
    const contentLength = request.headers.get('content-length')
    const sizeCheck = validateRequestSize(contentLength, 10240) // 10KB max
    
    if (!sizeCheck.valid) {
      return NextResponse.json(
        ERROR_RESPONSES.PAYLOAD_TOO_LARGE,
        { status: 413 }
      )
    }

    // 2. Authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        ERROR_RESPONSES.UNAUTHORIZED,
        { status: 401 }
      )
    }

    // 3. Rate limiting (per user)
    const rateLimit = checkRateLimit(`user:${user.id}`, 'AI_REQUEST')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ...ERROR_RESPONSES.RATE_LIMIT,
          retryAfter: rateLimit.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': String(rateLimit.retryAfter || 60),
          }
        }
      )
    }

    // 4. Parse and validate request body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ...ERROR_RESPONSES.INVALID_INPUT, details: 'Invalid JSON' },
        { status: 400 }
      )
    }

    const { prompt } = body

    // 5. Validate AI prompt
    const promptValidation = validateAIPrompt(prompt)
    if (!promptValidation.valid) {
      return NextResponse.json(
        { ...ERROR_RESPONSES.INVALID_INPUT, details: promptValidation.error },
        { status: 400 }
      )
    }

    const sanitizedPrompt = promptValidation.sanitized!

    // 6. Fetch existing events (with limit)
    const { data: existingEvents, error: fetchError } = await supabase
      .from('events')
      .select('id, title, start_time, end_time, location')
      .eq('user_id', user.id)
      .gte('end_time', new Date().toISOString()) // Only future/current events
      .order('start_time', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error(`[${requestId}] Database fetch error:`, fetchError.code)
      return NextResponse.json(
        ERROR_RESPONSES.DATABASE_ERROR,
        { status: 500 }
      )
    }

    // 7. Prepare AI system prompt
    const now = new Date()
    const systemPrompt = `You are Freeme's AI calendar assistant. Analyze the user's request and respond with ONLY valid JSON.

CRITICAL RULES:
- Current datetime: ${now.toISOString()}
- User timezone: UTC (adjust times accordingly)
- ONLY return valid JSON, no markdown, no explanations
- Use ISO 8601 format for all dates
- Validate that end_time is after start_time

AVAILABLE ACTIONS:
1. CREATE - Create new event
2. UPDATE - Modify existing event
3. DELETE - Remove event
4. QUERY - Find/list events (return { "action": "query", "results": [...], "message": "..." })

EXISTING EVENTS (next 50):
${JSON.stringify(existingEvents || [], null, 2)}

RESPONSE FORMATS:

CREATE:
{
  "action": "create",
  "event": {
    "title": "Meeting Title",
    "description": "Optional description",
    "start_time": "2025-10-20T10:00:00Z",
    "end_time": "2025-10-20T11:00:00Z",
    "location": "Office or null"
  },
  "message": "Created meeting for tomorrow at 10am"
}

UPDATE:
{
  "action": "update",
  "event_id": "uuid-here",
  "updates": { "start_time": "2025-10-21T10:00:00Z" },
  "message": "Moved meeting to next day"
}

DELETE:
{
  "action": "delete",
  "event_id": "uuid-here",
  "message": "Deleted meeting"
}

QUERY:
{
  "action": "query",
  "results": [{ "id": "...", "title": "..." }],
  "message": "Found 2 meetings tomorrow"
}

RETURN ONLY THE JSON OBJECT.`

    // 8. Call AI with timeout
    let completion: any
    try {
      const openai = getOpenAIClient()
      
      completion = await Promise.race([
        openai.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-20250514',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: sanitizedPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 1000,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI request timeout')), 25000)
        )
      ])
    } catch (aiError: any) {
      console.error(`[${requestId}] AI API error:`, aiError.message)
      
      return NextResponse.json(
        { 
          ...ERROR_RESPONSES.AI_ERROR,
          details: process.env.NODE_ENV === 'development' ? aiError.message : undefined
        },
        { status: 503 }
      )
    }

    // 9. Parse AI response
    const responseText = completion.choices[0].message.content || '{}'
    let parsedResponse: any

    try {
      parsedResponse = extractJSON(responseText)
    } catch (parseError) {
      console.error(`[${requestId}] JSON parse error:`, responseText.slice(0, 200))
      return NextResponse.json(
        { ...ERROR_RESPONSES.AI_ERROR, details: 'Invalid AI response format' },
        { status: 500 }
      )
    }

    // 10. Validate response structure
    const validActions = ['create', 'update', 'delete', 'query']
    if (!parsedResponse.action || !validActions.includes(parsedResponse.action)) {
      console.error(`[${requestId}] Invalid action:`, parsedResponse.action)
      return NextResponse.json(
        { ...ERROR_RESPONSES.AI_ERROR, details: 'Invalid action type' },
        { status: 500 }
      )
    }

    // 11. Execute QUERY action
    if (parsedResponse.action === 'query') {
      return NextResponse.json({
        success: true,
        action: 'query',
        results: parsedResponse.results || [],
        message: parsedResponse.message || 'Query completed',
        requestId,
        processingTime: Date.now() - startTime,
      })
    }

    // 12. Execute CREATE action
    if (parsedResponse.action === 'create') {
      // Validate event data with Zod
      const validation = eventSchema.safeParse(parsedResponse.event)
      
      if (!validation.success) {
        return NextResponse.json(
          { 
            ...ERROR_RESPONSES.INVALID_INPUT,
            details: validation.error.issues[0].message 
          },
          { status: 400 }
        )
      }

      const eventData = validation.data

      const { data, error } = await supabase
        .from('events')
        .insert({
          ...eventData,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) {
        console.error(`[${requestId}] Insert error:`, error.code)
        return NextResponse.json(
          ERROR_RESPONSES.DATABASE_ERROR,
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        action: 'create',
        event: data,
        message: parsedResponse.message || 'Event created successfully',
        requestId,
        processingTime: Date.now() - startTime,
      })
    }

    // 13. Execute UPDATE action
    if (parsedResponse.action === 'update') {
      const { event_id, updates } = parsedResponse

      // Validate event_id
      if (!isValidUUID(event_id)) {
        return NextResponse.json(
          { ...ERROR_RESPONSES.INVALID_INPUT, details: 'Invalid event ID' },
          { status: 400 }
        )
      }

      // Verify ownership
      const { data: existing, error: checkError } = await supabase
        .from('events')
        .select('id')
        .eq('id', event_id)
        .eq('user_id', user.id)
        .single()

      if (checkError || !existing) {
        return NextResponse.json(
          ERROR_RESPONSES.NOT_FOUND,
          { status: 404 }
        )
      }

      // Validate updates
      if (!updates || typeof updates !== 'object') {
        return NextResponse.json(
          { ...ERROR_RESPONSES.INVALID_INPUT, details: 'Invalid updates' },
          { status: 400 }
        )
      }

      // Sanitize and validate each update field
      const allowedFields = ['title', 'description', 'start_time', 'end_time', 'location']
      const sanitizedUpdates: any = {}

      for (const [key, value] of Object.entries(updates)) {
        if (!allowedFields.includes(key)) continue
        
        if (key === 'title' && typeof value === 'string') {
          sanitizedUpdates.title = value.trim().slice(0, 200)
        } else if (key === 'description') {
          sanitizedUpdates.description = value ? String(value).trim().slice(0, 2000) : null
        } else if (key === 'location') {
          sanitizedUpdates.location = value ? String(value).trim().slice(0, 200) : null
        } else if ((key === 'start_time' || key === 'end_time') && typeof value === 'string') {
          const dateCheck = new Date(value)
          if (isNaN(dateCheck.getTime())) {
            return NextResponse.json(
              { ...ERROR_RESPONSES.INVALID_INPUT, details: `Invalid ${key}` },
              { status: 400 }
            )
          }
          sanitizedUpdates[key] = value
        }
      }

      if (Object.keys(sanitizedUpdates).length === 0) {
        return NextResponse.json(
          { ...ERROR_RESPONSES.INVALID_INPUT, details: 'No valid updates provided' },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('events')
        .update(sanitizedUpdates)
        .eq('id', event_id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error(`[${requestId}] Update error:`, error.code)
        return NextResponse.json(
          ERROR_RESPONSES.DATABASE_ERROR,
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        action: 'update',
        event: data,
        message: parsedResponse.message || 'Event updated successfully',
        requestId,
        processingTime: Date.now() - startTime,
      })
    }

    // 14. Execute DELETE action
    if (parsedResponse.action === 'delete') {
      const { event_id } = parsedResponse

      // Validate event_id
      if (!isValidUUID(event_id)) {
        return NextResponse.json(
          { ...ERROR_RESPONSES.INVALID_INPUT, details: 'Invalid event ID' },
          { status: 400 }
        )
      }

      // Verify ownership before deletion
      const { data: existing, error: checkError } = await supabase
        .from('events')
        .select('id, title')
        .eq('id', event_id)
        .eq('user_id', user.id)
        .single()

      if (checkError || !existing) {
        return NextResponse.json(
          ERROR_RESPONSES.NOT_FOUND,
          { status: 404 }
        )
      }

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event_id)
        .eq('user_id', user.id)

      if (error) {
        console.error(`[${requestId}] Delete error:`, error.code)
        return NextResponse.json(
          ERROR_RESPONSES.DATABASE_ERROR,
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        action: 'delete',
        event_id,
        message: parsedResponse.message || 'Event deleted successfully',
        requestId,
        processingTime: Date.now() - startTime,
      })
    }

    // Fallback (should never reach here)
    return NextResponse.json(
      ERROR_RESPONSES.SERVER_ERROR,
      { status: 500 }
    )

  } catch (error: any) {
    console.error(`[${requestId}] Unhandled error:`, error.message)
    
    return NextResponse.json(
      {
        ...ERROR_RESPONSES.SERVER_ERROR,
        requestId,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ai-event',
    timestamp: new Date().toISOString(),
  })
}