import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ACTIONS = ["portal_document_index_view", "portal_document_download"] as const

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/** Strip unknown keys from metadata; never return resource ids or URLs. */
function sanitizeMetadata(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {}
  const allowed = new Set([
    "kind",
    "source_category",
    "cross_account",
    "rollup_enabled",
    "file_type",
    "total_items",
    "counts_by_kind",
    "counts_by_availability",
    "account_count",
  ])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (!allowed.has(k)) continue
    if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
      out[k] = v
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = v
    }
  }
  return out
}

function actionLabel(action: string): string {
  switch (action) {
    case "portal_document_index_view":
      return "Opened document library"
    case "portal_document_download":
      return "Downloaded a document"
    default:
      return "Portal document activity"
  }
}

/**
 * Recent portal document index views + downloads for staff visibility.
 * Reads `portal_activity_logs` via service role after membership gate.
 * Does not expose signed URLs, storage paths, or raw UUIDs.
 */
export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, [
    "canManagePortalSettings",
    "canReleaseCertificatesToPortal",
  ])
  if ("error" in gate) return gate.error

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const { data, error } = await svc
    .from("portal_activity_logs")
    .select("created_at, action, path, metadata")
    .eq("organization_id", organizationId)
    .in("action", [...ACTIONS])
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    const m = (error.message ?? "").toLowerCase()
    if (error.code === "42P01" || m.includes("portal_activity_logs") && m.includes("does not exist")) {
      return NextResponse.json({ items: [], schema_migration_pending: true })
    }
    return jsonError(error.message, 500)
  }

  const items = ((data ?? []) as Array<{
    created_at: string
    action: string
    path: string | null
    metadata: unknown
  }>).map((row) => ({
    at: row.created_at,
    action: row.action,
    label: actionLabel(row.action),
    path: row.path ?? null,
    metadata: sanitizeMetadata(row.metadata),
  }))

  return NextResponse.json({ items, schema_migration_pending: false })
}
