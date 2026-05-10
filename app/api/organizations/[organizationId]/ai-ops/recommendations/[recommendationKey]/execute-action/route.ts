import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import {
  executeOperationalAction,
} from "@/lib/ai-ops/execute-operational-action"
import { OPERATIONAL_ACTION_IDS } from "@/lib/ai-ops/operational-action-ids"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  action: z.enum(OPERATIONAL_ACTION_IDS),
  confirm: z.literal(true),
  payload: z
    .object({
      technicianUserId: z.string().uuid().optional(),
      recipientEmail: z.string().email().optional(),
      taskNotes: z.string().max(8000).optional(),
    })
    .optional(),
})

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string; recommendationKey: string }> },
) {
  const { organizationId, recommendationKey: rawKey } = await context.params
  const recommendationKey = decodeURIComponent(rawKey)
  if (!UUID_RE.test(organizationId) || !recommendationKey.trim()) {
    return jsonError("Invalid request.", 400, "invalid_request")
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Sign in required.", 401, "unauthorized")

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return jsonError("Forbidden.", 403, "forbidden")
  const permissions = getOrgPermissionsForRole(role)

  const managerRoles = ["owner", "admin", "manager"]
  if (!isPlatformAdmin && (!role || !managerRoles.includes(role))) {
    return jsonError(
      "Only owners, admins, and managers can execute operational actions.",
      403,
      "forbidden",
    )
  }

  if (!isPlatformAdmin) {
    const planGate = await requireFeatureAccess(supabase, organizationId, "ai")
    if (!planGate.ok) {
      return jsonError(planGate.message, planGate.httpStatus, planGate.code)
    }
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return jsonError("Invalid JSON body.", 400, "invalid_body")
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "), 400, "invalid_body")
  }

  const result = await executeOperationalAction({
    supabase,
    organizationId,
    userId: user.id,
    permissions,
    recommendationKey,
    action: parsed.data.action,
    confirm: true,
    payload: parsed.data.payload,
  })

  if (!result.ok) {
    const status =
      result.code === "forbidden"
        ? 403
        : result.code === "recommendation_not_found"
          ? 404
          : result.code === "billing_gate"
            ? 403
            : 400
    return jsonError(result.message, status, result.code)
  }

  return NextResponse.json({ ok: true, effect: result.effect })
}
