import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function createAdmin() {
  const email = process.argv[2] || 'admin@sekolah.sch.id'
  const password = process.argv[3] || 'password123'
  const fullName = process.argv[4] || 'Administrator'

  console.log('Creating admin user:', email)

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })

  if (authError) {
    console.error('Auth error:', authError.message)
    return
  }

  console.log('Auth user created:', authData.user.id)

  const { error: profileError } = await supabase
    .from('admin_profiles')
    .insert({
      id: authData.user.id,
      full_name: fullName,
      role: 'superadmin'
    })

  if (profileError) {
    console.error('Profile error:', profileError.message)
    return
  }

  console.log('Admin profile created successfully!')
  console.log('Email:', email)
  console.log('Password:', password)
}

createAdmin()