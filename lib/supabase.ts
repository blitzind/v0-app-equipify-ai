import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL")
}

if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

function normalizeSupabaseProjectUrl(url: string) {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL: must be a valid absolute URL")
  }

  return parsed.origin
}

export const supabase = createClient(
  normalizeSupabaseProjectUrl(supabaseUrl),
  supabaseAnonKey,
)
