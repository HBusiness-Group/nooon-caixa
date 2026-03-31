import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://yxwwxopbrwcvwsozsyfv.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d3d4b3Bicndjdndzb3pzeWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzA4NjgsImV4cCI6MjA5MDQ0Njg2OH0.yU0PQVcQqpZ4Xk9mZVoNde9SgRJjE-QbHwePYffbn1I'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
