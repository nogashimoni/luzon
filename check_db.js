import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pppcflsucxuniaoqviuc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwcGNmbHN1Y3h1bmlhb3F2aXVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDM3NTIsImV4cCI6MjA4NzYxOTc1Mn0.f_THWCZUAlBBKi6LNo2cQCbCc74j27ERRS_8M-lXU5M'
)

console.log('Testing Supabase connection...')

// Check if users table exists
const { data, error } = await supabase.from('users').select('count').limit(1)

if (error) {
  console.error('❌ Error:', error.message)
  console.log('\n⚠️  The database tables might not be created yet!')
  console.log('Please run the SQL from supabase/migrations/001_initial_schema.sql in Supabase SQL Editor')
} else {
  console.log('✅ Database connected successfully!')
  console.log('Users table exists and is accessible')
}

process.exit(0)
