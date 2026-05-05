import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

/**
 * Returns `organization_subscriptions` for the active org sidebar / tenant sync.
 * Platform admins may read any org (impersonation). Other users only when they are active members.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organizationId")?.trim()
    if (!organizationId) {
      return NextResponse.json({ message: "organizationId required" }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const platformAdmin = isPlatformAdminEmail(user.email)

    if (!platformAdmin) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle()

      if (!membership) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }

      const { data: sub, error } = await supabase
        .from("organization_subscriptions")
        .select("plan_id, status, intended_plan_id")
        .eq("organization_id", organizationId)
        .maybeSingle()

      if (error) {
        return NextResponse.json({ message: error.message }, { status: 500 })
      }
      return NextResponse.json({ subscription: sub ?? null })
    }

    const admin = createServiceRoleSupabaseClient()
    const { data: sub, error } = await admin
      .from("organization_subscriptions")
      .select("plan_id, status, intended_plan_id")
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    return NextResponse.json({ subscription: sub ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
