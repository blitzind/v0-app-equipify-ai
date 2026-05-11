import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import {
  buildDigestPayload,
  digestSystemPermissions,
  loadDigestSettings,
} from "@/lib/ai-ops/digest"
import { sendSlackDigest, validateSlackWebhookUrl } from "@/lib/ai-ops/slack-adapter"
import { sendTeamsDigest, validateTeamsWebhookUrl } from "@/lib/ai-ops/teams-adapter"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "")

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

const schema = z.object({
  destination: z.enum(["slack", "teams"]),
  /** Optional override URL — used by the "Send test before saving" flow. */
  overrideWebhookUrl: z.string().url().max(512).optional(),
})

/**
 * AI Ops Phase 4 — send a small "test" payload to a webhook
 * destination. Manager / admin / owner only. Useful both before
 * saving (the user pastes a URL and clicks "Test") and after
 * saving (the user just wants to confirm the saved destination
 * still works).
 *
 * **Internal-only.** This endpoint never sends customer-facing
 * messages.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400, "invalid_org")

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error
  const { supabase } = gate

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const isPlatformAdmin = Boolean(authUser?.email && isPlatformAdminEmail(authUser.email))
  if (!isPlatformAdmin) {
    const planGate = await requireFeatureAccess(supabase, organizationId, "ai")
    if (!planGate.ok) {
      return jsonError(planGate.message, planGate.httpStatus, planGate.code)
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON body.", 400, "invalid_body")
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "), 400, "invalid_body")
  }
  const { destination, overrideWebhookUrl } = parsed.data

  // Resolve the webhook URL — use the override when provided,
  // otherwise fall back to the saved one (the UI cannot read the
  // saved URL because it's masked, so this is the user's only path
  // to test the persisted destination).
  let webhookUrl = overrideWebhookUrl?.trim() ?? null
  if (!webhookUrl) {
    const settingsRes = await loadDigestSettings(supabase, organizationId)
    if (!settingsRes.row) return jsonError("Digest settings not configured.", 404, "not_found")
    webhookUrl =
      destination === "slack"
        ? settingsRes.row.slack_webhook_url
        : settingsRes.row.teams_webhook_url
    if (!webhookUrl) {
      return jsonError(
        `No ${destination === "slack" ? "Slack" : "Teams"} webhook configured.`,
        400,
        "no_webhook",
      )
    }
  }

  const validation =
    destination === "slack" ? validateSlackWebhookUrl(webhookUrl) : validateTeamsWebhookUrl(webhookUrl)
  if (!validation.ok) {
    return jsonError(validation.reason, 400, "invalid_webhook_url")
  }

  // Build a minimal payload — same shape the runner uses, but we
  // pass `asTest: true` so the adapter renders a tiny acknowledgement
  // card instead of the full digest.
  const orgRes = await supabase
    .from("organizations")
    .select("id, name, timezone")
    .eq("id", organizationId)
    .maybeSingle()
  if (orgRes.error || !orgRes.data) {
    return jsonError("Organization not found.", 404, "org_not_found")
  }
  const organization = orgRes.data as { id: string; name: string; timezone: string | null }

  const settingsRes = await loadDigestSettings(supabase, organizationId)
  const settings =
    settingsRes.row ?? {
      organization_id: organizationId,
      enabled: false,
      recipients: [],
      send_hour: 7,
      timezone_snapshot: organization.timezone,
      priority_threshold: "medium" as const,
      categories: [],
      slack_webhook_url: null,
      teams_webhook_url: null,
      slack_enabled: false,
      teams_enabled: false,
      skip_weekends: false,
      last_sent_at: null,
    }

  const payload = await buildDigestPayload({
    supabase,
    organizationId,
    organizationName: organization.name,
    organizationTimezone: organization.timezone ?? "UTC",
    permissions: digestSystemPermissions(),
    settings,
  })

  const result =
    destination === "slack"
      ? await sendSlackDigest({ webhookUrl, payload, appUrl: APP_URL, asTest: true })
      : await sendTeamsDigest({ webhookUrl, payload, appUrl: APP_URL, asTest: true })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.errorCode,
        message: result.errorMessage,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    destination,
    message: `Test ${destination === "slack" ? "Slack" : "Teams"} message sent. Check the channel.`,
  })
}
