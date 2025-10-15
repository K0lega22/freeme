// app/api/events/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/validation'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting: 100 requests per minute
    const rateLimit = checkRateLimit(user.id, 100, 60000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
          }
        }
      )
    }

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true })

    if (error) throw error

    return NextResponse.json({ events: events || [] })
  } catch (error) {
    console.error('Events API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}