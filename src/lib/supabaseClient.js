import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are missing — copy .env.example to .env.local and fill in your project values.')
}

// PKCE keeps the Google sign-in result out of the URL hash (an auth code is
// exchanged instead of tokens being returned in the redirect).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
})

export const ZOPPER_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@zopper\.com$/i

export function isZopperEmail(email) {
  return ZOPPER_EMAIL_RE.test((email || '').trim())
}
