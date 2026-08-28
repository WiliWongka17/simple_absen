export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { haversineMeters } from '@/lib/geo'
import { validateAttendanceTime } from '@/lib/time'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
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

    const { token, nis, latitude, longitude, accuracy, device_id } = body

    // 0. Validasi device_id
    if (!device_id || typeof device_id !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Perangkat tidak dikenali, silakan muat ulang halaman.' },
        { status: 400 }
      )
    }

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

    // 3. Validasi GPS - cek parameter
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || typeof accuracy !== 'number') {
      return NextResponse.json(
        { success: false, message: 'Data lokasi tidak valid' },
        { status: 400 }
      )
    }

    // 4. Fetch student + settings in parallel (independent queries)
    const [studentResult, settingsResult] = await Promise.all([
      supabase
        .from('students')
        .select('id, nis, name, class_id, is_active, classes (id, name, grade)')
        .eq('nis', nis)
        .single(),
      supabase
        .from('school_settings')
        .select('latitude, longitude, radius_meters, max_accuracy_meters, attendance_start_time, late_after_time, attendance_end_time, timezone, enable_device_binding, max_students_per_device_per_day')
        .eq('id', 1)
        .single(),
    ])

    const { data: student, error: studentError } = studentResult
    const { data: settings, error: settingsError } = settingsResult

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

    // 8. Validasi device binding (anti-titip-absen)
    if (settings.enable_device_binding) {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: settings.timezone })

      const { data: deviceRecords } = await supabase
        .from('attendance_records')
        .select('student_id')
        .eq('device_id', device_id)
        .eq('attendance_date', today)

      if (deviceRecords && deviceRecords.length > 0) {
        const uniqueStudentIds = [...new Set(deviceRecords.map(r => r.student_id))]
        const deviceUsedByOtherStudent = !uniqueStudentIds.includes(student.id)

        if (uniqueStudentIds.length >= settings.max_students_per_device_per_day && deviceUsedByOtherStudent) {
          return NextResponse.json(
            { success: false, message: 'Perangkat ini sudah digunakan untuk absensi siswa lain hari ini. Setiap siswa harus absen menggunakan perangkat sendiri.' },
            { status: 400 }
          )
        }
      }
    }

    // 9. Cek duplikat absensi hari ini (timezone-aware)
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

    // 10. Simpan record absensi
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
        device_id,
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

    // 11. Upsert status harian -> HADIR via SCAN (menimpa status manual jika ada)
    const { error: dailyError } = await supabase
      .from('student_daily_status')
      .upsert(
        {
          student_id: student.id,
          status_date: today,
          status: 'HADIR',
          source: 'SCAN',
          updated_by: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,status_date' }
      )
    if (dailyError) {
      console.error('Upsert daily status error:', dailyError)
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