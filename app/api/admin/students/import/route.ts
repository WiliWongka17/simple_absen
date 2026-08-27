import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface ImportRow {
  nis: string
  name: string
  className: string
  isActive: boolean
}

interface ImportError {
  row: number
  reason: string
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json({ success: false, error: 'Format file harus .xlsx' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'File kosong atau format tidak sesuai' }, { status: 400 })
    }

    const { data: existingClasses } = await supabase
      .from('classes')
      .select('id, name')

    const classMap = new Map<string, { id: string; name: string }>()
    if (existingClasses) {
      for (const cls of existingClasses) {
        classMap.set(cls.name.trim().toLowerCase(), { id: cls.id, name: cls.name })
      }
    }

    const parsedRows: ImportRow[] = []
    const errors: ImportError[] = []
    const seenNis = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      const rawNis = String(row['NIS'] ?? row['nis'] ?? '').trim()
      const rawName = String(row['Nama'] ?? row['nama'] ?? row['name'] ?? '').trim()
      const rawClass = String(row['Kelas'] ?? row['kelas'] ?? row['class'] ?? '').trim()
      const rawStatus = String(row['Status Aktif'] ?? row['status_aktif'] ?? row['status'] ?? 'AKTIF').trim().toUpperCase()

      if (!rawNis) {
        errors.push({ row: rowNum, reason: 'NIS kosong' })
        continue
      }
      if (!rawName) {
        errors.push({ row: rowNum, reason: 'Nama kosong' })
        continue
      }

      if (seenNis.has(rawNis)) {
        errors.push({ row: rowNum, reason: `NIS ${rawNis} duplikat dalam file` })
        continue
      }
      seenNis.add(rawNis)

      const classKey = rawClass.toLowerCase()
      const matchedClass = classMap.get(classKey)
      if (!matchedClass) {
        errors.push({ row: rowNum, reason: `Kelas tidak ditemukan: ${rawClass}` })
        continue
      }

      parsedRows.push({
        nis: rawNis,
        name: rawName,
        className: matchedClass.id,
        isActive: rawStatus !== 'TIDAK AKTIF',
      })
    }

    const { data: existingStudents } = await supabase
      .from('students')
      .select('nis')

    const existingNisSet = new Set(
      (existingStudents ?? []).map(s => s.nis)
    )

    const toInsert: Array<{ nis: string; name: string; class_id: string; is_active: boolean }> = []
    let skippedDuplicate = 0

    for (const row of parsedRows) {
      if (existingNisSet.has(row.nis)) {
        skippedDuplicate++
        continue
      }
      toInsert.push({
        nis: row.nis,
        name: row.name,
        class_id: row.className,
        is_active: row.isActive,
      })
    }

    let inserted = 0
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from('students')
        .insert(toInsert)
        .select()

      if (error) {
        return NextResponse.json(
          { success: false, error: `Gagal insert: ${error.message}` },
          { status: 500 }
        )
      }
      inserted = data?.length ?? toInsert.length
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_rows: rows.length,
        berhasil: inserted,
        dilewati_duplikat: skippedDuplicate,
        gagal: errors.length,
      },
      errors,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Gagal memproses file' },
      { status: 500 }
    )
  }
}
