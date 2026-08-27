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

export async function GET() {
  try {
    const supabase = getSupabase()
    const { data: classes } = await supabase
      .from('classes')
      .select('name, grade')
      .eq('is_active', true)
      .order('grade')

    const wb = XLSX.utils.book_new()

    const templateData = [
      ['NIS', 'Nama', 'Kelas', 'Status Aktif'],
      ['12345', 'Budi Santoso', 'X IPA 1', 'AKTIF'],
      ['67890', 'Siti Aminah', 'XI IPS 2', 'AKTIF'],
    ]
    const wsTemplate = XLSX.utils.aoa_to_sheet(templateData)
    wsTemplate['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
    ]
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template')

    if (classes && classes.length > 0) {
      const classData = [
        ['Nama Kelas (copy-paste ke kolom Kelas di sheet Template)'],
        ...classes.map(c => [
          c.grade ? `${c.grade} ${c.name}` : c.name,
        ]),
      ]
      const wsClasses = XLSX.utils.aoa_to_sheet(classData)
      wsClasses['!cols'] = [{ wch: 40 }]
      XLSX.utils.book_append_sheet(wb, wsClasses, 'Daftar Kelas')
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template_import_siswa.xlsx"',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Gagal membuat template' },
      { status: 500 }
    )
  }
}
