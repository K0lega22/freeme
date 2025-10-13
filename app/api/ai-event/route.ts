import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://freeme.app',
    'X-Title': 'Freeme Calendar',
  },
})

// Helper function to extract JSON from various formats
function extractJSON(text: string): any {
  try {
    // First, try direct parsing
    return JSON.parse(text)
  } catch {
    try {
      // Try to extract JSON from markdown code blocks
      const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1])
      }
      
      // Try to find JSON object in text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      throw new Error('No valid JSON found in response')
    } catch (innerError) {
      throw new Error('Failed to extract valid JSON from response')
    }
  }
}

// Validate parsed response structure
function validateResponse(response: any): { valid: boolean; error?: string } {
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'Response is not an object' }
  }

  if (!response.action || !['create', 'update', 'delete'].includes(response.action)) {
    return { valid: false, error: 'Invalid or missing action' }
  }

  if (response.action === 'create') {
    if (!response.event || typeof response.event !== 'object') {
      return { valid: false, error: 'Missing event object for create action' }
    }
    if (!response.event.title || typeof response.event.title !== 'string') {
      return { valid: false, error: 'Missing or invalid event title' }
    }
    if (!response.event.start_time || typeof response.event.start_time !== 'string') {
      return { valid: false, error: 'Missing or invalid start_time' }
    }
    if (!response.event.end_time || typeof response.event.end_time !== 'string') {
      return { valid: false, error: 'Missing or invalid end_time' }
    }
  }

  if (response.action === 'update') {
    if (!response.event_id || typeof response.event_id !== 'string') {
      return { valid: false, error: 'Missing or invalid event_id for update' }
    }
    if (!response.updates || typeof response.updates !== 'object') {
      return { valid: false, error: 'Missing updates object for update action' }
    }
  }

  if (response.action === 'delete') {
    if (!response.event_id || typeof response.event_id !== 'string') {
      return { valid: false, error: 'Missing or invalid event_id for delete' }
    }
  }

  return { valid: true }
}

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 })
    }
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existingEvents } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true })

    const systemPrompt = `You are Freeme's AI assistant. You MUST respond with ONLY valid JSON, no other text, no markdown, no explanations.

Current date and time: ${new Date().toISOString()}

User's existing events:
${JSON.stringify(existingEvents || [], null, 2)}

CRITICAL: Your response must be ONLY a valid JSON object. Do not include any text before or after the JSON. Do not use markdown code blocks. Do not add explanations.

Response format examples:

For CREATE requests:
{
  "action": "create",
  "event": {
    "title": "Meeting Title",
    "description": "Optional description",
    "start_time": "2025-10-15T14:00:00Z",
    "end_time": "2025-10-15T15:00:00Z",
    "location": "Optional location"
  },
  "message": "I've scheduled your meeting for October 15th at 2:00 PM"
}

For UPDATE requests (identify by matching title/time from existing events):
{
  "action": "update",
  "event_id": "uuid-of-matching-event",
  "updates": {
    "title": "New title",
    "start_time": "2025-10-16T14:00:00Z"
  },
  "message": "I've updated your meeting to October 16th"
}

For DELETE requests (identify by matching title/time from existing events):
{
  "action": "delete",
  "event_id": "uuid-of-matching-event",
  "message": "I've deleted your meeting"
}

Rules:
- Always use ISO 8601 format for dates (YYYY-MM-DDTHH:mm:ssZ)
- Default to 1-hour duration if end time not specified
- Interpret "tomorrow", "next week", "Monday", etc. relative to current time
- For updates/deletes, find matching event_id from existing events by title or time
- If ambiguous, choose the most recent or upcoming event
- Always include a friendly, natural confirmation message
- For times, assume user's timezone is local unless specified

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`

    const completion = await openai.chat.completions.create({
      model: 'anthropic/claude-4.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const responseText = completion.choices[0].message.content || '{}'
    
    // Log the raw response for debugging
    console.log('Raw AI Response:', responseText)
    
    // Extract JSON from response
    let parsedResponse
    try {
      parsedResponse = extractJSON(responseText)
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError)
      console.error('Failed Response Text:', responseText)
      return NextResponse.json({ 
        error: 'Failed to parse AI response. Please try rephrasing your request.',
        ...(process.env.NODE_ENV === 'development' && { 
          debug: { 
            rawResponse: responseText,
            error: String(parseError)
          } 
        })
      }, { status: 500 })
    }

    // Validate response structure
    const validation = validateResponse(parsedResponse)
    if (!validation.valid) {
      console.error('Validation Error:', validation.error)
      console.error('Invalid Response:', parsedResponse)
      return NextResponse.json({ 
        error: `AI response validation failed: ${validation.error}`,
        ...(process.env.NODE_ENV === 'development' && { 
          debug: { 
            response: parsedResponse,
            validationError: validation.error
          } 
        })
      }, { status: 500 })
    }

    // Execute CREATE action
    if (parsedResponse.action === 'create') {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: parsedResponse.event.title,
          description: parsedResponse.event.description || null,
          start_time: parsedResponse.event.start_time,
          end_time: parsedResponse.event.end_time,
          location: parsedResponse.event.location || null,
          user_id: user.id,
        })
        .select()

      if (error) {
        console.error('Supabase Insert Error:', error)
        throw error
      }

      return NextResponse.json({ 
        success: true, 
        event: data[0], 
        message: parsedResponse.message || 'Event created successfully!' 
      })
    }

    // Execute UPDATE action
    if (parsedResponse.action === 'update') {
      // First verify the event exists and belongs to the user
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('id', parsedResponse.event_id)
        .eq('user_id', user.id)
        .single()

      if (!existingEvent) {
        return NextResponse.json({ 
          error: 'Event not found or you do not have permission to update it' 
        }, { status: 404 })
      }

      const { data, error } = await supabase
        .from('events')
        .update(parsedResponse.updates)
        .eq('id', parsedResponse.event_id)
        .eq('user_id', user.id)
        .select()

      if (error) {
        console.error('Supabase Update Error:', error)
        throw error
      }

      if (!data || data.length === 0) {
        return NextResponse.json({ 
          error: 'Failed to update event' 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        event: data[0], 
        message: parsedResponse.message || 'Event updated successfully!' 
      })
    }

    // Execute DELETE action
    if (parsedResponse.action === 'delete') {
      // First verify the event exists and belongs to the user
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id, title')
        .eq('id', parsedResponse.event_id)
        .eq('user_id', user.id)
        .single()

      if (!existingEvent) {
        return NextResponse.json({ 
          error: 'Event not found or you do not have permission to delete it' 
        }, { status: 404 })
      }

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', parsedResponse.event_id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Supabase Delete Error:', error)
        throw error
      }

      return NextResponse.json({ 
        success: true, 
        message: parsedResponse.message || 'Event deleted successfully!' 
      })
    }

    // This shouldn't happen due to validation, but just in case
    return NextResponse.json({ 
      error: 'Unknown action type' 
    }, { status: 400 })

  } catch (error) {
    console.error('AI API Error:', error)
    return NextResponse.json({ 
      error: 'Failed to process request. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { 
        details: String(error) 
      })
    }, { status: 500 })
  }
}