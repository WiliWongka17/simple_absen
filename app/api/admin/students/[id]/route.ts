import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient()
  const { id } = await params
  const body = await request.json()

  const { nis, name, class_id, is_active } = body

  const updates: Record<string, unknown> = {}
  if (nis !== undefined) updates.nis = nis
  if (name !== undefined) updates.name = name
  if (class_id !== undefined) updates.class_id = class_id || null
  if (is_active !== undefined) updates.is_active = is_active
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'NIS sudah terdaftar' }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient()
  const { id } = await params

  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}