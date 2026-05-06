import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

const MANAGER_ROLES = ["owner", "admin", "manager"] as const

export async function requireOrgCatalogWrite(organizationId: string): Promise<
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

  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  const role = mem?.role as string | undefined
  if (!role || !MANAGER_ROLES.includes(role as (typeof MANAGER_ROLES)[number])) {
    return {
      error: NextResponse.json(
        { error: "forbidden", message: "Only owners, admins, and managers can manage catalog imports." },
        { status: 403 },
      ),
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

export async function requireOrgMemberRead(organizationId: string): Promise<
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

  const { data: mem } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (!mem) {
    return {
      error: NextResponse.json({ error: "forbidden", message: "You are not a member of this organization." }, { status: 403 }),
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
