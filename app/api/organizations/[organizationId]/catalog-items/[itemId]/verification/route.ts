import { NextResponse } from "next/server"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; itemId: string }> },
) {
  const { organizationId, itemId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: { action?: string }
  try {
    body = (await request.json()) as { action?: string }
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON." }, { status: 400 })
  }

  const action = body.action
  if (action !== "verify" && action !== "needs_review") {
    return NextResponse.json({ error: "invalid_action", message: "Use verify or needs_review." }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const patch =
    action === "verify"
      ? { human_verified_at: nowIso, human_verified_by: gate.userId, updated_at: nowIso }
      : {
          human_verified_at: null,
          human_verified_by: null,
          status: "needs_review" as const,
          updated_at: nowIso,
        }

  const { error } = await gate.svc
    .from("catalog_items")
    .update(patch)
    .eq("id", itemId)
    .eq("organization_id", organizationId)

  if (error) {
    const schema = maybeCatalogSchemaErrorResponse(error.message)
    if (schema) return schema
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
