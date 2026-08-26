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
        attendance_date,
        attendance_time,
        students!inner (
          nis,
          name,
          class_id,
          classes (name, grade)
        ),
        latitude,
        longitude,
        accuracy,
        distance_from_school,
        status
      `)
      .eq('attendance_date', date)
      .order('attendance_time', { ascending: true })

    if (classId) {
      query = query.eq('students.class_id', classId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Build CSV
    const headers = [
      'Tanggal',
      'NIS',
      'Nama',
      'Kelas',
      'Jam',
      'Status',
      'Latitude',
      'Longitude',
      'Akurasi',
      'Jarak (meter)',
    ]

    const rows = (data || []).map((record: any) => [
      record.attendance_date,
      record.students?.nis || '',
      record.students?.name || '',
      record.students?.classes ? `${record.students.classes.grade || ''} ${record.students.classes.name}`.trim() : '',
      new Date(record.attendance_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      record.status,
      record.latitude?.toFixed(6) || '',
      record.longitude?.toFixed(6) || '',
      record.accuracy?.toFixed(1) || '',
      record.distance_from_school?.toFixed(1) || '',
    ])

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="absensi-${date}.csv"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}