/**
 * AIOS-TRAINING-BUSINESS-STRATEGY-1B — Read-only Production validation.
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-aios-training-business-strategy-1b-production.ts
 */
import assert from "node:assert/strict"

import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { collectApprovedProfileEvidence } from "@/lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthTrainingOverviewReadModel } from "@/lib/growth/training/build-growth-training-overview-read-model"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import { resolveBusinessStrategyContent } from "@/lib/growth/training/growth-business-strategy-types"

export const AIOS_TRAINING_BUSINESS_STRATEGY_1B_QA_MARKER =
  "aios-training-business-strategy-1b-v1" as const

const PHASE = "AIOS-TRAINING-BUSINESS-STRATEGY-1B" as const

type Check = { id: string; pass: boolean; detail: Record<string, unknown> }

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function hasList(values: string[] | null | undefined): boolean {
  return Boolean(values?.some((entry) => entry.trim()))
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production validation (read-only)`)

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
  const state = await fetchBusinessProfileWorkspaceState(admin, organizationId)
  const approved = state.activeApproved
  const draft = state.latestDraft
  const strategy = resolveBusinessStrategyContent(approved?.profile.businessStrategy)

  checks.push({
    id: "schema_ready",
    pass: state.schemaReady,
    detail: { schemaReady: state.schemaReady },
  })

  checks.push({
    id: "approved_profile_present",
    pass: Boolean(approved && approved.status === "approved"),
    detail: {
      profileId: approved?.id ?? null,
      status: approved?.status ?? null,
      approvedAt: approved?.approvedAt ?? null,
      approvedBy: approved?.approvedBy ?? null,
    },
  })

  checks.push({
    id: "approved_strategy_present",
    pass: Boolean(approved?.profile.businessStrategy),
    detail: { hasBusinessStrategy: Boolean(approved?.profile.businessStrategy) },
  })

  const visibleFieldCoverage = {
    mission: hasText(strategy.companyWide.mission),
    coreValues: hasList(strategy.companyWide.coreValues),
    elevatorPitch: hasText(strategy.messaging.elevatorPitch),
    tone: hasText(strategy.messaging.tone),
    formality: hasText(strategy.messaging.formality),
    wordsToAvoid: hasList(strategy.messaging.wordsToAvoid),
    pricingPhilosophy: hasText(strategy.positioning.pricingPhilosophy),
    competitiveAdvantages: hasList(strategy.positioning.competitiveAdvantages),
    qualificationStandards: hasList(strategy.salesPhilosophy.qualificationStandards),
    discoveryQuestions: hasList(strategy.salesPhilosophy.discoveryQuestions),
    salesRelationshipPrinciples: hasList(strategy.salesAndRelationships.principles),
    objections:
      strategy.objections.items.filter(
        (item) => hasText(item.objection) && hasText(item.preferredResponse),
      ).length,
  }

  checks.push({
    id: "visible_field_coverage",
    pass: Object.entries(visibleFieldCoverage)
      .filter(([key]) => key !== "objections")
      .every(([, value]) => Boolean(value)),
    detail: visibleFieldCoverage,
  })

  checks.push({
    id: "objection_pairs_present",
    pass: visibleFieldCoverage.objections > 0,
    detail: {
      objectionCount: visibleFieldCoverage.objections,
      sample: strategy.objections.items.slice(0, 3).map((item) => ({
        objection: item.objection,
        preferredResponse: item.preferredResponse,
      })),
    },
  })

  const completeness = evaluateBusinessStrategyCompleteness(strategy)
  const overview = buildGrowthTrainingOverviewReadModel({
    activeApproved: approved,
    latestDraft: draft,
    organizationalKnowledge: null,
    launchSetup: null,
  })
  const strategyArea = overview.areas.find((area) => area.id === "business_strategy")

  checks.push({
    id: "overview_strategy_status",
    pass:
      strategyArea?.status === "complete" &&
      completeness.filledSectionCount === completeness.totalSectionCount &&
      completeness.missingAreas.length === 0,
    detail: {
      status: strategyArea?.status ?? null,
      summary: strategyArea?.summary ?? null,
      coachingHint: strategyArea?.coachingHint ?? null,
      completeness,
    },
  })

  if (approved) {
    const sellerTruth = buildOutreachSellerTruth({ profile: approved.profile })
    const evidence = await collectApprovedProfileEvidence({
      admin,
      organizationId,
      loadApprovedProfile: async () => approved,
    })
    const factKeys = evidence.raw_items.map((item) => item.fact_key)

    checks.push({
      id: "ava_seller_truth_approved",
      pass:
        sellerTruth.source === "approved_business_profile" &&
        hasText(sellerTruth.mission) &&
        hasText(sellerTruth.elevatorPitch) &&
        hasText(sellerTruth.tonePreference) &&
        sellerTruth.objections.length > 0,
      detail: {
        source: sellerTruth.source,
        mission: sellerTruth.mission,
        elevatorPitch: sellerTruth.elevatorPitch,
        tonePreference: sellerTruth.tonePreference,
        wordsToAvoidCount: sellerTruth.wordsToAvoid.length,
        discoveryQuestionCount: sellerTruth.discoveryQuestions.length,
        objectionCount: sellerTruth.objections.length,
      },
    })

    checks.push({
      id: "ava_evidence_strategy_facts",
      pass: [
        "business_strategy.mission",
        "business_strategy.elevator_pitch",
        "business_strategy.tone",
        "business_strategy.pricing_philosophy",
      ].every((key) => factKeys.includes(key)),
      detail: {
        strategyFactCount: factKeys.filter((key) => key.startsWith("business_strategy.")).length,
      },
    })

    checks.push({
      id: "company_profile_preserved",
      pass:
        hasText(approved.profile.company.companyName) &&
        hasText(approved.profile.company.website) &&
        hasList(approved.profile.company.productsServices),
      detail: {
        companyName: approved.profile.company.companyName,
        website: approved.profile.company.website,
        productsServicesCount: approved.profile.company.productsServices.length,
      },
    })
  }

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  checks.push({
    id: "outbound_autonomy_disabled",
    pass: killSwitches.autonomy_outbound_enabled === false,
    detail: {
      autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
      emergency_stop: killSwitches.emergency_stop,
      wake_execution: killSwitches.wake_execution,
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
      probeError: outboundMessages.error?.message ?? null,
    },
  })

  if (draft) {
    checks.push({
      id: "draft_distinct_from_approved",
      pass: draft.id !== approved?.id && draft.status === "draft",
      detail: {
        draftId: draft.id,
        approvedId: approved?.id ?? null,
      },
    })
  }

  const failed = checks.filter((check) => !check.pass)
  const result = {
    ok: failed.length === 0,
    phase: PHASE,
    qa_marker: AIOS_TRAINING_BUSINESS_STRATEGY_1B_QA_MARKER,
    organizationId,
    approvedProfileId: approved?.id ?? null,
    draftProfileId: draft?.id ?? null,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
  }

  console.log(JSON.stringify(result, null, 2))
  if (failed.length > 0) process.exit(1)
  console.log(`[${PHASE}] PASS — Production Business Strategy validation complete`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
