import {createClient} from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Supabase URL environment variable not provided')
}

if (!supabaseAnonKey) {
  throw new Error('Supabase Anon')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
