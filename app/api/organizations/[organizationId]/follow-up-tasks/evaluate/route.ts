import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { tryConsumeAiOperationSlot } from "@/lib/ai/operation-rate-limit"
import { evaluateFollowUpAutomationForOrganization } from "@/lib/follow-up-automation/evaluate"
import { logFollowUpAutomationUsage } from "@/lib/follow-up-automation/log-usage"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, [
    "canManageAutomations",
    "canManageWorkspaceSettings",
  ])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server configuration error.", 503)
  }

  const rl = await tryConsumeAiOperationSlot(admin, organizationId, "follow_up_evaluate")
  if (!rl.allowed) {
    return jsonError("Automation evaluation rate limit — try again in a minute.", 429)
  }

  const result = await evaluateFollowUpAutomationForOrganization(admin, organizationId)

  await logFollowUpAutomationUsage({
    supabase: gate.supabase,
    organizationId,
    userId: gate.userId,
    eventType: "evaluation_run",
    metadata: {
      inserted: result.inserted,
      skippedDuplicates: result.skippedDuplicates,
      evaluatedRules: result.evaluatedRules,
    },
  })

  return NextResponse.json({ ok: true, ...result })
}
