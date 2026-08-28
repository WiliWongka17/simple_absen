export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const STATUS_LABEL: Record<string, string> = {
  HADIR: 'Hadir',
  TIDAK_HADIR: 'Tidak Hadir',
  BELUM_ABSEN: 'Belum Absen',
}

const MAX_RANGE_DAYS = 92

function buildDateList(from: string, to: string): string[] {
  const pad = (n: number) => String(n).padStart(2, '0')
  const dates: string[] = []
  let y = +from.slice(0, 4)
  let m = +from.slice(5, 7)
  let d = +from.slice(8, 10)
  const endY = +to.slice(0, 4)
  const endM = +to.slice(5, 7)
  const endD = +to.slice(8, 10)
  while (y < endY || (y === endY && (m < endM || (m === endM && d <= endD)))) {
    dates.push(`${y}-${pad(m)}-${pad(d)}`)
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
    const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    d += 1
    if (d > dim[m - 1]) {
      d = 1
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
  }
  return dates
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const today = new Date().toISOString().split('T')[0]
    const from = searchParams.get('from') || searchParams.get('date') || today
    const to = searchParams.get('to') || searchParams.get('date') || today
    const classId = searchParams.get('class_id')

    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRe.test(from) || !dateRe.test(to) || isNaN(Date.parse(`${from}T00:00:00`)) || isNaN(Date.parse(`${to}T00:00:00`))) {
      return NextResponse.json({ success: false, message: 'Format tanggal tidak valid' }, { status: 400 })
    }

    if (from > to) {
      return NextResponse.json({ success: false, message: 'Tanggal "dari" tidak boleh setelah "sampai"' }, { status: 400 })
    }

    const diffDays = Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86400000)
    if (diffDays > MAX_RANGE_DAYS) {
      return NextResponse.json({ success: false, message: 'Rentang tanggal maksimal 3 bulan.' }, { status: 400 })
    }

    const dates = buildDateList(from, to)
    const dateHeaders = dates.map(ds => `${ds.slice(8, 10)}/${ds.slice(5, 7)}`)

    let studentQuery = supabase
      .from('students')
      .select('id, nis, name, class_id, classes (id, name, grade)')
      .eq('is_active', true)

    if (classId) {
      studentQuery = studentQuery.eq('class_id', classId)
    }

    const { data: students, error: studentError } = await studentQuery
    if (studentError) {
      return NextResponse.json({ success: false, error: studentError.message }, { status: 500 })
    }

    const className = (s: any) =>
      s.classes ? `${s.classes.grade || ''} ${s.classes.name || ''}`.trim() : ''

    const sortedStudents = [...(students || [])].sort((a: any, b: any) => {
      const ca = className(a)
      const cb = className(b)
      if (ca !== cb) return ca.localeCompare(cb)
      return a.name.localeCompare(b.name)
    })

    const statusMap = new Map<string, string>()
    if (sortedStudents.length > 0) {
      const { data: dailyRows, error: dailyError } = await supabase
        .from('student_daily_status')
        .select('student_id, status_date, status')
        .gte('status_date', from)
        .lte('status_date', to)
        .in('student_id', sortedStudents.map((s: any) => s.id))

      if (dailyError) {
        return NextResponse.json({ success: false, error: dailyError.message }, { status: 500 })
      }
      for (const r of dailyRows || []) {
        statusMap.set(`${r.student_id}|${r.status_date}`, r.status)
      }
    }

    const headerRow = ['No', 'NIS', 'Nama', 'Kelas', ...dateHeaders, 'Total Hadir', 'Total Tidak Hadir', 'Total Belum Absen', '% Kehadiran']

    const body = sortedStudents.map((s: any, i: number) => {
      const counts: Record<string, number> = { HADIR: 0, TIDAK_HADIR: 0, BELUM_ABSEN: 0 }
      const cells: (string | number)[] = [i + 1, s.nis, s.name, className(s)]
      for (const d of dates) {
        const status = statusMap.get(`${s.id}|${d}`) || 'BELUM_ABSEN'
        counts[status] = (counts[status] || 0) + 1
        cells.push(STATUS_LABEL[status] || status)
      }
      const totalDates = dates.length || 1
      const pct = (counts.HADIR / totalDates) * 100
      cells.push(counts.HADIR, counts.TIDAK_HADIR, counts.BELUM_ABSEN, `${pct.toFixed(1)}%`)
      return cells
    })

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...body])
    ws['!cols'] = [
      { wch: 4 },
      { wch: 10 },
      { wch: 28 },
      { wch: 14 },
      ...dateHeaders.map(() => ({ wch: 10 })),
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="rekap-absensi-${from}-sd-${to}.xlsx"`,
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