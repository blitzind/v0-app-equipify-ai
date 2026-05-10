import { NextRequest, NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { runDigestForOrganization } from "@/lib/ai-ops/digest-runner"
import { renderAiOpsDigestEmail } from "@/lib/email/ai-ops-digest-template"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "")

/**
 * AI Ops Phase 3 — read-only digest preview.
 *
 * Returns the payload + rendered subject so the settings UI can
 * show "this is what the next digest will look like" without
 * sending anything. No DB writes, no email send.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400, "invalid_org")

  const gate = await requireOrgPermission(organizationId, "canViewInsights")
  if ("error" in gate) return gate.error

  const planGate = await requireFeatureAccess(gate.supabase, organizationId, "ai")
  if (!planGate.ok) {
    return jsonError(planGate.message, planGate.httpStatus, planGate.code)
  }

  const result = await runDigestForOrganization({
    supabase: gate.supabase,
    organizationId,
    triggerKind: "preview",
    returnPayload: true,
  })

  if (!result.payload) {
    return NextResponse.json({
      ok: true,
      preview: null,
      message: result.errorMessage ?? "No payload available.",
    })
  }

  const email = renderAiOpsDigestEmail({ payload: result.payload, appUrl: APP_URL })
  return NextResponse.json({
    ok: true,
    preview: {
      subject: email.subject,
      html: email.html,
      text: email.text,
      itemsCount: result.itemsCount,
      highCount: result.highCount,
      totals: result.payload.totals,
      generatedAtIso: result.payload.generatedAtIso,
    },
  })
}
