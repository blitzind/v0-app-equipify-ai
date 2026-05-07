import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { PROSPECT_STATUSES, type ProspectStatus } from "@/lib/prospects/types"
import {
  PROSPECT_SELECT_COLUMNS,
  optionalString,
  parseOptionalCents,
  parseOptionalIso,
} from "@/lib/prospects/server-helpers"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * GET /api/organizations/{org}/prospects
 *
 * List prospects for the active organization. Read access is gated by
 * org membership only (matches RLS) so techs/viewers can see the pipeline
 * read-only without `canManageProspects`.
 *
 * Query params:
 *   archived = "active" | "archived" | "all"   (default "active")
 *   status   = ProspectStatus                  (optional)
 *   search   = free text against company / contact / email
 *   limit    = 1..500                          (default 200)
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return jsonError("Sign in required.", 401, "unauthorized")

  const platformAdmin = Boolean(user.email && isPlatformAdminEmail(user.email))
  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) return jsonError("You are not a member of this organization.", 403, "forbidden")
  }

  const sp = new URL(request.url).searchParams
  const archiveScope = (sp.get("archived") ?? "active").toLowerCase()
  const statusFilter = sp.get("status")?.trim().toLowerCase() ?? ""
  const search = sp.get("search")?.trim() ?? ""
  const limit = Math.min(
    Math.max(Number.parseInt(sp.get("limit") ?? "200", 10) || 200, 1),
    500,
  )

  let q = supabase
    .from("prospects")
    .select(PROSPECT_SELECT_COLUMNS)
    .eq("organization_id", organizationId)

  if (archiveScope === "active") q = q.is("archived_at", null)
  else if (archiveScope === "archived") q = q.not("archived_at", "is", null)
  // "all" intentionally applies no archive filter.

  if (statusFilter && PROSPECT_STATUSES.includes(statusFilter as ProspectStatus)) {
    q = q.eq("status", statusFilter)
  }

  if (search) {
    // Supabase `or` filter — keep parts that don't contain commas to avoid
    // breaking the parser. We strip commas from the user input as a
    // defensive measure.
    const safe = search.replace(/[,()]/g, " ").trim()
    if (safe) {
      q = q.or(
        `company_name.ilike.%${safe}%,contact_name.ilike.%${safe}%,contact_email.ilike.%${safe}%`,
      )
    }
  }

  const { data, error } = await q
    .order("next_follow_up_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) return jsonError(error.message, 500, "query_failed")

  // Resolve converted-customer names so the UI can show a friendly link.
  const rows = data ?? []
  const customerIds = Array.from(
    new Set(
      rows
        .map((r) => (r as { converted_customer_id?: string | null }).converted_customer_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const customerNameMap = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: cRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", customerIds)
    for (const c of (cRows ?? []) as Array<{ id: string; company_name: string }>) {
      customerNameMap.set(c.id, c.company_name)
    }
  }

  return NextResponse.json({
    prospects: rows.map((r) => ({
      ...r,
      converted_customer_name: r.converted_customer_id
        ? customerNameMap.get(r.converted_customer_id as string) ?? null
        : null,
    })),
  })
}

/**
 * POST /api/organizations/{org}/prospects
 *
 * Create a prospect. Gated by `canManageProspects`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageProspects")
  if ("error" in gate) return gate.error
  const { supabase, userId } = gate

  let body: {
    company_name?: string
    contact_name?: string | null
    contact_email?: string | null
    contact_phone?: string | null
    lead_source?: string | null
    status?: string
    next_follow_up_at?: string | null
    estimated_value_cents?: number | null
    notes?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const company = typeof body.company_name === "string" ? body.company_name.trim() : ""
  if (!company) return jsonError("company_name is required.", 400)

  const status =
    typeof body.status === "string" &&
    PROSPECT_STATUSES.includes(body.status as ProspectStatus)
      ? body.status
      : "new"

  const followUp = parseOptionalIso(body.next_follow_up_at)
  if (followUp === "invalid") return jsonError("next_follow_up_at must be a valid ISO date.", 400)

  const value = parseOptionalCents(body.estimated_value_cents)
  if (value === "invalid") return jsonError("estimated_value_cents must be a positive integer.", 400)

  const insertRow = {
    organization_id: organizationId,
    company_name: company,
    contact_name: optionalString(body.contact_name),
    contact_email: optionalString(body.contact_email),
    contact_phone: optionalString(body.contact_phone),
    lead_source: optionalString(body.lead_source),
    status,
    next_follow_up_at: followUp,
    estimated_value_cents: value,
    notes: optionalString(body.notes),
    created_by: userId,
  }

  const { data, error } = await supabase
    .from("prospects")
    .insert(insertRow)
    .select(PROSPECT_SELECT_COLUMNS)
    .single()

  if (error || !data) return jsonError(error?.message ?? "Could not create prospect.", 500, "insert_failed")

  return NextResponse.json({ prospect: data })
}
