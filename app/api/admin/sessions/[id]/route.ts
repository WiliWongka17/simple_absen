import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient()
  const { id } = await params

  const { count } = await supabase
    .from('attendance_records')
    .select('id', { count: 'exact', head: true })
    .eq('attendance_session_id', id)

  if (count && count > 0) {
    return NextResponse.json(
      { success: false, error: `Sesi ini memiliki ${count} data absensi, tidak bisa dihapus.` },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('attendance_sessions')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
