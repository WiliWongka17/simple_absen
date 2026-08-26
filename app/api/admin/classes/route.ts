import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('grade', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

export async function POST(request: Request) {
  const supabase = createAdminClient()
  const body = await request.json()

  const { name, grade, is_active = true } = body

  if (!name) {
    return NextResponse.json({ success: false, error: 'Nama kelas wajib diisi' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('classes')
    .insert({ name, grade: grade || null, is_active })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}