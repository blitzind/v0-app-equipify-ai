import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

const MANAGER_ROLES = ["owner", "admin", "manager"] as const

/** Owners, admins, and managers may manage QuickBooks and other org integrations. */
export async function requireOrgIntegrationAdmin(organizationId: string): Promise<
  | {
      userId: string
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
      svc: ReturnType<typeof createServiceRoleSupabaseClient>
    }
  | { error: NextResponse }
> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { error: NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 }) }
  }

  const platformAdmin = Boolean(user.email && isPlatformAdminEmail(user.email))

  if (!platformAdmin) {
    const { data: mem, error: memErr } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (memErr) {
      return {
        error: NextResponse.json(
          { error: "query_failed", message: memErr.message },
          { status: 500 },
        ),
      }
    }

    const role = mem?.role as string | undefined
    if (!role || !MANAGER_ROLES.includes(role as (typeof MANAGER_ROLES)[number])) {
      return {
        error: NextResponse.json(
          {
            error: "forbidden",
            message: "Only owners, admins, and managers can manage integrations.",
          },
          { status: 403 },
        ),
      }
    }
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return {
      error: NextResponse.json(
        { error: "service_unavailable", message: "Server configuration error." },
        { status: 503 },
      ),
    }
  }

  return { userId: user.id, supabase, svc }
}
