// app/api/ai-event/route.ts - FIXED VERSION
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
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Freeme Calendar',
    },
    timeout: 45000, // Increased to 45 seconds
    maxRetries: 1, // Reduced retries
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

// Improved JSON extraction
function extractJSON(text: string): any {
  console.log('AI Response:', text.slice(0, 500)) // Debug log
  
  try {
    // Remove any markdown formatting
    let cleaned = text.trim()
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    
    // Try to find JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    // Try direct parse
    return JSON.parse(cleaned)
  } catch (error) {
    console.error('JSON Parse Error:', error)
    throw new Error(`Failed to parse AI response: ${text.slice(0, 100)}`)
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    console.log(`[${requestId}] AI Event Request Started`)

    // 1. Validate request size
    const contentLength = request.headers.get('content-length')
    const sizeCheck = validateRequestSize(contentLength, 10240)
    
    if (!sizeCheck.valid) {
      console.log(`[${requestId}] Request too large`)
      return NextResponse.json(
        ERROR_RESPONSES.PAYLOAD_TOO_LARGE,
        { status: 413 }
      )
    }

    // 2. Authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log(`[${requestId}] Auth failed:`, authError?.message)
      return NextResponse.json(
        ERROR_RESPONSES.UNAUTHORIZED,
        { status: 401 }
      )
    }

    console.log(`[${requestId}] User authenticated:`, user.id)

    // 3. Rate limiting
    const rateLimit = checkRateLimit(`user:${user.id}`, 'AI_REQUEST')
    if (!rateLimit.allowed) {
      console.log(`[${requestId}] Rate limit exceeded`)
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

    // 4. Parse request body
    let body: any
    try {
      body = await request.json()
    } catch {
      console.log(`[${requestId}] Invalid JSON body`)
      return NextResponse.json(
        { ...ERROR_RESPONSES.INVALID_INPUT, details: 'Invalid JSON' },
        { status: 400 }
      )
    }

    const { prompt } = body

    // 5. Validate prompt
    const promptValidation = validateAIPrompt(prompt)
    if (!promptValidation.valid) {
      console.log(`[${requestId}] Invalid prompt:`, promptValidation.error)
      return NextResponse.json(
        { ...ERROR_RESPONSES.INVALID_INPUT, details: promptValidation.error },
        { status: 400 }
      )
    }

    const sanitizedPrompt = promptValidation.sanitized!
    console.log(`[${requestId}] Processing prompt:`, sanitizedPrompt.slice(0, 50))

    // 6. Fetch existing events
    const { data: existingEvents, error: fetchError } = await supabase
      .from('events')
      .select('id, title, start_time, end_time, location, description')
      .eq('user_id', user.id)
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error(`[${requestId}] Database fetch error:`, fetchError)
      return NextResponse.json(
        ERROR_RESPONSES.DATABASE_ERROR,
        { status: 500 }
      )
    }

    console.log(`[${requestId}] Loaded ${existingEvents?.length || 0} existing events`)

    // 7. Prepare AI system prompt
    const now = new Date()
    const systemPrompt = `You are Freeme's AI calendar assistant. Current time: ${now.toISOString()}

USER'S EXISTING EVENTS:
${JSON.stringify(existingEvents || [], null, 2)}

INSTRUCTIONS:
- Analyze the user's request and determine the appropriate action
- Respond with ONLY a JSON object, no markdown, no explanation
- Use ISO 8601 format for dates (YYYY-MM-DDTHH:mm:ss.sssZ)
- Ensure end_time is after start_time
- When the user doesn't specify a time, use reasonable defaults (e.g., 9am for meetings)

ACTIONS:
1. CREATE - Create a new event
2. UPDATE - Modify an existing event (requires event_id)
3. DELETE - Remove an event (requires event_id)
4. QUERY - Search/list events

RESPONSE FORMATS:

For CREATE:
{
  "action": "create",
  "event": {
    "title": "Event Title",
    "description": "Optional description",
    "start_time": "2025-10-20T09:00:00.000Z",
    "end_time": "2025-10-20T10:00:00.000Z",
    "location": "Location or null"
  },
  "message": "Created meeting for tomorrow at 9am"
}

For UPDATE:
{
  "action": "update",
  "event_id": "existing-event-uuid",
  "updates": {
    "start_time": "2025-10-21T09:00:00.000Z",
    "title": "New Title"
  },
  "message": "Updated meeting time"
}

For DELETE:
{
  "action": "delete",
  "event_id": "existing-event-uuid",
  "message": "Deleted the meeting"
}

For QUERY:
{
  "action": "query",
  "results": [{"id": "uuid", "title": "Meeting", "start_time": "..."}],
  "message": "Found 2 meetings tomorrow"
}

IMPORTANT: Return ONLY the JSON object, nothing else.`

    // 8. Call AI with improved error handling
    let completion: any
    try {
      const openai = getOpenAIClient()
      
      console.log(`[${requestId}] Calling AI API...`)
      
      // Use correct model name for OpenRouter + Claude
      completion = await openai.chat.completions.create({
        model: 'anthropic/claude-3.5-sonnet', // Correct model string
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitizedPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        // Don't use response_format for Claude - it's not reliable
      })

      console.log(`[${requestId}] AI API responded`)
      
    } catch (aiError: any) {
      console.error(`[${requestId}] AI API error:`, {
        message: aiError.message,
        status: aiError.status,
        type: aiError.type,
      })
      
      return NextResponse.json(
        { 
          ...ERROR_RESPONSES.AI_ERROR,
          details: aiError.message,
          message: 'Could not process your request. Please try again.'
        },
        { status: 503 }
      )
    }

    // 9. Parse AI response
    const responseText = completion.choices[0]?.message?.content || '{}'
    console.log(`[${requestId}] AI Response:`, responseText.slice(0, 200))
    
    let parsedResponse: any

    try {
      parsedResponse = extractJSON(responseText)
      console.log(`[${requestId}] Parsed action:`, parsedResponse.action)
    } catch (parseError: any) {
      console.error(`[${requestId}] JSON parse failed:`, parseError.message)
      return NextResponse.json(
        { 
          ...ERROR_RESPONSES.AI_ERROR, 
          details: 'Could not understand AI response',
          message: 'Sorry, I had trouble processing that. Please try rephrasing.'
        },
        { status: 500 }
      )
    }

    // 10. Validate action
    const validActions = ['create', 'update', 'delete', 'query']
    if (!parsedResponse.action || !validActions.includes(parsedResponse.action)) {
      console.error(`[${requestId}] Invalid action:`, parsedResponse.action)
      return NextResponse.json(
        { 
          ...ERROR_RESPONSES.AI_ERROR, 
          details: 'Invalid action type',
          message: 'Sorry, I couldn\'t understand what you wanted to do.'
        },
        { status: 500 }
      )
    }

    // 11. Handle QUERY action
    if (parsedResponse.action === 'query') {
      console.log(`[${requestId}] Query action completed`)
      return NextResponse.json({
        success: true,
        action: 'query',
        results: parsedResponse.results || [],
        message: parsedResponse.message || 'Query completed',
        requestId,
        processingTime: Date.now() - startTime,
      })
    }

    // 12. Handle CREATE action
    if (parsedResponse.action === 'create') {
      const validation = eventSchema.safeParse(parsedResponse.event)
      
      if (!validation.success) {
        console.error(`[${requestId}] Event validation failed:`, validation.error)
        return NextResponse.json(
          { 
            ...ERROR_RESPONSES.INVALID_INPUT,
            details: validation.error.issues[0].message,
            message: 'Invalid event details. Please check your request.'
          },
          { status: 400 }
        )
      }

      const eventData = validation.data
      console.log(`[${requestId}] Creating event:`, eventData.title)

      const { data, error } = await supabase
        .from('events')
        .insert({
          ...eventData,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) {
        console.error(`[${requestId}] Insert error:`, error)
        return NextResponse.json(
          { 
            ...ERROR_RESPONSES.DATABASE_ERROR,
            message: 'Failed to create event. Please try again.'
          },
          { status: 500 }
        )
      }

      console.log(`[${requestId}] Event created successfully:`, data.id)
      return NextResponse.json({
        success: true,
        action: 'create',
        event: data,
        message: parsedResponse.message || 'Event created successfully',
        requestId,
        processingTime: Date.now() - startTime,
      })
    }

    // 13. Handle UPDATE action
    if (parsedResponse.action === 'update') {
      const { event_id, updates } = parsedResponse

      if (!isValidUUID(event_id)) {
        console.log(`[${requestId}] Invalid event ID for update`)
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
        console.log(`[${requestId}] Event not found for update`)
        return NextResponse.json(
          { ...ERROR_RESPONSES.NOT_FOUND, message: 'Event not found' },
          { status: 404 }
        )
      }

      // Sanitize updates
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
          if (isNaN(dateCheck.getTime())) continue
          sanitizedUpdates[key] = value
        }
      }

      if (Object.keys(sanitizedUpdates).length === 0) {
        return NextResponse.json(
          { ...ERROR_RESPONSES.INVALID_INPUT, details: 'No valid updates provided' },
          { status: 400 }
        )
      }

      console.log(`[${requestId}] Updating event:`, event_id)

      const { data, error } = await supabase
        .from('events')
        .update(sanitizedUpdates)
        .eq('id', event_id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error(`[${requestId}] Update error:`, error)
        return NextResponse.json(
          { ...ERROR_RESPONSES.DATABASE_ERROR, message: 'Failed to update event' },
          { status: 500 }
        )
      }

      console.log(`[${requestId}] Event updated successfully`)
      return NextResponse.json({
        success: true,
        action: 'update',
        event: data,
        message: parsedResponse.message || 'Event updated successfully',
        requestId,
        processingTime: Date.now() - startTime,
      })
    }

    // 14. Handle DELETE action
    if (parsedResponse.action === 'delete') {
      const { event_id } = parsedResponse

      if (!isValidUUID(event_id)) {
        return NextResponse.json(
          { ...ERROR_RESPONSES.INVALID_INPUT, details: 'Invalid event ID' },
          { status: 400 }
        )
      }

      // Verify ownership
      const { data: existing, error: checkError } = await supabase
        .from('events')
        .select('id, title')
        .eq('id', event_id)
        .eq('user_id', user.id)
        .single()

      if (checkError || !existing) {
        return NextResponse.json(
          { ...ERROR_RESPONSES.NOT_FOUND, message: 'Event not found' },
          { status: 404 }
        )
      }

      console.log(`[${requestId}] Deleting event:`, event_id)

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event_id)
        .eq('user_id', user.id)

      if (error) {
        console.error(`[${requestId}] Delete error:`, error)
        return NextResponse.json(
          { ...ERROR_RESPONSES.DATABASE_ERROR, message: 'Failed to delete event' },
          { status: 500 }
        )
      }

      console.log(`[${requestId}] Event deleted successfully`)
      return NextResponse.json({
        success: true,
        action: 'delete',
        event_id,
        message: parsedResponse.message || 'Event deleted successfully',
        requestId,
        processingTime: Date.now() - startTime,
      })
    }

    // Should never reach here
    return NextResponse.json(
      ERROR_RESPONSES.SERVER_ERROR,
      { status: 500 }
    )

  } catch (error: any) {
    console.error(`[${requestId}] Unhandled error:`, {
      message: error.message,
      stack: error.stack?.slice(0, 500),
    })
    
    return NextResponse.json(
      {
        ...ERROR_RESPONSES.SERVER_ERROR,
        requestId,
        details: error.message,
        message: 'Something went wrong. Please try again.'
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
    version: '2.0',
  })
}