import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { dispatchWorkflowTriggers } from "@/lib/workflows/dispatch"
import type { WorkflowEventContext, WorkflowTriggerType } from "@/lib/workflows/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TRIGGER_TYPES = new Set<string>([
  "work_order_created",
  "work_order_completed",
  "work_order_status_changed",
  "maintenance_due",
  "invoice_overdue",
  "quote_accepted",
  "equipment_warranty_expiring",
  "certificate_uploaded",
  "ai_assistant_digest_ready",
])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Internal/authenticated emission of a workflow event.
 * Uses service role for execution so actions succeed regardless of member role (after membership check).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError("Unauthorized.", 401)

  const { data: mem } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (!mem) return jsonError("Forbidden.", 403)

  const body = (await request.json()) as {
    trigger_type?: string
    context?: Partial<WorkflowEventContext>
    source_type?: string
    source_id?: string | null
  }

  const trigger_type = body.trigger_type as WorkflowTriggerType | undefined
  if (!trigger_type || !TRIGGER_TYPES.has(trigger_type)) {
    return jsonError("Invalid trigger_type.", 400)
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return jsonError("Server automation unavailable.", 503)
  }

  const ctx: WorkflowEventContext = {
    organization_id: organizationId,
    trigger_type,
    today: new Date().toISOString().slice(0, 10),
    ...(body.context ?? {}),
  }

  const result = await dispatchWorkflowTriggers({
    supabase: admin,
    organizationId,
    triggerType: trigger_type,
    ctx,
    sourceType: typeof body.source_type === "string" ? body.source_type : "manual",
    sourceId: typeof body.source_id === "string" ? body.source_id : null,
  })

  return NextResponse.json(result)
}
