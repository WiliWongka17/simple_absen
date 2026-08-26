import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  try {
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Sessions GET error:', err)
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()

    const { start_time, end_time, is_active = true } = body

    if (!start_time || !end_time) {
      return NextResponse.json(
        { success: false, message: 'Waktu mulai dan selesai wajib diisi' },
        { status: 400 }
      )
    }

    const token = randomUUID()

    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        token,
        start_time,
        end_time,
        is_active,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const qrUrl = `${baseUrl}/absen?token=${token}`

    return NextResponse.json({ success: true, data: { ...data, qr_url: qrUrl } })
  } catch (err) {
    console.error('Sessions POST error:', err)
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server' }, { status: 500 })
  }
}