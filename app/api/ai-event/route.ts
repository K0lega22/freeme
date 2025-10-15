// app/api/ai-event/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { sanitizeInput, validateEventData, checkRateLimit } from '@/lib/validation'

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://freeme.app',
    'X-Title': 'Freeme Calendar',
  },
})

function extractJSON(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('No valid JSON found')
  }
}

export async function POST(request: Request) {
  try {
    // Authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting: 10 requests per minute
    const rateLimit = checkRateLimit(user.id, 10, 60000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before trying again.' },
        { status: 429 }
      )
    }

    // Parse and validate input
    const body = await request.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 })
    }

    if (prompt.length > 500) {
      return NextResponse.json({ error: 'Prompt too long (max 500 characters)' }, { status: 400 })
    }

    // Sanitize input
    const sanitizedPrompt = sanitizeInput(prompt.trim())

    // Fetch existing events
    const { data: existingEvents } = await supabase
      .from('events')
      .select('id, title, start_time, end_time, location')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true })
      .limit(50)

    const systemPrompt = `You are Freeme's AI assistant. Respond with ONLY valid JSON.

Current date: ${new Date().toISOString()}

Existing events:
${JSON.stringify(existingEvents || [], null, 2)}

Response format:

CREATE:
{
  "action": "create",
  "event": {
    "title": "string",
    "description": "string or null",
    "start_time": "ISO 8601 date",
    "end_time": "ISO 8601 date",
    "location": "string or null"
  },
  "message": "confirmation message"
}

UPDATE:
{
  "action": "update",
  "event_id": "uuid",
  "updates": { "field": "value" },
  "message": "confirmation message"
}

DELETE:
{
  "action": "delete",
  "event_id": "uuid",
  "message": "confirmation message"
}

RESPOND WITH ONLY THE JSON OBJECT.`

    // Call AI
    const completion = await openai.chat.completions.create({
      model: 'anthropic/claude-4.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sanitizedPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1000,
    })

    const responseText = completion.choices[0].message.content || '{}'
    const parsedResponse = extractJSON(responseText)

    // Validate response structure
    if (!parsedResponse.action || !['create', 'update', 'delete'].includes(parsedResponse.action)) {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    // Execute CREATE
    if (parsedResponse.action === 'create') {
      const validation = validateEventData(parsedResponse.event)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('events')
        .insert({
          title: sanitizeInput(parsedResponse.event.title).slice(0, 200),
          description: parsedResponse.event.description 
            ? sanitizeInput(parsedResponse.event.description).slice(0, 1000) 
            : null,
          start_time: parsedResponse.event.start_time,
          end_time: parsedResponse.event.end_time,
          location: parsedResponse.event.location 
            ? sanitizeInput(parsedResponse.event.location).slice(0, 200) 
            : null,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) {
        console.error('Insert error:', error.code)
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        event: data,
        message: sanitizeInput(parsedResponse.message || 'Event created')
      })
    }

    // Execute UPDATE
    if (parsedResponse.action === 'update') {
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('id', parsedResponse.event_id)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      const sanitizedUpdates: any = {}
      if (parsedResponse.updates.title) {
        sanitizedUpdates.title = sanitizeInput(parsedResponse.updates.title).slice(0, 200)
      }
      if (parsedResponse.updates.description) {
        sanitizedUpdates.description = sanitizeInput(parsedResponse.updates.description).slice(0, 1000)
      }
      if (parsedResponse.updates.location) {
        sanitizedUpdates.location = sanitizeInput(parsedResponse.updates.location).slice(0, 200)
      }
      if (parsedResponse.updates.start_time) {
        sanitizedUpdates.start_time = parsedResponse.updates.start_time
      }
      if (parsedResponse.updates.end_time) {
        sanitizedUpdates.end_time = parsedResponse.updates.end_time
      }

      const { data, error } = await supabase
        .from('events')
        .update(sanitizedUpdates)
        .eq('id', parsedResponse.event_id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        event: data,
        message: sanitizeInput(parsedResponse.message || 'Event updated')
      })
    }

    // Execute DELETE
    if (parsedResponse.action === 'delete') {
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('id', parsedResponse.event_id)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', parsedResponse.event_id)
        .eq('user_id', user.id)

      if (error) {
        return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: sanitizeInput(parsedResponse.message || 'Event deleted')
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error) {
    console.error('AI API Error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
