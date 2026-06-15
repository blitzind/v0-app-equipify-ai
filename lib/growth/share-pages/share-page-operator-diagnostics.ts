/** Growth Engine SR-2B-5 — Share page admin/operator diagnostics. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  approveSharePageForOperator,
  archiveSharePageForOperator,
  createSharePageForOperator,
  getSharePageDetailForOperator,
  listSharePagesForOperator,
  regenerateSharePagePreviewForOperator,
  revokeSharePageForOperator,
  sanitizeSharePageApiPayload,
} from "@/lib/growth/share-pages/share-page-operator-service"
import { probeGrowthSharePagesSchema } from "@/lib/growth/share-pages/share-pages-schema-health"
import {
  GROWTH_SHARE_PAGES_OPERATOR_CONFIRM,
  GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-operator-types"

export { GROWTH_SHARE_PAGES_OPERATOR_CONFIRM }

const CERT_PREFIX = "share-pages-sr2b5-cert"

export type GrowthSharePageOperatorDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSharePageOperatorDiagnosticsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER
  checks: GrowthSharePageOperatorDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  share_page_id?: string
}

function pushCheck(
  checks: GrowthSharePageOperatorDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

function assertPayloadHasNoTokenHashes(payload: unknown): boolean {
  try {
    sanitizeSharePageApiPayload(payload)
    return true
  } catch {
    return false
  }
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = getGrowthEngineAiOrgId()
  if (configured) return configured

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

async function resolveCertLeadId(
  admin: SupabaseClient,
): Promise<{ leadId: string; actorUserId: string | null } | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, created_by")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return {
    leadId: data.id,
    actorUserId: typeof data.created_by === "string" ? data.created_by : null,
  }
}

async function resolveCertBookingPageId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("booking_pages")
    .select("id")
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

export async function executeGrowthSharePageOperatorDiagnostics(
  admin: SupabaseClient,
  input?: { origin?: string; approverUserId?: string },
): Promise<GrowthSharePageOperatorDiagnosticsReport> {
  const executionId = `${CERT_PREFIX}-${randomUUID()}`
  const checks: GrowthSharePageOperatorDiagnosticsCheck[] = []
  const blockers: string[] = []
  const origin = input?.origin ?? "https://app.equipify.ai"

  const schema = await probeGrowthSharePagesSchema(admin)
  pushCheck(checks, "schema_ready", schema.ready, schema.ready ? "Share pages schema ready." : "Schema not ready.")
  if (!schema.ready) blockers.push("schema_not_ready")

  const organizationId = await resolveCertOrganizationId(admin)
  pushCheck(
    checks,
    "organization_scope",
    Boolean(organizationId),
    organizationId ? `Organization ${organizationId}` : "No organization for cert.",
  )
  if (!organizationId) blockers.push("organization_id_required")

  const leadContext = await resolveCertLeadId(admin)
  pushCheck(
    checks,
    "cert_lead",
    Boolean(leadContext?.leadId),
    leadContext?.leadId ? `Lead ${leadContext.leadId}` : "No lead for cert.",
  )
  if (!leadContext?.leadId) blockers.push("cert_lead_required")

  const leadId = leadContext?.leadId
  const actorUserId = input?.approverUserId ?? leadContext?.actorUserId ?? null

  if (blockers.length > 0) {
    return {
      ok: false,
      execution_id: executionId,
      qa_marker: GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
      checks,
      blockers,
      final_verdict: "SKIP",
    }
  }

  let sharePageId: string | undefined

  try {
    const listBefore = await listSharePagesForOperator(admin, { organizationId: organizationId! })
    pushCheck(
      checks,
      "admin_list_api",
      listBefore.qaMarker === GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
      `Listed ${listBefore.total} share page(s).`,
    )
    pushCheck(
      checks,
      "admin_list_no_token_hash",
      assertPayloadHasNoTokenHashes(listBefore),
      "List payload contains no token hashes.",
    )

    const bookingPageId = await resolveCertBookingPageId(admin)
    const created = await createSharePageForOperator(admin, {
      organizationId: organizationId!,
      createdBy: actorUserId,
      origin,
      body: {
        lead_id: leadId!,
        source_channel: "manual",
        booking_page_id: bookingPageId,
        build_context: true,
      },
    })

    sharePageId = created.page.id
    pushCheck(
      checks,
      "admin_create_pending_review",
      created.page.status === "pending_review" && created.requiresHumanReview === true,
      `Created pending_review page ${sharePageId}.`,
    )
    pushCheck(
      checks,
      "create_tokens_returned_once",
      Boolean(created.publicToken && created.previewToken && created.publicUrl && created.previewUrl),
      "Create returned raw public/preview tokens and URLs once.",
    )
    pushCheck(
      checks,
      "create_no_token_hash",
      assertPayloadHasNoTokenHashes(created),
      "Create payload contains no token hashes.",
    )

    const detail = await getSharePageDetailForOperator(admin, {
      sharePageId: sharePageId!,
      organizationId: organizationId!,
      origin,
    })
    pushCheck(
      checks,
      "admin_detail_api",
      Boolean(detail && detail.qaMarker === GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER),
      detail ? "Detail loaded with operator QA marker." : "Detail missing.",
    )
    pushCheck(
      checks,
      "detail_analytics_summary",
      Boolean(detail?.analytics || detail?.engagementSummary),
      "Analytics / engagement summary present on detail.",
    )
    pushCheck(
      checks,
      "detail_no_token_hash",
      detail ? assertPayloadHasNoTokenHashes(detail) : false,
      "Detail payload contains no token hashes.",
    )
    pushCheck(
      checks,
      "detail_public_path_gated",
      detail?.publicPath === null && detail?.page.status === "pending_review",
      "Public path hidden until published.",
    )

    const preview = await regenerateSharePagePreviewForOperator(admin, {
      sharePageId: sharePageId!,
      organizationId: organizationId!,
      origin,
      rebuildContext: true,
    })
    pushCheck(
      checks,
      "preview_regenerate",
      Boolean(preview.previewToken && preview.previewUrl.includes("/p-preview/")),
      "Preview token regenerated with preview URL.",
    )

    if (actorUserId) {
      const approved = await approveSharePageForOperator(admin, {
        sharePageId: sharePageId!,
        organizationId: organizationId!,
        approvedBy: actorUserId,
        origin,
      })
      pushCheck(
        checks,
        "approve_publish",
        approved.page.status === "published",
        "Approve transitioned page to published.",
      )

      const detailPublished = await getSharePageDetailForOperator(admin, {
        sharePageId: sharePageId!,
        organizationId: organizationId!,
        origin,
      })
      pushCheck(
        checks,
        "published_public_path_template",
        detailPublished?.publicPath === "/p/{token}",
        "Published detail exposes public path template only (no raw token).",
      )
    } else {
      pushCheck(
        checks,
        "approve_publish",
        true,
        "Skipped approve — no cert actor user id (created_by unavailable).",
      )
      pushCheck(
        checks,
        "published_public_path_template",
        true,
        "Skipped published public path check — approve skipped.",
      )
    }

    const revoked = await revokeSharePageForOperator(admin, {
      sharePageId: sharePageId!,
      organizationId: organizationId!,
    })
    pushCheck(checks, "revoke_action", revoked.status === "revoked", "Revoke action succeeded.")

    const archived = await archiveSharePageForOperator(admin, {
      sharePageId: sharePageId!,
      organizationId: organizationId!,
    })
    pushCheck(checks, "archive_action", archived.status === "archived", "Archive action succeeded.")

    pushCheck(
      checks,
      "human_review_gate",
      created.requiresHumanReview === true,
      "Human review gate preserved on create.",
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    pushCheck(checks, "operator_flow_exception", false, message)
    blockers.push(message)
  }

  const ok = checks.every((check) => check.ok)
  return {
    ok,
    execution_id: executionId,
    qa_marker: GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
    checks,
    blockers,
    final_verdict: ok ? "PASS" : "FAIL",
    share_page_id: sharePageId,
  }
}
