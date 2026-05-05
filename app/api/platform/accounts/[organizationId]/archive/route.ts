import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ArchiveBody = {
  status?: string
  action?: string
}

function parseRestore(body: ArchiveBody | null | undefined): boolean {
  if (!body || typeof body !== "object") return false
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : ""
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : ""
  return status === "active" || action === "restore" || action === "unarchive"
}

/**
 * Soft-archive or restore an organization (no data deletion).
 * - Empty body or `{ "action": "archive" }` → `organizations.status = archived`
 * - `{ "status": "active" }` or `{ "action": "restore" }` → `organizations.status = active`
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let restore = false
  try {
    const json = (await request.json()) as ArchiveBody
    restore = parseRestore(json)
  } catch {
    restore = false
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const nextStatus = restore ? "active" : "archived"

  const { error } = await admin
    .from("organizations")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", organizationId)

  if (error) {
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, status: nextStatus })
}
