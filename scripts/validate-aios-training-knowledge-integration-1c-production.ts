/**
 * AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1C — Read-only Production seller-truth bundle validation.
 * Run:
 *   pnpm test:aios-training-knowledge-integration-1c:production
 */
import { loadOutreachSellerTruthBundle } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import { AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1C_QA_MARKER } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"

const PHASE = "AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1C" as const

type Check = { id: string; pass: boolean; detail: Record<string, unknown> }

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production seller-truth bundle validation (read-only)`)

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "supabase_unavailable" }, null, 2))
    process.exit(1)
  }

  const admin = boot.admin
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  if (!organizationId) {
    console.error(JSON.stringify({ ok: false, error: "organization_id_unresolved" }, null, 2))
    process.exit(1)
  }

  const checks: Check[] = []
  const preparedAt = new Date().toISOString()
  const workspace = await fetchBusinessProfileWorkspaceState(admin, organizationId)
  const approved = workspace.activeApproved
  const strategyCompleteness = evaluateBusinessStrategyCompleteness(approved?.profile.businessStrategy)

  checks.push({
    id: "approved_profile_present",
    pass: Boolean(approved && approved.status === "approved"),
    detail: {
      organizationId,
      profileId: approved?.id ?? null,
    },
  })

  checks.push({
    id: "strategy_completeness_6_of_6",
    pass:
      strategyCompleteness.hasContent &&
      strategyCompleteness.filledSectionCount >= strategyCompleteness.totalSectionCount,
    detail: { completeness: strategyCompleteness },
  })

  const bundle = await loadOutreachSellerTruthBundle(admin, {
    organizationId,
    preparedAt,
    prospectCompanyName: approved?.companyName ?? "Prospect",
  })

  checks.push({
    id: "bundle_seller_truth_approved_source",
    pass: bundle.sellerTruth.source === "approved_business_profile",
    detail: {
      source: bundle.sellerTruth.source,
      profileId: bundle.sellerTruth.profileId,
      mission: bundle.sellerTruth.mission,
    },
  })

  checks.push({
    id: "bundle_profile_id_matches_authority",
    pass: bundle.metadata.profileRecordId === approved?.id,
    detail: {
      bundleProfileRecordId: bundle.metadata.profileRecordId,
      approvedProfileId: approved?.id ?? null,
    },
  })

  checks.push({
    id: "complete_profile_skips_runtime_merge",
    pass:
      bundle.metadata.useApprovedProfileAsIs === true &&
      bundle.metadata.runtimeEnrichmentApplied === false,
    detail: {
      useApprovedProfileAsIs: bundle.metadata.useApprovedProfileAsIs,
      runtimeEnrichmentApplied: bundle.metadata.runtimeEnrichmentApplied,
    },
  })

  checks.push({
    id: "research_context_shares_seller_truth_source",
    pass:
      bundle.researchOrganizationContext.source === bundle.sellerTruth.source &&
      bundle.researchOrganizationContext.companyName === bundle.sellerTruth.sellerCompanyName,
    detail: {
      researchSource: bundle.researchOrganizationContext.source,
      sellerSource: bundle.sellerTruth.source,
      companyName: bundle.researchOrganizationContext.companyName,
      productCount: bundle.researchOrganizationContext.productsServices.length,
    },
  })

  checks.push({
    id: "bundle_snapshot_alignment",
    pass:
      Boolean(bundle.approvedProfile) &&
      bundle.sellerTruth.mission === bundle.approvedProfile?.businessStrategy?.companyWide.mission,
    detail: {
      sellerMission: bundle.sellerTruth.mission,
      profileMission: bundle.approvedProfile?.businessStrategy?.companyWide.mission ?? null,
    },
  })

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  checks.push({
    id: "outbound_autonomy_disabled",
    pass: killSwitches.autonomy_outbound_enabled === false,
    detail: {
      autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
    },
  })

  const outboundMessages = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })

  checks.push({
    id: "outbound_messages_readonly_probe",
    pass: outboundMessages.error == null,
    detail: {
      outboundMessageCount: outboundMessages.count ?? 0,
    },
  })

  const failed = checks.filter((check) => !check.pass)
  const result = {
    ok: failed.length === 0,
    phase: PHASE,
    qa_marker: AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1C_QA_MARKER,
    organizationId,
    approvedProfileId: approved?.id ?? null,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
  }

  console.log(JSON.stringify(result, null, 2))
  if (failed.length > 0) process.exit(1)
  console.log(`[${PHASE}] PASS — Production seller-truth bundle validation complete`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
