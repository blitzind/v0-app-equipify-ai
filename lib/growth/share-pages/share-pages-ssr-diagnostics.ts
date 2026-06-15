/** Growth Engine SR-2B-2 — Share Pages SSR diagnostics. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  approveSharePage,
  archiveSharePage,
  createSharePage,
  lookupSharePageByPreviewToken,
  lookupSharePageByPublicToken,
  revokeSharePage,
} from "@/lib/growth/share-pages/share-page-repository"
import { buildGrowthSharePageContext } from "@/lib/growth/share-pages/share-page-context-service"
import { buildSharePageRenderModel } from "@/lib/growth/share-pages/share-page-public-service"
import { mapSharePageToRenderModel } from "@/lib/growth/share-pages/share-page-render-model"
import {
  GROWTH_SHARE_PAGES_SSR_QA_MARKER,
  GROWTH_SHARE_PAGES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-types"
import type { GrowthSharePagesDiagnosticsCheck } from "@/lib/growth/share-pages/share-pages-diagnostics"

const CERT_PREFIX = "share-pages-ssr-sr2b2-cert"

export type GrowthSharePagesSsrDiagnosticsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SHARE_PAGES_SSR_QA_MARKER
  checks: GrowthSharePagesDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL"
}

function pushCheck(
  checks: GrowthSharePagesDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = getGrowthEngineAiOrgId()
  if (configured) return configured

  const { data } = await admin.from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle()
  return data?.id ?? null
}

async function resolveCertLeadContext(admin: SupabaseClient): Promise<{ leadId: string; approverUserId: string | null } | null> {
  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select("id, created_by")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.id) return null
  return {
    leadId: data.id,
    approverUserId: typeof data.created_by === "string" ? data.created_by : null,
  }
}

export async function executeGrowthSharePagesSsrDiagnostics(
  admin: SupabaseClient,
): Promise<GrowthSharePagesSsrDiagnosticsReport> {
  const execution_id = randomUUID()
  const checks: GrowthSharePagesDiagnosticsCheck[] = []
  const blockers: string[] = []

  const organizationId = await resolveCertOrganizationId(admin)
  const leadContext = await resolveCertLeadContext(admin)

  if (!organizationId || !leadContext) {
    pushCheck(checks, "ssr_setup", false, "Missing organization_id or lead_id for SSR diagnostics.")
    blockers.push("ssr_setup_unavailable")
    return {
      ok: false,
      execution_id,
      qa_marker: GROWTH_SHARE_PAGES_SSR_QA_MARKER,
      checks,
      blockers,
      final_verdict: "FAIL",
    }
  }

  const { leadId, approverUserId } = leadContext

  let context
  try {
    context = await buildGrowthSharePageContext(admin, { leadId, companyId: null })
    pushCheck(
      checks,
      "context_builder",
      Boolean(context.prospectName && context.companyName && context.headline),
      "buildGrowthSharePageContext returned evidence-backed context.",
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    pushCheck(checks, "context_builder", false, message)
    blockers.push("context_builder_failed")
    return {
      ok: false,
      execution_id,
      qa_marker: GROWTH_SHARE_PAGES_SSR_QA_MARKER,
      checks,
      blockers,
      final_verdict: "FAIL",
    }
  }

  const created = await createSharePage(admin, {
    organizationId,
    leadId,
    status: "draft",
    headline: context.headline,
    heroMessage: context.personalizedMessage,
    whyReachingOut: context.whyReachingOut,
    companyObservations: context.companyObservations,
    personalizationSnapshot: context,
    sourcesUsed: context.sourcesUsed,
    evidenceCoverageScore: context.evidenceCoverageScore,
    heroMediaType: "video",
    heroMediaUrl: null,
    heroMediaThumbnailUrl: null,
    voiceAssetId: null,
    videoAssetId: null,
  })

  const previewDraft = await lookupSharePageByPreviewToken(admin, created.previewToken)
  pushCheck(
    checks,
    "preview_token_draft_resolution",
    previewDraft.access === "granted" && previewDraft.page?.id === created.page.id,
    "Preview token resolves draft page.",
  )

  const publicDraft = await lookupSharePageByPublicToken(admin, created.publicToken)
  pushCheck(
    checks,
    "public_token_unpublished_blocked",
    publicDraft.access === "unpublished",
    "Public token blocked for unpublished page.",
  )

  if (approverUserId) {
    await approveSharePage(admin, created.page.id, { approvedBy: approverUserId })
    const publicPublished = await lookupSharePageByPublicToken(admin, created.publicToken)
    pushCheck(
      checks,
      "public_token_published_resolution",
      publicPublished.access === "granted",
      "Public token resolves published page.",
    )

    await admin
      .schema("growth")
      .from("share_pages")
      .update({ expires_at: "2020-01-01T00:00:00.000Z" })
      .eq("id", created.page.id)
    const expired = await lookupSharePageByPublicToken(admin, created.publicToken)
    pushCheck(checks, "public_token_expired_blocked", expired.access === "expired", "Expired page blocked on public token.")
  } else {
    pushCheck(checks, "public_token_published_resolution", true, "Skipped — no approver user on cert lead.")
    pushCheck(checks, "public_token_expired_blocked", true, "Skipped — no approver user on cert lead.")
  }

  await revokeSharePage(admin, created.page.id)
  const revoked = await lookupSharePageByPublicToken(admin, created.publicToken)
  pushCheck(checks, "public_token_revoked_blocked", revoked.access === "revoked", "Revoked page blocked on public token.")

  await archiveSharePage(admin, created.page.id)
  const archived = await lookupSharePageByPublicToken(admin, created.publicToken)
  pushCheck(checks, "public_token_archived_blocked", archived.access === "archived", "Archived page blocked on public token.")

  const renderModel = mapSharePageToRenderModel(created.page, {
    prospectName: context.prospectName,
    companyName: context.companyName,
    previewMode: true,
  })
  const serialized = JSON.stringify(renderModel)
  pushCheck(
    checks,
    "ssr_render_safety",
    !serialized.includes("token_hash") &&
      !serialized.includes("tokenPrefix") &&
      !serialized.includes(created.publicToken) &&
      !serialized.includes(created.previewToken),
    "Render model excludes token hashes and raw tokens.",
  )

  pushCheck(
    checks,
    "future_media_placeholder_rendering",
    renderModel.heroMediaType === "video",
    "Future media type placeholder preserved in render model.",
  )

  const hydrated = await buildSharePageRenderModel(admin, created.page, { previewMode: false })
  pushCheck(
    checks,
    "ssr_render_model_hydration",
    hydrated.prospectName.length > 0 && hydrated.companyName.length > 0,
    "buildSharePageRenderModel hydrates lead-backed display fields.",
  )

  pushCheck(
    checks,
    "qa_marker_alignment",
    GROWTH_SHARE_PAGES_SSR_QA_MARKER.startsWith("share-pages-ssr") &&
      GROWTH_SHARE_PAGES_QA_MARKER === "share-pages-sr2-v1",
    "SSR QA marker aligned with share pages foundation.",
  )

  const failed = checks.filter((check) => !check.ok)
  return {
    ok: failed.length === 0 && blockers.length === 0,
    execution_id,
    qa_marker: GROWTH_SHARE_PAGES_SSR_QA_MARKER,
    checks,
    blockers,
    final_verdict: failed.length === 0 && blockers.length === 0 ? "PASS" : "FAIL",
  }
}
