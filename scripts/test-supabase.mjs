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

async function test() {
  console.log('Testing connection to:', supabaseUrl)
  
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .limit(1)

  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log('Success:', data)
  }
}

test()