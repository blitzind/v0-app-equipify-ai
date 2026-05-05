import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL")
}

if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

        response = NextResponse.next({
          request,
        })

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}

/** True when the user has at least one active membership but every org is archived. */
export async function membershipOnlyArchivedOrgs(request: NextRequest, userId: string): Promise<boolean> {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data: rows } = await supabase
    .from("organization_members")
    .select("organizations(status)")
    .eq("user_id", userId)
    .eq("status", "active")

  const list = rows ?? []
  if (list.length === 0) return false

  for (const row of list) {
    const o = row.organizations as { status?: string } | { status?: string }[] | null
    const org = Array.isArray(o) ? o[0] : o
    const st = org?.status ?? "active"
    if (st !== "archived") return false
  }
  return true
}

export async function signOutAndRedirect(request: NextRequest, redirectPath: string): Promise<NextResponse> {
  const url = new URL(redirectPath, request.url)
  let response = NextResponse.redirect(url)
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })
  await supabase.auth.signOut()
  return response
}
