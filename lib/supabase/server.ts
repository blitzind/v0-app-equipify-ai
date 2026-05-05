import "server-only"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL")
}

if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Server Components may not allow setting cookies.
        }
      },
    },
  })
}

/** Authorization: Bearer … from the incoming request (e.g. right after client sign-in). */
export function getBearerAccessToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization")
  if (typeof authHeader !== "string") return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token || null
}

/** User-scoped client for route handlers when the session is not in cookies yet. */
export function createSupabaseClientWithAccessToken(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}
