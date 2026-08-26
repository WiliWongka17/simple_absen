import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const classId = searchParams.get('class_id')

    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        attendance_time,
        latitude,
        longitude,
        accuracy,
        distance_from_school,
        status,
        students (
          id,
          nis,
          name,
          class_id,
          classes (id, name, grade)
        )
      `)
      .eq('attendance_date', date)
      .order('attendance_time', { ascending: false })
      .limit(50)

    if (classId) {
      query = query.eq('students.class_id', classId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('Attendance list error:', err)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}