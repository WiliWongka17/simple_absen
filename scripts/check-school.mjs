import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function check() {
  const anonSupabase = createClient(supabaseUrl, anonKey)
  const { data, error } = await anonSupabase
    .from('school_settings')
    .select('*')
    .eq('id', 1)
    .single()

  console.log('With anon key:', data, error)
}

check()