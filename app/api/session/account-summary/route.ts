import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getPlatformAdminEmails, isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { displayNameFromProfile } from "@/lib/user-display"
import type { SessionIdentity } from "@/lib/session-identity"

function allowPlatformAdminDebug(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true
  try {
    const u = new URL(request.url)
    return u.searchParams.get("debugPlatformAdmin") === "1"
  } catch {
    return false
  }
}

function platformAdminDebugFields(authEmailNormalized: string | null, matchResult: boolean) {
  const rawEnv = process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS
  const parsedAdminEmails = getPlatformAdminEmails()
  return {
    debugPlatformAdmin: true as const,
    authEmail: authEmailNormalized,
    envExists: typeof rawEnv === "string" && rawEnv.trim() !== "",
    parsedAdminEmails,
    parsedCount: parsedAdminEmails.length,
    matchResult,
  }
}

export async function GET(request: Request) {
  const debug = allowPlatformAdminDebug(request)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    if (debug) {
      return NextResponse.json({
        authenticated: false as const,
        ...platformAdminDebugFields(null, false),
      })
    }
    return NextResponse.json({ authenticated: false as const })
  }

  const email = user.email.trim()
  const authEmailNormalized = email.toLowerCase()
  const platformAdmin = isPlatformAdminEmail(email)

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  const row = profile as { full_name: string | null } | null

  const body: { authenticated: true } & SessionIdentity & Partial<
    ReturnType<typeof platformAdminDebugFields>
  > = {
    authenticated: true,
    email,
    displayName: displayNameFromProfile(row?.full_name, email),
    platformAdmin,
    platformRoleLabel: platformAdmin ? "Platform Admin" : null,
    ...(debug ? platformAdminDebugFields(authEmailNormalized, platformAdmin) : {}),
  }

  return NextResponse.json(body)
}
