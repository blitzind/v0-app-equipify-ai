import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { getOrganizationMemberRole } from "@/lib/api/org-role"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function missingColumn(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const m = (err.message ?? "").toLowerCase()
  if (!m.includes("portal_consolidated_documents")) return false
  if (err.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}

/**
 * Workspace default for parent-account portal document rollup.
 * GET: any active org member. PATCH: `canManagePortalSettings` (owner / admin).
 */
export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return jsonError("Unauthorized.", 401)

  const role = await getOrganizationMemberRole(supabase, user.id, organizationId)
  if (!role) return jsonError("Forbidden.", 403)

  const { data: row, error } = await supabase
    .from("organizations")
    .select("portal_consolidated_documents_default")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    if (missingColumn(error)) {
      return NextResponse.json({
        portal_consolidated_documents_default: false,
        schema_migration_pending: true,
      })
    }
    return jsonError(error.message, 500)
  }

  const def = (row as { portal_consolidated_documents_default?: boolean | null } | null)
    ?.portal_consolidated_documents_default
  return NextResponse.json({
    portal_consolidated_documents_default: def === true,
    schema_migration_pending: false,
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canManagePortalSettings")
  if ("error" in gate) return gate.error
  const { supabase } = gate

  let body: { portal_consolidated_documents_default?: unknown }
  try {
    body = (await request.json()) as { portal_consolidated_documents_default?: unknown }
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const raw = body.portal_consolidated_documents_default
  if (typeof raw !== "boolean") {
    return jsonError("portal_consolidated_documents_default must be a boolean.", 400)
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      portal_consolidated_documents_default: raw,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId)

  if (error) {
    if (missingColumn(error)) {
      return NextResponse.json(
        {
          error:
            "This workspace database does not have consolidated portal documents yet. Apply the latest migrations.",
        },
        { status: 503 },
      )
    }
    return jsonError(error.message, 500)
  }

  return NextResponse.json({
    ok: true,
    portal_consolidated_documents_default: raw,
    schema_migration_pending: false,
  })
}
