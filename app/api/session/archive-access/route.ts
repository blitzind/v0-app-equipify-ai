import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { userHasOnlyArchivedOrganizationMemberships } from "@/lib/supabase/archived-membership-query"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

export const dynamic = "force-dynamic"

/**
 * True when the signed-in user should not use the customer dashboard (all memberships are archived orgs).
 * Platform admins always get blocked: false so they can reach /admin and tooling.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ blocked: false })
  }

  const email = user.email?.trim()
  if (email && isPlatformAdminEmail(email)) {
    return NextResponse.json({ blocked: false })
  }

  const blocked = await userHasOnlyArchivedOrganizationMemberships(supabase, user.id)
  return NextResponse.json({ blocked })
}
