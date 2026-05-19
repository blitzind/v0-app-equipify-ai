import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

function oauthFailureRedirect(origin: string, next: string | null): NextResponse {
  const safeNext = next?.startsWith("/") ? next : null
  if (safeNext?.startsWith("/onboarding")) {
    const url = new URL(safeNext, origin)
    url.searchParams.set("error", "oauth")
    return NextResponse.redirect(url.toString())
  }
  return NextResponse.redirect(`${origin}/login?error=oauth`)
}

/**
 * Supabase Auth OAuth callback (Google, etc.).
 * Exchanges the authorization code for a session cookie, then redirects into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error")

  if (oauthError) {
    return oauthFailureRedirect(origin, next)
  }

  if (!code) {
    return oauthFailureRedirect(origin, next)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
            // Called from a context that cannot set cookies — session may not persist.
          }
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return oauthFailureRedirect(origin, next)
  }

  const safeNext = next.startsWith("/") ? next : "/"
  return NextResponse.redirect(`${origin}${safeNext}`)
}
