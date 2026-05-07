import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseUuid } from "@/lib/email/route-auth"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"

export const runtime = "nodejs"

/**
 * Marks a failed/bounced delivery for retry (queue).
 *
 * Communications Phase 2 — gated behind `canManageCommunications`
 * (owner/admin/manager) so techs and viewers can read the feed but
 * can't requeue customer-facing sends. The retry semantics stay
 * unchanged: we flip `delivery_status` back to `queued`, clear the
 * stored error, and stamp `metadata.retry_requested_at` /
 * `metadata.retry_requested_by`. Actual provider resend hooks
 * (Resend / Twilio) land in a later phase via webhook ingestion.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; eventId: string }> },
) {
  const { organizationId: rawOrg, eventId: rawEv } = await context.params
  const organizationId = parseUuid(rawOrg)
  const eventId = parseUuid(rawEv)
  if (!organizationId || !eventId) {
    return NextResponse.json({ error: "invalid_ids", message: "Invalid ids." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user?.email) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) {
    return NextResponse.json(
      { error: "forbidden", message: "No access to this organization." },
      { status: 403 },
    )
  }
  const permissions = getOrgPermissionsForRole(role)
  if (!permissions.canManageCommunications && !isPlatformAdmin) {
    return NextResponse.json(
      { error: "forbidden", message: "Retrying communications requires manager access." },
      { status: 403 },
    )
  }

  const { data: ev, error: loadErr } = await supabase
    .from("communication_events")
    .select("id, organization_id, metadata, delivery_status")
    .eq("id", eventId)
    .maybeSingle()

  if (loadErr || !ev || (ev as { organization_id: string }).organization_id !== organizationId) {
    return NextResponse.json({ error: "not_found", message: "Event not found." }, { status: 404 })
  }

  const status = (ev as { delivery_status: string }).delivery_status
  if (status === "queued" || status === "pending") {
    return NextResponse.json(
      {
        error: "already_queued",
        message:
          "This delivery is already queued. Wait for it to settle before requesting another retry.",
      },
      { status: 409 },
    )
  }
  if (status !== "failed" && status !== "bounced") {
    return NextResponse.json(
      {
        error: "not_retriable",
        message: "Only failed or bounced deliveries can be queued for retry.",
      },
      { status: 409 },
    )
  }

  const meta = ((ev as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  // Phase 3 — cooldown: refuse to re-queue if a retry was requested
  // in the last RETRY_COOLDOWN_MS milliseconds. Prevents accidental
  // double-clicks from spamming the future provider sync once it
  // lands. The window is intentionally short — managers can always
  // retry again after the cooldown expires.
  const RETRY_COOLDOWN_MS = 30_000
  const lastRetryIso =
    typeof meta.retry_requested_at === "string" ? (meta.retry_requested_at as string) : null
  if (lastRetryIso) {
    const last = new Date(lastRetryIso).getTime()
    if (Number.isFinite(last) && Date.now() - last < RETRY_COOLDOWN_MS) {
      const secondsLeft = Math.max(
        1,
        Math.ceil((RETRY_COOLDOWN_MS - (Date.now() - last)) / 1000),
      )
      return NextResponse.json(
        {
          error: "retry_cooldown",
          message: `Retry is cooling down. Try again in ${secondsLeft}s.`,
          cooldownSecondsRemaining: secondsLeft,
        },
        { status: 429 },
      )
    }
  }

  const retryCount = typeof meta.retry_count === "number" ? (meta.retry_count as number) : 0

  const { error: upErr } = await supabase
    .from("communication_events")
    .update({
      delivery_status: "queued",
      error_message: null,
      metadata: {
        ...meta,
        retry_requested_at: now,
        retry_requested_by: user.id,
        retry_count: retryCount + 1,
      },
    })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  if (upErr) {
    return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message:
      "Retry queued. Provider webhooks will confirm delivery once Resend / Twilio sync is integrated.",
    retryCount: retryCount + 1,
  })
}
