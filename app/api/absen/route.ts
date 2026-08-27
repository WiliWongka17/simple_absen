import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { haversineMeters } from '@/lib/geo'
import { validateAttendanceTime } from '@/lib/time'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { token, nis, latitude, longitude, accuracy } = body

    // 1. Validasi token
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, message: 'QR Code tidak valid. Silakan scan QR Code yang terbaru.' },
        { status: 400 }
      )
    }

    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, token, start_time, end_time, is_active')
      .eq('token', token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, message: 'QR Code sudah tidak berlaku. Silakan scan QR Code yang terbaru.' },
        { status: 400 }
      )
    }

    if (!session.is_active) {
      return NextResponse.json(
        { success: false, message: 'QR Code sudah tidak berlaku. Silakan scan QR Code yang terbaru.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const startTime = new Date(session.start_time)
    const endTime = new Date(session.end_time)

    if (now < startTime || now > endTime) {
      return NextResponse.json(
        { success: false, message: 'QR Code sudah tidak berlaku. Silakan scan QR Code yang terbaru.' },
        { status: 400 }
      )
    }

    // 2. Validasi NIS
    if (!nis || typeof nis !== 'string') {
      return NextResponse.json(
        { success: false, message: 'NIS wajib diisi' },
        { status: 400 }
      )
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, nis, name, class_id, is_active, classes (id, name, grade)')
      .eq('nis', nis)
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { success: false, message: 'NIS tidak ditemukan. Silakan periksa kembali NIS Anda.' },
        { status: 400 }
      )
    }

    if (!student.is_active) {
      return NextResponse.json(
        { success: false, message: 'Siswa tidak aktif. Hubungi admin.' },
        { status: 400 }
      )
    }

    // 3. Validasi GPS - cek parameter
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || typeof accuracy !== 'number') {
      return NextResponse.json(
        { success: false, message: 'Data lokasi tidak valid' },
        { status: 400 }
      )
    }

    // 4. Ambil school settings (termasuk time settings)
    const { data: settings, error: settingsError } = await supabase
      .from('school_settings')
      .select('latitude, longitude, radius_meters, max_accuracy_meters, attendance_start_time, late_after_time, attendance_end_time, timezone')
      .eq('id', 1)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json(
        { success: false, message: 'Pengaturan sekolah tidak ditemukan' },
        { status: 500 }
      )
    }

    // 5. Validasi accuracy
    if (accuracy > settings.max_accuracy_meters) {
      return NextResponse.json(
        { success: false, message: 'Akurasi lokasi Anda kurang baik. Silakan coba kembali di area terbuka.' },
        { status: 400 }
      )
    }

    // 6. Hitung jarak dengan Haversine
    const distance = haversineMeters(
      latitude,
      longitude,
      settings.latitude,
      settings.longitude
    )

    if (distance > settings.radius_meters) {
      return NextResponse.json(
        { success: false, message: 'Anda berada di luar area sekolah.' },
        { status: 400 }
      )
    }

    // 7. Validasi waktu absensi (timezone-aware)
    const timeValidation = validateAttendanceTime({
      attendance_start_time: settings.attendance_start_time,
      late_after_time: settings.late_after_time,
      attendance_end_time: settings.attendance_end_time,
      timezone: settings.timezone,
    })

    if (!timeValidation.valid) {
      return NextResponse.json(
        { success: false, message: timeValidation.message },
        { status: 400 }
      )
    }

    const status = timeValidation.status!

    const schoolNow = new Date().toLocaleString('sv-SE', { timeZone: settings.timezone })

    // 8. Cek duplikat absensi hari ini (timezone-aware)
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: settings.timezone })
    const { data: existingRecord, error: dupError } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('student_id', student.id)
      .eq('attendance_date', today)
      .single()

    if (dupError && dupError.code !== 'PGRST116') {
      return NextResponse.json(
        { success: false, message: 'Terjadi kesalahan server' },
        { status: 500 }
      )
    }

    if (existingRecord) {
      return NextResponse.json(
        { success: false, message: 'Anda sudah melakukan absensi hari ini.' },
        { status: 400 }
      )
    }

    // 9. Simpan record absensi
    const { data: record, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        student_id: student.id,
        attendance_session_id: session.id,
        attendance_date: today,
        attendance_time: schoolNow,
        latitude,
        longitude,
        accuracy,
        distance_from_school: Math.round(distance),
        status,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert attendance error:', insertError)
      return NextResponse.json(
        { success: false, message: 'Gagal menyimpan absensi' },
        { status: 500 }
      )
    }

    const classInfo = (student.classes as any[])?.find?.(() => true) ?? null

    return NextResponse.json({
      success: true,
      message: `Absensi berhasil - ${status}`,
      data: {
        nis: student.nis,
        name: student.name,
        class: classInfo ? `${classInfo.grade || ''} ${classInfo.name}`.trim() : '—',
        time: timeValidation.currentTime,
        status,
        distance: Math.round(distance),
        accuracy,
      }
    })
  } catch (err) {
    console.error('Absen error:', err)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}