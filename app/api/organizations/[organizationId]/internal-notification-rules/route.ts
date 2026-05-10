import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { INTERNAL_NOTIFICATION_EVENT_TYPES } from "@/lib/internal-notifications/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EventEnum = z.enum(INTERNAL_NOTIFICATION_EVENT_TYPES)

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  eventType: EventEnum,
  enabled: z.boolean().optional(),
  targetRoles: z.array(z.string().trim().min(1)).max(24).optional().nullable(),
  targetUserIds: z.array(z.string().uuid()).max(48).optional().nullable(),
  thresholdMinutes: z.number().int().min(0).max(525_600).optional().nullable(),
  warningMinutes: z.number().int().min(0).max(525_600).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional(),
})

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: code ?? "error", message }, { status })
}

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, [
    "canViewAllWorkOrders",
    "canViewAssignedWorkOrdersOnly",
  ])
  if ("error" in gate) return gate.error

  const { data, error } = await gate.supabase
    .from("internal_escalation_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })

  if (error) return jsonError(error.message, 500, "query_failed")

  return NextResponse.json({ ok: true, rules: data ?? [] })
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const p = parsed.data
  const { data, error } = await gate.supabase
    .from("internal_escalation_rules")
    .insert({
      organization_id: organizationId,
      name: p.name,
      event_type: p.eventType,
      enabled: p.enabled ?? true,
      channel: "in_app",
      target_roles: p.targetRoles ?? null,
      target_user_ids: p.targetUserIds ?? null,
      threshold_minutes: p.thresholdMinutes ?? null,
      warning_minutes: p.warningMinutes ?? null,
      config: p.config ?? {},
      created_by: gate.userId,
      updated_by: gate.userId,
    })
    .select("*")
    .single()

  if (error) return jsonError(error.message, 500, "insert_failed")

  return NextResponse.json({ ok: true, rule: data })
}
