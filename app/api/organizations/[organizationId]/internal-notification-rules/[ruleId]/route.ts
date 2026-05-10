import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { INTERNAL_NOTIFICATION_EVENT_TYPES } from "@/lib/internal-notifications/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EventEnum = z.enum(INTERNAL_NOTIFICATION_EVENT_TYPES)

const PatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    eventType: EventEnum.optional(),
    enabled: z.boolean().optional(),
    targetRoles: z.array(z.string().trim().min(1)).max(24).optional().nullable(),
    targetUserIds: z.array(z.string().uuid()).max(48).optional().nullable(),
    thresholdMinutes: z.number().int().min(0).max(525_600).optional().nullable(),
    warningMinutes: z.number().int().min(0).max(525_600).optional().nullable(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty_patch" })

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: code ?? "error", message }, { status })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; ruleId: string }> },
) {
  const { organizationId, ruleId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(ruleId)) return jsonError("Invalid id.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const p = parsed.data
  const patch: Record<string, unknown> = { updated_by: gate.userId }
  if (p.name !== undefined) patch.name = p.name
  if (p.eventType !== undefined) patch.event_type = p.eventType
  if (p.enabled !== undefined) patch.enabled = p.enabled
  if (p.targetRoles !== undefined) patch.target_roles = p.targetRoles
  if (p.targetUserIds !== undefined) patch.target_user_ids = p.targetUserIds
  if (p.thresholdMinutes !== undefined) patch.threshold_minutes = p.thresholdMinutes
  if (p.warningMinutes !== undefined) patch.warning_minutes = p.warningMinutes
  if (p.config !== undefined) patch.config = p.config

  const { data, error } = await gate.supabase
    .from("internal_escalation_rules")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", ruleId)
    .select("*")
    .maybeSingle()

  if (error) return jsonError(error.message, 500, "update_failed")
  if (!data) return jsonError("Rule not found.", 404, "not_found")

  return NextResponse.json({ ok: true, rule: data })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ organizationId: string; ruleId: string }> },
) {
  const { organizationId, ruleId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(ruleId)) return jsonError("Invalid id.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  const { error } = await gate.supabase
    .from("internal_escalation_rules")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", ruleId)

  if (error) return jsonError(error.message, 500, "delete_failed")

  return NextResponse.json({ ok: true })
}
