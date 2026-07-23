/**
 * AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1B — Read-only Production prospect research prompt validation.
 * Run:
 *   pnpm test:aios-training-knowledge-integration-1b:production
 */
import { buildAiOsProviderMessagesFromContextPackage } from "@/lib/growth/aios/ai-provider-context-prompt"
import { loadGrowthProspectResearchOrganizationContextForOrganization } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  buildGrowthProspectResearchOrganizationContextFallback,
  AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1B_QA_MARKER,
} from "@/lib/growth/research/growth-prospect-research-organization-context"
import {
  buildGrowthProspectResearchSystemPrompt,
  researchPromptContainsHardcodedEquipifyProductFraming,
} from "@/lib/growth/research/growth-prospect-research-prompt-builder"
import {
  buildGrowthLeadResearchSystemPrompt,
  buildGrowthLeadResearchUserPrompt,
} from "@/lib/growth/research-prompt"

const PHASE = "AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1B" as const

type Check = { id: string; pass: boolean; detail: Record<string, unknown> }

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production prospect research prompt validation (read-only)`)

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

  checks.push({
    id: "approved_profile_present",
    pass: Boolean(approved && approved.status === "approved"),
    detail: {
      organizationId,
      profileId: approved?.id ?? null,
      companyName: approved?.companyName ?? null,
    },
  })

  const organizationContext = await loadGrowthProspectResearchOrganizationContextForOrganization(admin, {
    organizationId,
    preparedAt,
    prospectCompanyName: approved?.companyName ?? "Prospect",
  })

  checks.push({
    id: "research_context_approved_source",
    pass: organizationContext.source === "approved_business_profile",
    detail: {
      source: organizationContext.source,
      companyName: organizationContext.companyName,
      productCount: organizationContext.productsServices.length,
      qualificationCount: organizationContext.qualificationStandards.length,
    },
  })

  checks.push({
    id: "research_context_not_fallback",
    pass: organizationContext.source !== "fallback_defaults",
    detail: {
      source: organizationContext.source,
    },
  })

  const systemPrompt = buildGrowthProspectResearchSystemPrompt({
    websiteContext: { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    organizationContext,
  })
  const legacySystemPrompt = buildGrowthLeadResearchSystemPrompt(
    { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    organizationContext,
  )
  const legacyUserPrompt = buildGrowthLeadResearchUserPrompt(
    {
      id: "probe-lead",
      organizationId,
      companyName: "Production probe prospect",
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      website: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      sourceKind: "manual",
      sourceDetail: null,
      status: "new",
      notes: null,
      score: null,
      researchPriority: "normal",
      createdAt: preparedAt,
      updatedAt: preparedAt,
      createdBy: null,
      assignedTo: null,
      lastResearchedAt: null,
      metadata: {},
    },
    { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    organizationContext,
  )

  const approvedCompanyName = approved?.companyName?.trim() ?? organizationContext.companyName
  const hasDynamicOrgName =
    Boolean(approvedCompanyName) &&
    systemPrompt.includes(approvedCompanyName!) &&
    legacySystemPrompt.includes(approvedCompanyName!)
  checks.push({
    id: "prompt_identifies_selling_organization",
    pass: hasDynamicOrgName,
    detail: {
      approvedCompanyName,
      promptIncludesOrgName: hasDynamicOrgName,
    },
  })

  const hasApprovedProducts = organizationContext.productsServices.some((product) =>
    systemPrompt.includes(product),
  )
  checks.push({
    id: "prompt_includes_approved_products",
    pass: hasApprovedProducts,
    detail: {
      productsServices: organizationContext.productsServices,
    },
  })

  const hasQualification =
    organizationContext.qualificationStandards.length === 0 ||
    organizationContext.qualificationStandards.some((entry) => systemPrompt.includes(entry))
  checks.push({
    id: "prompt_includes_qualification_when_available",
    pass: hasQualification,
    detail: {
      qualificationStandards: organizationContext.qualificationStandards,
    },
  })

  const noHardcodedFraming =
    !researchPromptContainsHardcodedEquipifyProductFraming(systemPrompt) &&
    !researchPromptContainsHardcodedEquipifyProductFraming(legacySystemPrompt) &&
    !researchPromptContainsHardcodedEquipifyProductFraming(legacyUserPrompt)
  checks.push({
    id: "no_reusable_hardcoded_equipify_framing",
    pass: noHardcodedFraming,
    detail: {
      usesOrganizationFitScoreKey: systemPrompt.includes("organization_fit_score"),
      legacyEquipifyFitScoreKeyAbsent: !systemPrompt.includes("equipify_fit_score"),
    },
  })

  const fallbackPrompt = buildGrowthProspectResearchSystemPrompt({
    websiteContext: { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    organizationContext: buildGrowthProspectResearchOrganizationContextFallback(),
  })
  checks.push({
    id: "fallback_prompt_organization_neutral",
    pass: !fallbackPrompt.includes("Equipify") && !fallbackPrompt.includes("field-service software"),
    detail: {
      fallbackSource: "fallback_defaults",
    },
  })

  const aiOsMessages = buildAiOsProviderMessagesFromContextPackage({
    purpose: "research_company",
    organizationContext,
    contextPackage: {
      id: "production-readonly-probe",
      organizationId,
      missionId: null,
      workOrderId: null,
      contextVersion: "v1",
      checksum: "readonly",
      workOrderContext: null,
      missionContext: null,
      decisionHistory: [],
      memoryReferences: [],
      relatedEvents: [],
      evidenceBundle: [],
      entityMetadata: { company_name: "Production probe prospect" },
      sourceKeys: [],
      createdAt: preparedAt,
    },
  })
  const aiOsSystem = aiOsMessages.find((message) => message.role === "system")?.content
  checks.push({
    id: "ai_os_research_company_prompt_dynamic",
    pass:
      typeof aiOsSystem === "string" &&
      Boolean(approvedCompanyName && aiOsSystem.includes(approvedCompanyName)) &&
      !researchPromptContainsHardcodedEquipifyProductFraming(aiOsSystem),
    detail: {
      promptChars: typeof aiOsSystem === "string" ? aiOsSystem.length : 0,
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
    qa_marker: AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1B_QA_MARKER,
    organizationId,
    approvedProfileId: approved?.id ?? null,
    liveAiCall: false,
    checks,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
  }

  console.log(JSON.stringify(result, null, 2))
  if (failed.length > 0) process.exit(1)
  console.log(`[${PHASE}] PASS — Production prospect research prompt validation complete`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
