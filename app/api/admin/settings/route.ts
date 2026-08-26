import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      .from('school_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Settings GET error:', err)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()

    const {
      school_name,
      latitude,
      longitude,
      radius_meters,
      max_accuracy_meters,
      attendance_start_time,
      late_after_time,
      attendance_end_time,
      timezone,
    } = body

    const updates: Record<string, unknown> = {}
    if (school_name !== undefined) updates.school_name = school_name
    if (latitude !== undefined) updates.latitude = latitude
    if (longitude !== undefined) updates.longitude = longitude
    if (radius_meters !== undefined) updates.radius_meters = radius_meters
    if (max_accuracy_meters !== undefined) updates.max_accuracy_meters = max_accuracy_meters
    if (attendance_start_time !== undefined) updates.attendance_start_time = attendance_start_time
    if (late_after_time !== undefined) updates.late_after_time = late_after_time
    if (attendance_end_time !== undefined) updates.attendance_end_time = attendance_end_time
    if (timezone !== undefined) updates.timezone = timezone
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('school_settings')
      .update(updates)
      .eq('id', 1)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Settings PATCH error:', err)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}