/**
 * AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1A — Read-only Production organizational knowledge validation.
 * Run:
 *   pnpm test:aios-training-knowledge-integration-1a:production
 */
import { buildGrowthAiCopilotOrganizationKnowledgeBlock } from "@/lib/growth/ai-copilot-organization-knowledge"
import { loadOutreachSellerTruthForOrganization } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { collectApprovedProfileEvidence } from "@/lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthTrainingOverviewReadModel } from "@/lib/growth/training/build-growth-training-overview-read-model"
import { isCanonicalSellerKnowledgeEnriched } from "@/lib/growth/training/canonical-seller-knowledge-onboarding-1a"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import { resolveBusinessStrategyContent } from "@/lib/growth/training/growth-business-strategy-types"
import { AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1A_QA_MARKER } from "@/lib/growth/ai-copilot-organization-knowledge"

const PHASE = "AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1A" as const

type Check = { id: string; pass: boolean; detail: Record<string, unknown> }

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production organizational knowledge validation (read-only)`)

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
  const strategy = resolveBusinessStrategyContent(approved?.profile.businessStrategy)
  const strategyCompleteness = evaluateBusinessStrategyCompleteness(strategy)

  checks.push({
    id: "approved_profile_present",
    pass: Boolean(approved && approved.status === "approved"),
    detail: {
      organizationId,
      profileId: approved?.id ?? null,
      approvedAt: approved?.approvedAt ?? null,
    },
  })

  checks.push({
    id: "approved_strategy_authority",
    pass:
      strategyCompleteness.hasContent &&
      strategyCompleteness.filledSectionCount >= strategyCompleteness.totalSectionCount,
    detail: {
      completeness: strategyCompleteness,
      canonicalSellerKnowledgeStored: isCanonicalSellerKnowledgeEnriched(approved?.profile),
    },
  })

  const sellerTruthLoads = await Promise.all([
    loadOutreachSellerTruthForOrganization(admin, {
      organizationId,
      preparedAt,
      prospectCompanyName: approved?.companyName ?? "Prospect",
    }),
    loadOutreachSellerTruthForOrganization(admin, {
      organizationId,
      preparedAt: preparedAt,
      prospectCompanyName: approved?.companyName ?? "Prospect",
    }),
  ])

  checks.push({
    id: "seller_truth_approved_source",
    pass: sellerTruthLoads[0]?.source === "approved_business_profile",
    detail: {
      source: sellerTruthLoads[0]?.source ?? null,
      profileId: sellerTruthLoads[0]?.profileId ?? null,
      mission: sellerTruthLoads[0]?.mission ?? null,
      tone: sellerTruthLoads[0]?.tonePreference ?? null,
    },
  })

  checks.push({
    id: "seller_truth_loader_idempotent",
    pass:
      sellerTruthLoads[0]?.source === sellerTruthLoads[1]?.source &&
      sellerTruthLoads[0]?.mission === sellerTruthLoads[1]?.mission &&
      sellerTruthLoads[0]?.elevatorPitch === sellerTruthLoads[1]?.elevatorPitch,
    detail: {
      duplicateLoads: 2,
      sameSource: sellerTruthLoads[0]?.source === sellerTruthLoads[1]?.source,
    },
  })

  checks.push({
    id: "approved_strategy_matches_seller_truth",
    pass:
      hasText(strategy.companyWide.mission) &&
      sellerTruthLoads[0]?.mission === strategy.companyWide.mission &&
      sellerTruthLoads[0]?.elevatorPitch === strategy.messaging.elevatorPitch &&
      sellerTruthLoads[0]?.tonePreference === strategy.messaging.tone,
    detail: {
      approvedMission: strategy.companyWide.mission,
      sellerMission: sellerTruthLoads[0]?.mission ?? null,
      approvedTone: strategy.messaging.tone,
      sellerTone: sellerTruthLoads[0]?.tonePreference ?? null,
    },
  })

  if (approved) {
    const evidence = await collectApprovedProfileEvidence({
      admin,
      organizationId,
      loadApprovedProfile: async () => approved,
    })
    const factKeys = evidence.raw_items.map((item) => item.fact_key)
    checks.push({
      id: "approved_evidence_facts_present",
      pass: factKeys.some((key) => key.startsWith("business_strategy.")),
      detail: {
        strategyFactCount: factKeys.filter((key) => key.startsWith("business_strategy.")).length,
      },
    })
  }

  const organizationKnowledge = buildGrowthAiCopilotOrganizationKnowledgeBlock(sellerTruthLoads[0]!)
  checks.push({
    id: "copilot_organization_knowledge_projection",
    pass:
      organizationKnowledge.source === "approved_business_profile" &&
      organizationKnowledge.mission === sellerTruthLoads[0]?.mission,
    detail: {
      source: organizationKnowledge.source,
      mission: organizationKnowledge.mission,
      objectionCount: organizationKnowledge.objections.length,
    },
  })

  const overview = buildGrowthTrainingOverviewReadModel({
    activeApproved: approved,
    latestDraft: workspace.latestDraft,
    organizationalKnowledge: null,
    launchSetup: null,
  })
  const strategyArea = overview.areas.find((area) => area.id === "business_strategy")

  checks.push({
    id: "training_overview_well_understood",
    pass:
      strategyArea?.status === "complete" &&
      strategyCompleteness.filledSectionCount === strategyCompleteness.totalSectionCount,
    detail: {
      status: strategyArea?.status ?? null,
      completeness: strategyCompleteness,
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
      outboundMessageCount: outboundMessages.count ?? null,
    },
  })

  const failed = checks.filter((check) => !check.pass)
  const result = {
    ok: failed.length === 0,
    phase: PHASE,
    qa_marker: AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1A_QA_MARKER,
    organizationId,
    approvedProfileId: approved?.id ?? null,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
  }

  console.log(JSON.stringify(result, null, 2))
  if (failed.length > 0) process.exit(1)
  console.log(`[${PHASE}] PASS — Production organizational knowledge validation complete`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
