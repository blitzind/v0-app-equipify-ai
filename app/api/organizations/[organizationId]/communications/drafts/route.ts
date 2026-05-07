import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import type { RelatedEntityType } from "@/lib/notifications/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

const VALID_RELATED: RelatedEntityType[] = [
  "work_order",
  "quote",
  "invoice",
  "maintenance_plan",
  "customer",
  "equipment",
  "organization",
  "prospect",
]

/**
 * Communications Phase 2 — compose a draft.
 *
 * Creates a `communication_events` row with `delivery_status =
 * 'pending'` and `metadata.is_draft = true`. **No actual provider
 * send happens.** The Phase 1 feed UI labels the row as "Draft" via
 * the synthetic-status detector, the manager can revisit it from
 * the central feed, and a future phase will hand the draft off to
 * an existing send route (invoice email, quote email, work-order
 * summary email, prospect follow-up) — never duplicating the live
 * sending logic that already lives in those flows.
 *
 * Gated behind `canManageCommunications` (owner/admin/manager).
 *
 * Body (all optional unless noted):
 *   {
 *     channel: "email" | "sms" | "in_app" | "system" | "push"  // default 'email'
 *     subject: string                                          // required (>=2 chars)
 *     body: string
 *     summary: string
 *     recipientAddress: string
 *     recipientCustomerId: uuid
 *     relatedEntityType: RelatedEntityType
 *     relatedEntityId: uuid
 *   }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400, "invalid_org")

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
    return jsonError("Composing drafts requires manager access.", 403, "forbidden")
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonError("Invalid JSON body.", 400, "invalid_body")
  }

  const channelRaw = typeof body.channel === "string" ? body.channel : "email"
  if (!["email", "sms", "in_app", "system", "push"].includes(channelRaw)) {
    return jsonError("Unsupported channel.", 400, "invalid_channel")
  }

  const subject = (typeof body.subject === "string" ? body.subject.trim() : "")
  if (subject.length < 2) return jsonError("Subject is required.", 400, "missing_subject")

  const summary = optionalString(body.summary)
  const messageBody = optionalString(body.body)
  const recipientAddress = optionalString(body.recipientAddress)

  const recipientCustomerId = optionalUuid(body.recipientCustomerId)
  const relatedEntityType =
    typeof body.relatedEntityType === "string" &&
    (VALID_RELATED as string[]).includes(body.relatedEntityType)
      ? (body.relatedEntityType as RelatedEntityType)
      : null
  const relatedEntityId = optionalUuid(body.relatedEntityId)

  if (relatedEntityType && !relatedEntityId) {
    return jsonError("relatedEntityId is required when relatedEntityType is set.", 400, "invalid_relation")
  }

  const insert = {
    organization_id: organizationId,
    channel: channelRaw,
    direction: "outbound" as const,
    event_type: "communication_draft",
    title: subject.slice(0, 240),
    summary,
    body: messageBody,
    audience: "organization" as const,
    counts_toward_unread: false,
    delivery_status: "pending" as const,
    recipient_kind: recipientCustomerId
      ? ("customer" as const)
      : recipientAddress
        ? ("external" as const)
        : ("none" as const),
    recipient_customer_id: recipientCustomerId,
    recipient_address: recipientAddress,
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    provider: "manual" as const,
    metadata: {
      is_draft: true,
      drafted_by: user.id,
      drafted_at: new Date().toISOString(),
      source: "communications_center_phase2",
    },
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from("communication_events")
    .insert(insert)
    .select("id")
    .single()

  if (error) return jsonError(error.message, 500, "insert_failed")

  return NextResponse.json({
    ok: true,
    id: (data as { id: string }).id,
    message: "Draft saved. It appears in the Communications feed and is not sent automatically.",
  })
}

function optionalString(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

function optionalUuid(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return UUID_RE.test(t) ? t : null
}
