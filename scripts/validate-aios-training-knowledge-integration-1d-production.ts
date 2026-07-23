/**
 * AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1D — Read-only Production personalization/playbook validation.
 * Run:
 *   pnpm test:aios-training-knowledge-integration-1d:production
 */
import { loadOutreachSellerTruthBundle } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import {
  buildOutreachRefinementSystemPrompt,
  buildOutreachRefinementUserPrompt,
} from "@/lib/growth/outreach/personalization/ai-refinement-prompts"
import {
  AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1D_QA_MARKER,
  buildGrowthOutreachPersonalizationOrganizationKnowledgeBlock,
  outreachPersonalizationPromptContainsHardcodedEquipifyBranding,
} from "@/lib/growth/outreach/personalization/growth-outreach-personalization-organization-knowledge"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  buildGrowthIndustryContext,
  buildIndustryContextEmailParagraphs,
} from "@/lib/growth/playbooks/growth-industry-context"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import fs from "node:fs"
import path from "node:path"

const PHASE = "AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1D" as const

type Check = { id: string; pass: boolean; detail: Record<string, unknown> }

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production personalization/playbook validation (read-only)`)

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
    prospectIndustry: approved?.profile.idealCustomers.targetIndustries?.[0] ?? null,
    prospectCompanyName: "Production Validation Prospect",
  })

  const organizationKnowledge = buildGrowthOutreachPersonalizationOrganizationKnowledgeBlock(
    bundle.sellerTruth,
    bundle.approvedProfile,
  )

  checks.push({
    id: "seller_truth_bundle_approved_source",
    pass: bundle.sellerTruth.source === "approved_business_profile",
    detail: {
      source: bundle.sellerTruth.source,
      profileId: bundle.sellerTruth.profileId,
      sellerCompanyName: bundle.sellerTruth.sellerCompanyName,
    },
  })

  checks.push({
    id: "personalization_organization_context_from_training",
    pass:
      organizationKnowledge.source === "approved_business_profile" &&
      Boolean(organizationKnowledge.companyName) &&
      organizationKnowledge.productsServices.length > 0,
    detail: {
      companyName: organizationKnowledge.companyName,
      productsServices: organizationKnowledge.productsServices,
      tone: organizationKnowledge.tone,
      wordsToAvoidCount: organizationKnowledge.wordsToAvoid.length,
    },
  })

  const systemPrompt = buildOutreachRefinementSystemPrompt(120, null, organizationKnowledge)
  const industryContext = buildGrowthIndustryContext({
    companyName: "Production Validation Prospect",
    industryLabel: approved?.profile.idealCustomers.targetIndustries?.[0] ?? "field service",
    verifiedFacts: ["provides recurring field service operations"],
    organizationKnowledge,
  })
  const userPrompt = buildOutreachRefinementUserPrompt({
    draft: {
      subject: "Workflow review",
      body: "Hi — many teams often struggle with dispatch visibility.",
      wordCount: 8,
    },
    blocks: [],
    allowedFacts: ["provides recurring field service operations"],
    industryContext,
    organizationKnowledge,
    maxWords: 120,
  })
  const paragraphs = buildIndustryContextEmailParagraphs(industryContext, "Production Validation Prospect")

  checks.push({
    id: "refinement_prompts_use_approved_organization_name",
    pass:
      systemPrompt.includes(`${organizationKnowledge.companyName}'s Growth Engine`) &&
      userPrompt.includes(`"${organizationKnowledge.companyName}"`),
    detail: {
      systemPromptExcerpt: systemPrompt.split("\n")[0],
    },
  })

  checks.push({
    id: "no_reusable_hardcoded_equipify_branding_in_active_prompt_sources",
    pass:
      !outreachPersonalizationPromptContainsHardcodedEquipifyBranding(
        readSource("lib/growth/outreach/personalization/ai-refinement-prompts.ts"),
      ) &&
      !outreachPersonalizationPromptContainsHardcodedEquipifyBranding(
        readSource("lib/growth/playbooks/growth-industry-context.ts"),
      ),
    detail: {},
  })

  checks.push({
    id: "playbook_enrichment_advisory_only",
    pass:
      userPrompt.includes('"advisoryOnly": true') &&
      Boolean(paragraphs.industryParagraph && /often/i.test(paragraphs.industryParagraph)),
    detail: {
      capabilityParagraph: paragraphs.capabilityParagraph,
      industryParagraph: paragraphs.industryParagraph,
    },
  })

  checks.push({
    id: "approved_products_in_capability_projection",
    pass: Boolean(
      paragraphs.capabilityParagraph &&
        organizationKnowledge.productsServices.some((product) =>
          paragraphs.capabilityParagraph!.includes(product),
        ),
    ),
    detail: {
      capabilityParagraph: paragraphs.capabilityParagraph,
      productsServices: organizationKnowledge.productsServices,
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
    qa_marker: AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1D_QA_MARKER,
    organizationId,
    approvedProfileId: approved?.id ?? null,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
  }

  console.log(JSON.stringify(result, null, 2))
  if (failed.length > 0) process.exit(1)
  console.log(`[${PHASE}] PASS — Production personalization/playbook validation complete`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
