import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      return NextResponse.json({ success: false, error: 'Missing env vars', url: !!url, key: !!key }, { status: 500 })
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Test query
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .limit(1)

    return NextResponse.json({ 
      success: !error,
      data,
      error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined
    }, { status: 500 })
  }
}