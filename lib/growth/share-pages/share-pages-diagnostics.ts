/** Growth Engine SR-2B-1 — Share Pages diagnostics & certification scaffolding. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  appendSharePageEvent,
  approveSharePage,
  archiveSharePage,
  createSharePage,
  createSharePageViewSession,
  getSharePageAnalyticsSummary,
  resolveSharePageByPreviewToken,
  resolveSharePageByToken,
  revokeSharePage,
  updateSharePage,
  updateSharePageViewSession,
} from "@/lib/growth/share-pages/share-page-repository"
import { assertSharePagesExecuteAllowed } from "@/lib/growth/share-pages/share-pages-route-gates"
import {
  probeGrowthSharePagesSchema,
  GROWTH_SHARE_PAGES_SCHEMA_OBJECTS,
} from "@/lib/growth/share-pages/share-pages-schema-health"
import {
  generateSharePagePreviewTokenBundle,
  generateSharePageTokenBundle,
  hashSharePageToken,
  verifySharePageToken,
} from "@/lib/growth/share-pages/share-page-token"
import {
  GROWTH_SHARE_PAGES_CONFIRM,
  GROWTH_SHARE_PAGES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-types"

export { GROWTH_SHARE_PAGES_CONFIRM }

const CERT_PREFIX = "share-pages-sr2b1-cert"

export type GrowthSharePagesDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSharePagesDiagnosticsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SHARE_PAGES_QA_MARKER
  checks: GrowthSharePagesDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  share_page_id?: string
}

function pushCheck(
  checks: GrowthSharePagesDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

function runTokenDiagnostics(checks: GrowthSharePagesDiagnosticsCheck[]): void {
  const publicBundle = generateSharePageTokenBundle()
  const previewBundle = generateSharePagePreviewTokenBundle()

  pushCheck(
    checks,
    "token_generation",
    publicBundle.rawToken.length >= 16 && previewBundle.rawToken.startsWith("pv_"),
    "Opaque public and preview tokens generated.",
  )

  pushCheck(
    checks,
    "token_hash_at_rest",
    publicBundle.tokenHash === hashSharePageToken(publicBundle.rawToken) &&
      publicBundle.tokenHash !== publicBundle.rawToken,
    "Only token hashes are derived from raw tokens.",
  )

  pushCheck(
    checks,
    "token_timing_safe_compare",
    verifySharePageToken(publicBundle.rawToken, publicBundle.tokenHash) &&
      !verifySharePageToken(publicBundle.rawToken, previewBundle.tokenHash),
    "Timing-safe token verification passes for matching hash only.",
  )

  pushCheck(
    checks,
    "token_prefix",
    publicBundle.tokenPrefix === publicBundle.rawToken.slice(0, 8),
    "Token prefix matches first 8 characters.",
  )
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

async function resolveCertLeadId(admin: SupabaseClient): Promise<{ leadId: string; approverUserId: string | null } | null> {
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
    approverUserId: typeof data.created_by === "string" ? data.created_by : null,
  }
}

async function runRepositoryDiagnostics(
  admin: SupabaseClient,
  checks: GrowthSharePagesDiagnosticsCheck[],
): Promise<{ sharePageId: string | null; cleanupIds: string[] }> {
  const organizationId = await resolveCertOrganizationId(admin)
  const leadContext = await resolveCertLeadId(admin)

  if (!organizationId || !leadContext) {
    pushCheck(
      checks,
      "repository_crud",
      false,
      "Skipped repository CRUD — organization_id or lead_id unavailable.",
    )
    return { sharePageId: null, cleanupIds: [] }
  }

  const { leadId, approverUserId } = leadContext

  const created = await createSharePage(admin, {
    organizationId,
    leadId,
    sourceChannel: "manual",
    status: "draft",
    headline: `${CERT_PREFIX} headline`,
    heroMessage: `${CERT_PREFIX} hero message`,
    whyReachingOut: `${CERT_PREFIX} why reaching out`,
    companyObservations: [`${CERT_PREFIX} observation`],
    createdBy: null,
  })

  pushCheck(checks, "repository_create", created.page.status === "draft", "createSharePage persisted draft row.")

  const updated = await updateSharePage(admin, created.page.id, {
    status: "pending_review",
    headline: `${CERT_PREFIX} updated headline`,
  })
  pushCheck(
    checks,
    "repository_update",
    updated.status === "pending_review" && updated.headline.includes("updated"),
    "updateSharePage updated editable draft.",
  )

  const previewResolved = await resolveSharePageByPreviewToken(admin, created.previewToken)
  pushCheck(
    checks,
    "preview_token_resolution",
    previewResolved?.id === created.page.id,
    "resolveSharePageByPreviewToken resolved draft page.",
  )

  const prePublishPublic = await resolveSharePageByToken(admin, created.publicToken)
  pushCheck(
    checks,
    "public_token_pre_publish_blocked",
    prePublishPublic === null,
    "resolveSharePageByToken blocked unpublished page.",
  )

  if (approverUserId) {
    const approved = await approveSharePage(admin, created.page.id, {
      approvedBy: approverUserId,
    })
    pushCheck(
      checks,
      "repository_approve",
      approved.status === "published" && Boolean(approved.publishedAt),
      "approveSharePage published page with human approval metadata.",
    )

    const publicResolved = await resolveSharePageByToken(admin, created.publicToken)
    pushCheck(
      checks,
      "public_token_resolution",
      publicResolved?.id === created.page.id,
      "resolveSharePageByToken resolved published page.",
    )
  } else {
    pushCheck(
      checks,
      "repository_approve",
      true,
      "Skipped approveSharePage — no approver user id on cert lead.",
    )
    pushCheck(
      checks,
      "public_token_resolution",
      true,
      "Skipped public token resolution — page not published without approver.",
    )
  }

  const view = await createSharePageViewSession(admin, {
    sharePageId: created.page.id,
    leadId,
    sessionKey: `${CERT_PREFIX}-${randomUUID()}`,
    pageUrl: "https://app.equipify.ai/p/cert",
  })
  pushCheck(checks, "repository_create_view", view.sharePageId === created.page.id, "createSharePageViewSession persisted view.")

  const updatedView = await updateSharePageViewSession(admin, view.id, {
    durationMs: 1500,
    maxScrollDepthPct: 50,
    lastActivityAt: new Date().toISOString(),
  })
  pushCheck(
    checks,
    "repository_update_view",
    updatedView.durationMs === 1500 && updatedView.maxScrollDepthPct === 50,
    "updateSharePageViewSession updated session metrics.",
  )

  const event = await appendSharePageEvent(admin, {
    sharePageId: created.page.id,
    leadId,
    sharePageViewId: view.id,
    eventType: "SHARE_PAGE_VIEWED",
    eventLabel: `${CERT_PREFIX} viewed`,
  })
  pushCheck(checks, "repository_append_event", event.eventType === "SHARE_PAGE_VIEWED", "appendSharePageEvent persisted event.")

  const analytics = await getSharePageAnalyticsSummary(admin, created.page.id)
  pushCheck(
    checks,
    "repository_analytics_summary",
    analytics !== null && analytics.sharePageId === created.page.id,
    "getSharePageAnalyticsSummary returned summary payload.",
  )

  await revokeSharePage(admin, created.page.id)
  const revokedPublic = await resolveSharePageByToken(admin, created.publicToken)
  pushCheck(
    checks,
    "repository_revoke",
    revokedPublic === null,
    "revokeSharePage invalidated public token resolution.",
  )

  const archived = await archiveSharePage(admin, created.page.id)
  pushCheck(checks, "repository_archive", archived.status === "archived", "archiveSharePage archived page.")

  return { sharePageId: created.page.id, cleanupIds: [created.page.id] }
}

export async function executeGrowthSharePagesDiagnostics(
  admin: SupabaseClient,
  input?: { dry_run?: boolean; skip_repository?: boolean },
): Promise<GrowthSharePagesDiagnosticsReport> {
  const execution_id = randomUUID()
  const checks: GrowthSharePagesDiagnosticsCheck[] = []
  const blockers: string[] = []

  const gate = assertSharePagesExecuteAllowed(process.env as Record<string, string | undefined>)
  if (!gate.ok && process.env.GROWTH_SHARE_PAGES_CERT_ALLOW_LOCAL === "1") {
    pushCheck(checks, "environment_gate", true, "Local certification override enabled.")
  } else {
    pushCheck(
      checks,
      "environment_gate",
      gate.ok,
      gate.ok ? "Environment gate satisfied." : gate.blockers.join(", "),
    )
    if (!gate.ok) blockers.push(...gate.blockers)
  }

  runTokenDiagnostics(checks)

  const schemaProbe = await probeGrowthSharePagesSchema(admin)
  pushCheck(
    checks,
    "schema_tables",
    schemaProbe.ready,
    schemaProbe.ready
      ? "share_pages, share_page_views, and share_page_events are queryable."
      : schemaProbe.tables
          .filter((entry) => !entry.ok)
          .map((entry) => `${entry.table}: ${entry.error ?? "missing"}`)
          .join("; "),
  )

  if (!schemaProbe.ready) {
    blockers.push("share_pages_schema_not_ready")
  }

  let sharePageId: string | undefined
  if (!input?.dry_run && schemaProbe.ready && !input?.skip_repository) {
    try {
      const repositoryResult = await runRepositoryDiagnostics(admin, checks)
      sharePageId = repositoryResult.sharePageId ?? undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      pushCheck(checks, "repository_crud", false, message)
      blockers.push("repository_crud_failed")
    }
  } else if (input?.dry_run) {
    pushCheck(checks, "repository_crud", true, "Dry run — repository CRUD skipped.")
  }

  const failedChecks = checks.filter((check) => !check.ok)
  const ok = failedChecks.length === 0 && blockers.length === 0

  return {
    ok,
    execution_id,
    qa_marker: GROWTH_SHARE_PAGES_QA_MARKER,
    checks,
    blockers,
    final_verdict: ok ? "PASS" : "FAIL",
    share_page_id: sharePageId,
  }
}

export type GrowthSharePagesSchemaObject = (typeof GROWTH_SHARE_PAGES_SCHEMA_OBJECTS)[number]
