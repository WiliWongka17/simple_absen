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

    // Get total active students
    let studentsQuery = supabase
      .from('students')
      .select('id', { count: 'exact' })
      .eq('is_active', true)

    if (classId) {
      studentsQuery = studentsQuery.eq('class_id', classId)
    }

    const { count: totalStudents } = await studentsQuery

    // Get attendance records for the date
    let attendanceQuery = supabase
      .from('attendance_records')
      .select('id, status, student_id, students!inner(class_id)')
      .eq('attendance_date', date)

    if (classId) {
      attendanceQuery = attendanceQuery.eq('students.class_id', classId)
    }

    const { data: attendanceData } = await attendanceQuery

    const hadir = attendanceData?.filter(r => r.status === 'HADIR').length || 0
    const terlambat = attendanceData?.filter(r => r.status === 'TERLAMBAT').length || 0
    const totalAbsent = attendanceData?.length || 0
    const belumAbsen = (totalStudents || 0) - totalAbsent
    const persentase = totalStudents ? Math.round(((hadir + terlambat) / totalStudents) * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        total_siswa: totalStudents || 0,
        hadir,
        terlambat,
        belum_absen: Math.max(0, belumAbsen),
        persentase_kehadiran: persentase,
        date,
      }
    })
  } catch (err) {
    console.error('Dashboard error:', err)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}