import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { loadCommunicationFeed, summarizeCommunicationStats } from "@/lib/communications/feed"
import type { CommunicationCenterKind } from "@/lib/communications/communication-kind"
import { COMMUNICATION_CENTER_KINDS } from "@/lib/communications/communication-kind"
import {
  isAssignedWorkOnly,
  loadAssignedWorkScope,
} from "@/lib/permissions/technician-scope"
import type {
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationDirection,
  RelatedEntityType,
} from "@/lib/notifications/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Communications Center Phase 1 — enriched feed endpoint.
 *
 * Distinct from the legacy `/communications` endpoint (which keeps
 * the existing notification-style payload + read-state mutations
 * intact). This endpoint returns the unified Phase 1 timeline shape
 * with entity labels, deep-link hrefs, automation flags, and KPI
 * stats, used by:
 *   - the new /communications page hero/feed
 *   - embedded "Recent communications" panels on customer / prospect
 *     / work-order / invoice / quote pages
 *
 * Query params (all optional):
 *   ?search        — substring across title/summary/body/recipient
 *   ?channel       — email | sms | in_app | push | system | all
 *   ?status        — pending | queued | sent | delivered | failed
 *                    | bounced | skipped | simulated | draft | all
 *   ?entityType    — work_order | invoice | quote | customer | …
 *   ?entityId      — restrict to one related entity
 *   ?customerId    — restrict to a customer's recipient timeline
 *   ?fromDate      — YYYY-MM-DD inclusive
 *   ?toDate        — YYYY-MM-DD inclusive
 *   ?automated     — '1' | 'true'
 *   ?limit         — 1..200 (default 50)
 *   ?before        — ISO created_at cursor
 *   ?direction     — outbound | inbound | all
 *   ?communicationKind — Phase 28 category id (see communication-kind.ts)
 *   ?aiSource      — ai | manual | all
 *   ?assignedUserId — created_by OR recipient_user_id match
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Unauthorized.", 401)

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return jsonError("Forbidden.", 403)
  const permissions = getOrgPermissionsForRole(role)
  if (!permissions.canViewCommunications && !isPlatformAdmin) {
    return jsonError("Forbidden.", 403)
  }

  const params = request.nextUrl.searchParams
  const search = params.get("search")
  const channel = (params.get("channel") ?? "all") as CommunicationChannel | "all"
  const status = (params.get("status") ?? "all") as
    | CommunicationDeliveryStatus
    | "simulated"
    | "draft"
    | "all"
  const entityType = (params.get("entityType") ?? "all") as RelatedEntityType | "all"
  const entityId = params.get("entityId")
  const customerId = params.get("customerId")
  const fromDate = params.get("fromDate")
  const toDate = params.get("toDate")
  const automated = params.get("automated")
  const limitRaw = params.get("limit")
  const before = params.get("before")
  const limit = limitRaw ? Number(limitRaw) : null
  const direction = (params.get("direction") ?? "all") as CommunicationDirection | "all"
  const communicationKindRaw = params.get("communicationKind")
  const communicationKind = (
    communicationKindRaw &&
    (COMMUNICATION_CENTER_KINDS as string[]).includes(communicationKindRaw)
      ? communicationKindRaw
      : "all"
  ) as CommunicationCenterKind | "all"
  const aiSource = (params.get("aiSource") ?? "all") as "ai" | "manual" | "all"
  const assignedUserId = params.get("assignedUserId")

  let assignedScope = null as Awaited<ReturnType<typeof loadAssignedWorkScope>> | null
  if (!isPlatformAdmin && isAssignedWorkOnly(permissions)) {
    assignedScope = await loadAssignedWorkScope(supabase, {
      organizationId,
      userId: user.id,
    })
  }

  try {
    const { items, nextCursor } = await loadCommunicationFeed({
      supabase,
      organizationId,
      filters: {
        search,
        channel,
        status,
        entityType,
        entityId: UUID_RE.test(entityId ?? "") ? entityId : null,
        customerId: UUID_RE.test(customerId ?? "") ? customerId : null,
        direction,
        communicationKind,
        aiSource,
        assignedUserId: UUID_RE.test(assignedUserId ?? "") ? assignedUserId : null,
        fromDate,
        toDate,
        automatedOnly: automated === "1" || automated === "true",
        limit,
        beforeCreatedAt: before,
      },
      access: {
        canSeeFinancials: Boolean(
          permissions.canViewFinancials || permissions.canViewBilling || isPlatformAdmin,
        ),
        assignedWorkScope: assignedScope,
      },
    })

    return NextResponse.json({
      items,
      nextCursor,
      stats: summarizeCommunicationStats(items),
      role,
      canManageCommunications: Boolean(permissions.canManageCommunications || isPlatformAdmin),
      currentUserId: user.id,
    })
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to load communications.", 500)
  }
}
