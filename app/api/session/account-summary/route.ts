import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail, logPlatformAdminDevDiagnostics } from "@/lib/platform-admin"
import { displayNameFromProfile } from "@/lib/user-display"
import type { SessionIdentity } from "@/lib/session-identity"

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ authenticated: false as const })
  }

  const email = user.email.trim()
  const platformAdmin = isPlatformAdminEmail(email)

  logPlatformAdminDevDiagnostics("account-summary", email)

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  const row = profile as { full_name: string | null } | null

  const body: { authenticated: true } & SessionIdentity = {
    authenticated: true,
    email,
    displayName: displayNameFromProfile(row?.full_name, email),
    platformAdmin,
    platformRoleLabel: platformAdmin ? "Platform Admin" : null,
  }

  return NextResponse.json(body)
}
