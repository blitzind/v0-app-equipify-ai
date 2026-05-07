import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { isDraftRow, planDraftHandoff } from "@/lib/communications/draft-handoff"
import type { CommunicationEventRow } from "@/lib/notifications/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * Communications Phase 3 — Draft Send Hand-Off.
 *
 * Takes a draft `communication_events` row and dispatches it to the
 * matching live send route (invoice email, quote email, work-order
 * summary, prospect follow-up). The draft row itself transitions
 * `pending/draft → queued → sent/failed` as it progresses; the live
 * route writes its own canonical row with the provider's ID. We
 * never re-implement send logic — only orchestrate the hand-off.
 *
 * Safety:
 *   - Requires `canManageCommunications` (owner / admin / manager).
 *   - Refuses to dispatch non-draft rows (already-sent/failed events
 *     stay immutable).
 *   - Refuses to redispatch a draft that's already in flight.
 *   - Forwards the caller's session cookie so the live route still
 *     enforces its own permission gates (`canEditInvoices`,
 *     `canEditQuotes`, `canEditWorkOrders`, `canManageProspects`).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string; communicationId: string }> },
) {
  const { organizationId, communicationId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(communicationId)) {
    return jsonError("Invalid identifier.", 400, "invalid_id")
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
  if (!permissions.canManageCommunications && !isPlatformAdmin) {
    return jsonError("Sending drafts requires manager access.", 403, "forbidden")
  }

  const { data: draftRaw, error: loadErr } = await supabase
    .from("communication_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", communicationId)
    .maybeSingle()

  if (loadErr) return jsonError(loadErr.message, 500, "load_failed")
  if (!draftRaw) return jsonError("Draft not found.", 404, "not_found")
  const draft = draftRaw as CommunicationEventRow

  if (!isDraftRow(draft)) {
    return jsonError(
      "This communication is not a draft. Live events can't be redispatched from the drafts hand-off.",
      409,
      "not_a_draft",
    )
  }
  if (draft.delivery_status === "queued" || draft.delivery_status === "sent") {
    return jsonError(
      "This draft is already in flight. Wait for delivery to settle before retrying.",
      409,
      "already_in_flight",
    )
  }

  const plan = planDraftHandoff(draft)
  if (plan.kind !== "ok") return jsonError(plan.reason, 400, plan.kind)

  const now = new Date().toISOString()
  const baseMetadata = (draft.metadata ?? {}) as Record<string, unknown>

  // 1. Mark draft as queued + clear is_draft so the feed pill flips
  //    immediately and a parallel click won't re-dispatch.
  const { error: queueErr } = await supabase
    .from("communication_events")
    .update({
      delivery_status: "queued",
      error_message: null,
      metadata: {
        ...baseMetadata,
        is_draft: false,
        handoff_started_at: now,
        handoff_route: plan.target.path,
        handoff_route_label: plan.target.routeLabel,
        dispatched_by: user.id,
      },
    })
    .eq("id", draft.id)
    .eq("organization_id", organizationId)

  if (queueErr) return jsonError(queueErr.message, 500, "queue_failed")

  // 2. Forward to the live route. We use the caller's cookie so the
  //    domain route still enforces its own permission/billing gates.
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

  // 3. Settle the draft lifecycle to sent/failed.
  if (liveOk) {
    const sentAt = new Date().toISOString()
    await supabase
      .from("communication_events")
      .update({
        delivery_status: "sent",
        error_message: null,
        sent_at: sentAt,
        metadata: {
          ...baseMetadata,
          is_draft: false,
          handoff_started_at: now,
          handoff_completed_at: sentAt,
          handoff_route: plan.target.path,
          handoff_route_label: plan.target.routeLabel,
          handoff_status: liveStatus,
          dispatched_by: user.id,
        },
      })
      .eq("id", draft.id)
      .eq("organization_id", organizationId)

    return NextResponse.json({
      ok: true,
      message:
        liveBody.message ??
        `Sent via ${plan.target.routeLabel}. The live event row appears in the feed alongside this draft.`,
      route: plan.target.path,
    })
  }

  const failedAt = new Date().toISOString()
  // Provider-specific reasons (rate limits, mailbox full, etc.) come
  // back in `liveBody.message` from the live route; we surface that
  // verbatim — never the raw provider payload.
  const explanation =
    liveBody.message ??
    liveBody.error ??
    `Live route returned HTTP ${liveStatus || "0"}. Check the related record for blockers (status, recipient, billing).`

  await supabase
    .from("communication_events")
    .update({
      delivery_status: "failed",
      error_message: explanation,
      failed_at: failedAt,
      metadata: {
        ...baseMetadata,
        is_draft: false,
        handoff_started_at: now,
        handoff_failed_at: failedAt,
        handoff_route: plan.target.path,
        handoff_route_label: plan.target.routeLabel,
        handoff_status: liveStatus,
        dispatched_by: user.id,
      },
    })
    .eq("id", draft.id)
    .eq("organization_id", organizationId)

  return NextResponse.json(
    {
      ok: false,
      error: "live_send_failed",
      message: explanation,
      status: liveStatus,
    },
    { status: 502 },
  )
}
