import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

type TableProbe = { table: string; ok: boolean; code?: string }

/**
 * Platform-admin diagnostic: verify JWT + RLS can read key tenant tables for the
 * active support org. Returns booleans only (no row payloads).
 * Disabled in production unless NEXT_PUBLIC_DEBUG_NAV=true.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DEBUG_NAV !== "true") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id || !user.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { data: sess } = await supabase
    .from("organization_support_sessions")
    .select("organization_id")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const organizationId = (sess as { organization_id?: string } | null)?.organization_id ?? null
  if (!organizationId) {
    return NextResponse.json({ ok: false, message: "no_active_support_session", probes: [] as TableProbe[] })
  }

  const tables = [
    "customers",
    "equipment",
    "technicians",
    "work_orders",
    "org_quotes",
    "org_invoices",
    "blitzpay_memberships",
  ] as const

  const probes: TableProbe[] = []
  for (const table of tables) {
    const { error } = await supabase.from(table).select("id").eq("organization_id", organizationId).limit(1)
    probes.push({
      table,
      ok: !error,
      code: error?.code,
    })
  }

  return NextResponse.json({
    ok: true,
    organizationHint: organizationId.length > 8 ? `…${organizationId.slice(-6)}` : "short",
    probes,
  })
}
