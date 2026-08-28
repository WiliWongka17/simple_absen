export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getAdminUserId(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(url, anonKey, {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const classId = searchParams.get('class_id')

    // 1. Fetch active students (with class info)
    let studentQuery = supabase
      .from('students')
      .select('id, nis, name, class_id, classes (id, name, grade)')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (classId) {
      studentQuery = studentQuery.eq('class_id', classId)
    }

    const { data: students, error: studentError } = await studentQuery
    if (studentError) {
      return NextResponse.json({ success: false, error: studentError.message }, { status: 500 })
    }
    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const studentIds = students.map(s => s.id)

    // 2. Fetch daily status for date
    const { data: dailyRows } = await supabase
      .from('student_daily_status')
      .select('student_id, status, source, updated_at')
      .eq('status_date', date)
      .in('student_id', studentIds)

    const statusMap = new Map<string, { status: string; source: string; updated_at: string }>()
    for (const r of dailyRows || []) {
      statusMap.set(r.student_id, { status: r.status, source: r.source, updated_at: r.updated_at })
    }

    // 3. Fetch attendance_time for date (jam scan)
    const { data: recordRows } = await supabase
      .from('attendance_records')
      .select('student_id, attendance_time')
      .eq('attendance_date', date)
      .in('student_id', studentIds)

    const timeMap = new Map<string, string>()
    for (const r of recordRows || []) {
      timeMap.set(r.student_id, r.attendance_time)
    }

    // 4. Merge
    const data = students.map(s => {
      const daily = statusMap.get(s.id)
      const cls = (s as any).classes
      return {
        id: s.id,
        student_id: s.id,
        nis: s.nis,
        name: s.name,
        class_id: s.class_id,
        classes: cls || null,
        daily_status: daily?.status ?? 'BELUM_ABSEN',
        source: daily?.source ?? null,
        attendance_time: timeMap.get(s.id) ?? null,
        status_date: date,
      }
    })

    // Sort by class then name
    data.sort((a: any, b: any) => {
      const ca = a.classes ? `${a.classes.grade || ''} ${a.classes.name}` : ''
      const cb = b.classes ? `${b.classes.grade || ''} ${b.classes.name}` : ''
      if (ca !== cb) return ca.localeCompare(cb)
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Attendance status GET error:', err)
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { student_id, status_date, status } = body

    if (!student_id || !status_date || !status) {
      return NextResponse.json({ success: false, error: 'student_id, status_date, dan status wajib diisi' }, { status: 400 })
    }

    const allowed = ['HADIR', 'BELUM_ABSEN', 'TIDAK_HADIR']
    if (!allowed.includes(status)) {
      return NextResponse.json({ success: false, error: 'Status tidak valid' }, { status: 400 })
    }

    // Validate student exists and is active (optional)
    const updated_by = await getAdminUserId()

    const { error } = await supabase
      .from('student_daily_status')
      .upsert(
        {
          student_id,
          status_date,
          status,
          source: 'MANUAL',
          updated_by,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,status_date' }
      )

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Attendance status PATCH error:', err)
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
