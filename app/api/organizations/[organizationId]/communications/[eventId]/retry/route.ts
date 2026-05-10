import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseUuid } from "@/lib/email/route-auth"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { planFailedDeliveryRetry } from "@/lib/communications/retry-handoff"
import type { CommunicationEventRow } from "@/lib/notifications/types"

export const runtime = "nodejs"

function logCommunicationRetry(payload: Record<string, unknown>) {
  try {
    console.info(JSON.stringify({ source: "communication-retry", ...payload }))
  } catch {
    /* best-effort */
  }
}

/**
 * Replays a failed or bounced outbound email by delegating to the same live
 * routes as draft send hand-off, using the caller's session cookie.
 *
 * Does not leave rows in `queued` without attempting a send: we transition
 * queued → sent/failed in one request, like `.../communications/{id}/send`.
 */
export async function POST(
  request: NextRequest,
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

  const { data: evRaw, error: loadErr } = await supabase
    .from("communication_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle()

  if (loadErr || !evRaw || (evRaw as { organization_id: string }).organization_id !== organizationId) {
    return NextResponse.json({ error: "not_found", message: "Event not found." }, { status: 404 })
  }

  const ev = evRaw as CommunicationEventRow
  const status = ev.delivery_status

  if (status === "queued" || status === "pending") {
    return NextResponse.json(
      {
        error: "already_queued",
        message:
          "This delivery is already in flight. Wait for it to settle before requesting another retry.",
      },
      { status: 409 },
    )
  }
  if (status !== "failed" && status !== "bounced") {
    return NextResponse.json(
      {
        error: "not_retriable",
        message: "Only failed or bounced deliveries can be retried.",
      },
      { status: 409 },
    )
  }

  const meta = (ev.metadata ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  const RETRY_COOLDOWN_MS = 30_000
  const lastRetryIso = typeof meta.retry_requested_at === "string" ? meta.retry_requested_at : null
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

  const plan = planFailedDeliveryRetry(ev)
  if (plan.kind === "unsupported") {
    logCommunicationRetry({
      organizationId,
      eventId,
      channel: ev.channel,
      outcome: "blocked",
      reason: "retry_unavailable",
      detail: plan.reason,
    })
    return NextResponse.json(
      { error: "retry_unavailable", message: plan.reason },
      { status: 400 },
    )
  }
  if (plan.kind === "missing_field") {
    logCommunicationRetry({
      organizationId,
      eventId,
      channel: ev.channel,
      outcome: "blocked",
      reason: plan.kind,
      field: plan.field,
      detail: plan.reason,
    })
    return NextResponse.json(
      { error: "retry_blocked", message: plan.reason, field: plan.field },
      { status: 400 },
    )
  }

  const retryCount = typeof meta.retry_count === "number" ? meta.retry_count : 0
  const metaQueued = {
    ...meta,
    retry_requested_at: now,
    retry_requested_by: user.id,
    retry_count: retryCount + 1,
    retry_route: plan.target.path,
    retry_route_label: plan.target.routeLabel,
    retry_started_at: now,
  }

  const { data: locked, error: queueErr } = await supabase
    .from("communication_events")
    .update({
      delivery_status: "queued",
      error_message: null,
      metadata: metaQueued,
    })
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .in("delivery_status", ["failed", "bounced"])
    .select("id")
    .maybeSingle()

  if (queueErr) {
    return NextResponse.json({ error: "update_failed", message: queueErr.message }, { status: 500 })
  }
  if (!locked) {
    return NextResponse.json(
      {
        error: "already_queued",
        message: "This delivery changed status while retrying. Refresh and try again if it still shows failed.",
      },
      { status: 409 },
    )
  }

  const cookie = request.headers.get("cookie") ?? ""
  const url = new URL(plan.target.path, request.nextUrl.origin).toString()

  let liveOk = false
  let liveStatus = 0
  let liveBody: { ok?: boolean; message?: string; error?: string } = {}
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify(plan.target.payload),
    })
    liveStatus = res.status
    try {
      liveBody = (await res.json()) as typeof liveBody
    } catch {
      liveBody = {}
    }
    liveOk = res.ok && liveBody.ok !== false
  } catch (e) {
    liveBody = { error: "fetch_failed", message: e instanceof Error ? e.message : "Network error" }
  }

  if (liveOk) {
    const sentAt = new Date().toISOString()
    await supabase
      .from("communication_events")
      .update({
        delivery_status: "sent",
        error_message: null,
        failed_at: null,
        sent_at: sentAt,
        metadata: {
          ...metaQueued,
          retry_completed_at: sentAt,
          retry_http_status: liveStatus,
        },
      })
      .eq("id", eventId)
      .eq("organization_id", organizationId)

    logCommunicationRetry({
      organizationId,
      eventId,
      channel: ev.channel,
      route: plan.target.path,
      routeLabel: plan.target.routeLabel,
      outcome: "sent",
      httpStatus: liveStatus,
      retryCount: retryCount + 1,
    })

    return NextResponse.json({
      ok: true,
      message:
        liveBody.message ??
        `Retried successfully via ${plan.target.routeLabel}. A new provider row may also appear in the feed.`,
      route: plan.target.path,
      sentAt,
      retryCount: retryCount + 1,
    })
  }

  const failedAt = new Date().toISOString()
  const explanation =
    liveBody.message ??
    liveBody.error ??
    `Live route returned HTTP ${liveStatus || "0"}. Check permissions, recipient, and record status.`

  await supabase
    .from("communication_events")
    .update({
      delivery_status: "failed",
      error_message: explanation,
      failed_at: failedAt,
      metadata: {
        ...metaQueued,
        retry_failed_at: failedAt,
        retry_http_status: liveStatus,
      },
    })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  logCommunicationRetry({
    organizationId,
    eventId,
    channel: ev.channel,
    route: plan.target.path,
    routeLabel: plan.target.routeLabel,
    outcome: "failed",
    httpStatus: liveStatus,
    retryCount: retryCount + 1,
    error: explanation,
  })

  return NextResponse.json(
    {
      ok: false,
      error: "live_send_failed",
      message: explanation,
      status: liveStatus,
      retryCount: retryCount + 1,
    },
    { status: 502 },
  )
}
