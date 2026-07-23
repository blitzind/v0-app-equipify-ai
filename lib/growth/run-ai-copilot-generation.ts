import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { buildGrowthAiCopilotOrganizationKnowledgeBlock } from "@/lib/growth/ai-copilot-organization-knowledge"
import { buildGrowthAiCopilotInput } from "@/lib/growth/ai-copilot-input"
import {
  buildGrowthAiCopilotSystemPrompt,
  buildGrowthAiCopilotUserPrompt,
} from "@/lib/growth/ai-copilot-prompts"
import { getGrowthAiProvider, growthAiCopilotInputHash } from "@/lib/growth/ai-copilot-provider"
import {
  fetchGrowthCopilotSettings,
  insertGrowthAiCopilotEffectiveness,
  insertGrowthAiCopilotGeneration,
  listGrowthAiCopilotRules,
} from "@/lib/growth/ai-copilot-repository"
import {
  computeGrowthAiCopilotEffectivenessScore,
  evaluateGrowthAiCopilotRules,
} from "@/lib/growth/ai-copilot-rules"
import {
  growthAiCopilotModelSchema,
  mapGrowthAiCopilotModelOutput,
} from "@/lib/growth/ai-copilot-schema"
import {
  GROWTH_AI_COPILOT_PROMPT_VERSION,
  type GrowthAiCopilotGeneration,
  type GrowthAiCopilotGenerationType,
  type GrowthAiCopilotInputSnapshot,
  type GrowthAiCopilotPromptVariant,
} from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import {
  isOutreachPersonalizationEmailType,
  OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
} from "@/lib/growth/outreach/personalization/personalization-types"
import { runOutreachPersonalizationGeneration } from "@/lib/growth/outreach/personalization/run-outreach-personalization"
import { resolveOutreachLeadIndustryTags } from "@/lib/growth/outreach/personalization/context-packet-builder"
import { buildOutreachIndustryContextForLead } from "@/lib/growth/outreach/personalization/outreach-industry-context-builder"
import { buildGrowthReasoningDiagnosticsFromIndustryInput } from "@/lib/growth/reasoning/growth-reasoning-engine"
import type { GrowthReasoningChannel } from "@/lib/growth/reasoning/growth-reasoning-types"
import { buildGrowthSequenceIntelligenceFromIndustryInput } from "@/lib/growth/sequence-intelligence/growth-sequence-engine"
import {
  persistOutreachPerformanceAttribution,
} from "@/lib/growth/outreach/performance/performance-attribution-repository"
import { buildOutreachPerformanceAttributionRecord } from "@/lib/growth/outreach/performance/outreach-attribution-builder"
import {
  emitGrowthLeadAiCopilotGenerationApprovedTimeline,
  emitGrowthLeadAiCopilotGenerationCreatedTimeline,
  emitGrowthLeadPlaybookConflictDetectedTimeline,
} from "@/lib/growth/timeline-emitter"
import {
  buildPlaybookAttribution,
  computePlaybookInfluenceScore,
} from "@/lib/growth/ai-copilot-playbook-influence"
import {
  insertGrowthAiCopilotPlaybookEffectiveness,
  linkGrowthAiCopilotGenerationPlaybookRules,
} from "@/lib/growth/ai-copilot-playbook-repository"
import { resolveGrowthAiCopilotPlaybookRules } from "@/lib/growth/ai-copilot-playbook-resolver"
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"
import { resolveGrowthOutboundIdentityContext } from "@/lib/growth/signatures/outbound-identity-context"
import type { GrowthOutboundIdentityContext } from "@/lib/growth/signatures/outbound-identity-types"
import { applyOutboundEmailTracking } from "@/lib/growth/tracking/tracking-links"
import { tryMaterializeCanonicalCopilotGeneration } from "@/lib/growth/aios/growth/growth-send-plane-1a-copilot-bridge"
import { loadOutreachSellerTruthForOrganization } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"

export type RunGrowthAiCopilotGenerationInput = {
  admin: SupabaseClient
  leadId: string
  generationType: GrowthAiCopilotGenerationType
  promptVariant?: GrowthAiCopilotPromptVariant | string
  sourceReplyId?: string | null
  snapshotOverrides?: Partial<GrowthAiCopilotInputSnapshot>
  actingUserId: string
  actingUserEmail: string
  senderAccountId?: string | null
  senderProfileId?: string | null
  sequencePatternStepId?: string | null
  sequencePatternId?: string | null
  organizationId?: string | null
  /** Supervised Ava execution-request fulfillment — reuse frozen operator-approved assets. */
  supervisedExecutionRequestFulfillment?: boolean
  executionRequestPackageId?: string | null
}

export type RunGrowthAiCopilotGenerationResult =
  | { ok: true; generation: GrowthAiCopilotGeneration; cached?: boolean }
  | { ok: false; code: string; message: string }

export async function runGrowthAiCopilotGeneration(
  input: RunGrowthAiCopilotGenerationInput,
): Promise<RunGrowthAiCopilotGenerationResult> {
  const actingUserId = normalizeGrowthActorUserIdForDb(input.actingUserId)
  if (input.actingUserId && !actingUserId) {
    logGrowthEngine("ai_copilot_generation_actor_invalid_uuid_normalized", {
      actingUserEmail: input.actingUserEmail,
      rawActingUserId: input.actingUserId,
    })
  }

  const settings = await fetchGrowthCopilotSettings(input.admin)
  if (!settings.aiCopilotEnabled) {
    return { ok: false, code: "copilot_disabled", message: "AI Copilot is disabled in platform settings." }
  }

  const provider = getGrowthAiProvider()
  const health = await provider.health()
  if (!health.ok) {
    return { ok: false, code: "ai_not_configured", message: health.message ?? "AI provider unavailable." }
  }

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, code: "lead_not_found", message: "Lead not found." }
  }

  const organizationId = input.organizationId ?? getGrowthEngineAiOrgId()
  const sellerTruth = organizationId
    ? await loadOutreachSellerTruthForOrganization(input.admin, {
        organizationId,
        preparedAt: new Date().toISOString(),
        prospectCompanyName: lead.companyName,
        leadId: lead.id,
      }).catch(() => null)
    : null
  const organizationKnowledge = sellerTruth
    ? buildGrowthAiCopilotOrganizationKnowledgeBlock(sellerTruth)
    : null

  const [rules, emailSummary] = await Promise.all([
    listGrowthAiCopilotRules(input.admin),
    fetchGrowthLeadEmailEventSummary(input.admin, input.leadId, lead.contactEmail),
  ])

  const ruleCheck = evaluateGrowthAiCopilotRules({
    lead,
    generationType: input.generationType,
    rules,
    emailSummary,
  })
  if (!ruleCheck.allowed) {
    return { ok: false, code: "rule_blocked", message: ruleCheck.reason ?? "Generation blocked by copilot rules." }
  }

  const promptVariant = input.promptVariant ?? settings.aiCopilotDefaultPromptVariant
  const outboundIdentity = await resolveGrowthOutboundIdentityContext(input.admin, {
    senderAccountId: input.senderAccountId,
    senderProfileId: input.senderProfileId,
    sequencePatternStepId: input.sequencePatternStepId,
    sequencePatternId: input.sequencePatternId,
    organizationId: input.organizationId,
  })
  const snapshot = {
    ...(await buildGrowthAiCopilotInput(input.admin, lead, {
      sourceReplyId: input.sourceReplyId,
    })),
    ...(outboundIdentity ? { outboundIdentity: serializeOutboundIdentityForSnapshot(outboundIdentity) } : {}),
    ...(input.snapshotOverrides ?? {}),
  }
  const inputHash = growthAiCopilotInputHash({
    generationType: input.generationType,
    promptVariant,
    snapshot,
  })

  const leadIndustryTags = await resolveOutreachLeadIndustryTags(input.admin, lead)

  const playbookResolution =
    settings.aiCopilotPlaybookEnabled
      ? await resolveGrowthAiCopilotPlaybookRules(input.admin, {
          generationType: input.generationType,
          maxRules: settings.aiCopilotPlaybookMaxRulesPerGeneration,
          leadIndustryTags,
        })
      : { rules: [], conflicts: [] }

  const playbookInfluenceScore = computePlaybookInfluenceScore(playbookResolution.rules)
  const playbookAttribution = buildPlaybookAttribution({
    rules: playbookResolution.rules,
    conflicts: playbookResolution.conflicts,
  })

  const canonicalGeneration = await tryMaterializeCanonicalCopilotGeneration({
    admin: input.admin,
    request: input,
    actingUserId,
    storeGenerations: settings.aiCopilotStoreGenerations,
    promptVariant,
    snapshot,
  })
  if (canonicalGeneration) {
    return canonicalGeneration
  }

  const useOutreachPersonalization =
    settings.outreachPersonalizationEnabled && isOutreachPersonalizationEmailType(input.generationType)

  if (useOutreachPersonalization) {
    const personalized = await runOutreachPersonalizationGeneration(input.admin, {
      lead,
      generationType: input.generationType,
      actingUserId: input.actingUserId,
      maxWords: settings.outreachPersonalizationMaxWords,
      aiRefinementEnabled: settings.aiCopilotEnabled,
      playbookRules: playbookResolution.rules,
      outboundIdentity,
    })

    const mapped = {
      generatedSubject: personalized.subject,
      generatedContent: personalized.content,
      classification: {
        confidence: personalized.audit.confidenceScore / 100,
        personalization: personalized.audit,
        performanceAttribution: buildOutreachPerformanceAttributionRecord({
          audit: personalized.audit,
          leadId: lead.id,
        }),
      },
    }

    const promptVersion = OUTREACH_PERSONALIZATION_STRATEGY_VERSION
    const personalizedInputHash = growthAiCopilotInputHash({
      generationType: input.generationType,
      promptVariant,
      snapshot: {
        ...snapshot,
        personalizationStrategyVersion: promptVersion,
        personalizationVariationKey: personalized.audit.variationKey,
      },
    })

    if (!settings.aiCopilotStoreGenerations) {
      const ephemeral: GrowthAiCopilotGeneration = {
        id: "ephemeral",
        leadId: lead.id,
        generationType: input.generationType,
        promptVersion,
        promptVariant,
        inputSnapshot: snapshot,
        generatedContent: mapped.generatedContent,
        generatedSubject: mapped.generatedSubject,
        classification: mapped.classification,
        status: "draft",
        sourceReplyId: input.sourceReplyId ?? null,
        inputHash: personalizedInputHash,
        playbookInfluenceScore,
        playbookAttribution,
        approvedAt: null,
        approvedBy: null,
        sentAt: null,
        createdBy: actingUserId,
        createdAt: new Date().toISOString(),
      }
    return { ok: true, generation: ephemeral }
  }

  const generation = await insertGrowthAiCopilotGeneration(input.admin, {
    leadId: lead.id,
    generationType: input.generationType,
    promptVersion,
    promptVariant,
    inputSnapshot: snapshot,
    generatedContent: mapped.generatedContent,
    generatedSubject: mapped.generatedSubject,
    classification: mapped.classification,
    sourceReplyId: input.sourceReplyId ?? null,
    inputHash: personalizedInputHash,
    playbookInfluenceScore,
    playbookAttribution,
    createdBy: actingUserId,
  })

  if (playbookResolution.rules.length > 0) {
    await linkGrowthAiCopilotGenerationPlaybookRules(input.admin, {
      generationId: generation.id,
      rules: playbookResolution.rules,
    })

    for (const rule of playbookResolution.rules) {
      await insertGrowthAiCopilotPlaybookEffectiveness(input.admin, {
        approvedRuleId: rule.id,
        sourceId: rule.sourceId,
        generationId: generation.id,
        leadId: lead.id,
        outcome: "applied",
        category: rule.category,
        playbookInfluenceScore,
        effectivenessScore: Math.min(100, rule.priority + 10),
        metadata: { generationType: generation.generationType, outreachPersonalization: true },
      })
    }
  }

  if (playbookResolution.conflicts.length > 0) {
    await insertGrowthAiCopilotPlaybookEffectiveness(input.admin, {
      generationId: generation.id,
      leadId: lead.id,
      outcome: "conflict_detected",
      playbookInfluenceScore,
      effectivenessScore: 0,
      metadata: { conflicts: playbookResolution.conflicts, outreachPersonalization: true },
    })

    await emitGrowthLeadPlaybookConflictDetectedTimeline(input.admin, {
      leadId: lead.id,
      generationId: generation.id,
      summary: `${playbookResolution.conflicts.length} playbook conflict(s) detected during outreach generation`,
      conflicts: playbookResolution.conflicts,
      actor: { userId: input.actingUserId, email: input.actingUserEmail },
    })
  }

    const performanceAttribution = await persistOutreachPerformanceAttribution(input.admin, {
      generationId: generation.id,
      leadId: lead.id,
      audit: personalized.audit,
      recordedAt: generation.createdAt,
    })

    generation.classification = {
      ...generation.classification,
      performanceAttribution,
    }

    await insertGrowthAiCopilotEffectiveness(input.admin, {
      generationId: generation.id,
      leadId: lead.id,
      generationType: generation.generationType,
      promptVariant: generation.promptVariant,
      promptVersion: generation.promptVersion,
      outcome: "generated",
      classificationPrimary: generation.classification.primary ?? null,
      effectivenessScore: computeGrowthAiCopilotEffectivenessScore({
        outcome: "generated",
        classificationConfidence: generation.classification.confidence,
      }),
      metadata: {
        personalization: true,
        confidenceScore: personalized.audit.confidenceScore,
        variationKey: personalized.audit.variationKey,
      },
    })

    await emitGrowthLeadAiCopilotGenerationCreatedTimeline(input.admin, {
      leadId: lead.id,
      generationId: generation.id,
      generationType: generation.generationType,
      summary: generation.generatedSubject ?? generation.generationType.replace(/_/g, " "),
      actor: { userId: actingUserId ?? input.actingUserId, email: input.actingUserEmail },
    })

    logGrowthEngine("ai_copilot_personalized_generation_created", {
      leadId: lead.id,
      generationId: generation.id,
      generationType: generation.generationType,
      confidenceScore: personalized.audit.confidenceScore,
      variationKey: personalized.audit.variationKey,
    })

    return { ok: true, generation }
  }

  const systemPrompt = buildGrowthAiCopilotSystemPrompt(
    input.generationType,
    promptVariant,
    playbookResolution.rules,
    outboundIdentity,
    organizationKnowledge,
  )
  const industryContextBase = await buildOutreachIndustryContextForLead(input.admin, lead)
  const reasoningChannel: GrowthReasoningChannel = input.generationType.startsWith("call_")
    ? "VOICE"
    : "COPILOT"
  const reasoningDiagnostics = buildGrowthReasoningDiagnosticsFromIndustryInput({
    channel: reasoningChannel,
    industryContext: industryContextBase,
    companyName: lead.companyName,
    contactName: lead.contactName,
    researchPainPoints: snapshot.researchSummary ? [snapshot.researchSummary] : [],
    priorTouchCount: snapshot.recentOutbound?.length ?? 0,
    engagementScore: snapshot.growthSignalScore ?? null,
  })
  const sequenceIntelligenceContext = buildGrowthSequenceIntelligenceFromIndustryInput({
    priorTouchCount: snapshot.recentOutbound?.length ?? 0,
    priorOutboundSubjects: snapshot.recentOutbound?.map((entry) => entry.subject ?? "").filter(Boolean),
    engagementScore: snapshot.growthSignalScore ?? null,
    industryContext: industryContextBase,
  })
  const industryContext = {
    ...industryContextBase,
    sequenceIntelligenceContext,
    reasoningContext: { channel: reasoningChannel, diagnostics: reasoningDiagnostics },
  }
  const userPrompt = buildGrowthAiCopilotUserPrompt(input.generationType, snapshot, {
    industryContext,
    narrativeContext: industryContext.narrativeContext,
    outboundIdentity,
    organizationKnowledge,
  })

  const aiResult = await provider.generate({
    generationType: input.generationType,
    promptVariant,
    systemPrompt,
    userPrompt,
    actingUserId: input.actingUserId,
  })

  const parsed = growthAiCopilotModelSchema.parse(aiResult.output)
  const mapped = mapGrowthAiCopilotModelOutput(parsed, input.generationType)

  if (!settings.aiCopilotStoreGenerations) {
    const ephemeral: GrowthAiCopilotGeneration = {
      id: "ephemeral",
      leadId: lead.id,
      generationType: input.generationType,
      promptVersion: GROWTH_AI_COPILOT_PROMPT_VERSION,
      promptVariant,
      inputSnapshot: snapshot,
      generatedContent: mapped.generatedContent,
      generatedSubject: mapped.generatedSubject,
      classification: mapped.classification,
      status: "draft",
      sourceReplyId: input.sourceReplyId ?? null,
      inputHash,
      playbookInfluenceScore,
      playbookAttribution,
      approvedAt: null,
      approvedBy: null,
      sentAt: null,
      createdBy: actingUserId,
      createdAt: new Date().toISOString(),
    }
    return { ok: true, generation: ephemeral }
  }

  const generation = await insertGrowthAiCopilotGeneration(input.admin, {
    leadId: lead.id,
    generationType: input.generationType,
    promptVersion: GROWTH_AI_COPILOT_PROMPT_VERSION,
    promptVariant,
    inputSnapshot: snapshot,
    generatedContent: mapped.generatedContent,
    generatedSubject: mapped.generatedSubject,
    classification: mapped.classification,
    sourceReplyId: input.sourceReplyId ?? null,
    inputHash,
    playbookInfluenceScore,
    playbookAttribution,
    createdBy: actingUserId,
  })

  if (playbookResolution.rules.length > 0) {
    await linkGrowthAiCopilotGenerationPlaybookRules(input.admin, {
      generationId: generation.id,
      rules: playbookResolution.rules,
    })

    for (const rule of playbookResolution.rules) {
      await insertGrowthAiCopilotPlaybookEffectiveness(input.admin, {
        approvedRuleId: rule.id,
        sourceId: rule.sourceId,
        generationId: generation.id,
        leadId: lead.id,
        outcome: "applied",
        category: rule.category,
        playbookInfluenceScore,
        effectivenessScore: Math.min(100, rule.priority + 10),
        metadata: { generationType: generation.generationType },
      })
    }
  }

  if (playbookResolution.conflicts.length > 0) {
    await insertGrowthAiCopilotPlaybookEffectiveness(input.admin, {
      generationId: generation.id,
      leadId: lead.id,
      outcome: "conflict_detected",
      playbookInfluenceScore,
      effectivenessScore: 0,
      metadata: { conflicts: playbookResolution.conflicts },
    })

    await emitGrowthLeadPlaybookConflictDetectedTimeline(input.admin, {
      leadId: lead.id,
      generationId: generation.id,
      summary: `${playbookResolution.conflicts.length} playbook conflict(s) detected during generation`,
      conflicts: playbookResolution.conflicts,
      actor: { userId: input.actingUserId, email: input.actingUserEmail },
    })
  }

  await insertGrowthAiCopilotEffectiveness(input.admin, {
    generationId: generation.id,
    leadId: lead.id,
    generationType: generation.generationType,
    promptVariant: generation.promptVariant,
    promptVersion: generation.promptVersion,
    outcome: "generated",
    classificationPrimary: generation.classification.primary ?? null,
    effectivenessScore: computeGrowthAiCopilotEffectivenessScore({
      outcome: "generated",
      classificationConfidence: generation.classification.confidence,
    }),
    metadata: {
      provider: aiResult.provider,
      model: aiResult.model,
      estimatedCostUsd: aiResult.usage.estimatedCostUsd,
    },
  })

  await emitGrowthLeadAiCopilotGenerationCreatedTimeline(input.admin, {
    leadId: lead.id,
    generationId: generation.id,
    generationType: generation.generationType,
    summary: generation.generatedSubject ?? generation.generationType.replace(/_/g, " "),
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  logGrowthEngine("ai_copilot_generation_created", {
    leadId: lead.id,
    generationId: generation.id,
    generationType: generation.generationType,
    promptVariant,
    provider: aiResult.provider,
  })

  return { ok: true, generation }
}

export async function approveGrowthAiCopilotGeneration(
  admin: SupabaseClient,
  input: {
    generationId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthAiCopilotGeneration | null> {
  const { fetchGrowthAiCopilotGenerationById, updateGrowthAiCopilotGenerationStatus } = await import(
    "@/lib/growth/ai-copilot-repository"
  )
  const existing = await fetchGrowthAiCopilotGenerationById(admin, input.generationId)
  if (!existing || existing.status !== "draft") return existing

  const updated = await updateGrowthAiCopilotGenerationStatus(admin, input.generationId, {
    status: "approved",
    approvedBy: input.actingUserId,
  })

  await insertGrowthAiCopilotEffectiveness(admin, {
    generationId: updated.id,
    leadId: updated.leadId,
    generationType: updated.generationType,
    promptVariant: updated.promptVariant,
    promptVersion: updated.promptVersion,
    outcome: "approved",
    classificationPrimary: updated.classification.primary ?? null,
    effectivenessScore: computeGrowthAiCopilotEffectivenessScore({
      outcome: "approved",
      classificationConfidence: updated.classification.confidence,
    }),
  })

  await emitGrowthLeadAiCopilotGenerationApprovedTimeline(admin, {
    leadId: updated.leadId,
    generationId: updated.id,
    generationType: updated.generationType,
    summary: updated.generatedSubject ?? "Approved draft",
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  return updated
}

export async function discardGrowthAiCopilotGeneration(
  admin: SupabaseClient,
  generationId: string,
): Promise<GrowthAiCopilotGeneration | null> {
  const { fetchGrowthAiCopilotGenerationById, updateGrowthAiCopilotGenerationStatus } = await import(
    "@/lib/growth/ai-copilot-repository"
  )
  const existing = await fetchGrowthAiCopilotGenerationById(admin, generationId)
  if (!existing || existing.status !== "draft") return existing

  const updated = await updateGrowthAiCopilotGenerationStatus(admin, generationId, { status: "discarded" })

  await insertGrowthAiCopilotEffectiveness(admin, {
    generationId: updated.id,
    leadId: updated.leadId,
    generationType: updated.generationType,
    promptVariant: updated.promptVariant,
    promptVersion: updated.promptVersion,
    outcome: "discarded",
    classificationPrimary: updated.classification.primary ?? null,
    effectivenessScore: computeGrowthAiCopilotEffectivenessScore({ outcome: "discarded" }),
  })

  return updated
}

function serializeOutboundIdentityForSnapshot(
  identity: GrowthOutboundIdentityContext,
): GrowthAiCopilotInputSnapshot["outboundIdentity"] {
  return {
    senderAccountId: identity.senderAccountId,
    senderProfileId: identity.senderProfileId,
    displayName: identity.displayName,
    title: identity.title,
    company: identity.company,
    website: identity.website,
    email: identity.email,
    personaKey: identity.personaKey,
    personaInstructions: identity.personaInstructions,
  }
}

const AI_COPILOT_UNSUBSCRIBE_FOOTER =
  '<p style="font-size:12px;color:#666;margin-top:24px;">{{unsubscribe_link}} — Reply STOP to unsubscribe.</p>'

/**
 * Prepares AI copilot outbound email bodies with sender merge fields and signature injection.
 * Used by transport send paths for approved AI-generated email content.
 */
export async function prepareGrowthAiCopilotOutboundEmailContent(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    mailboxConnectionId?: string | null
    subject: string
    body: string
    deliveryAttemptId?: string | null
  },
): Promise<{
  subject: string
  html: string
  text: string
  signatureInjected: boolean
  mergeFields: Record<string, string>
}> {
  const prepared = await prepareOutboundEmailContent(admin, {
    senderAccountId: input.senderAccountId,
    mailboxConnectionId: input.mailboxConnectionId,
    subject: input.subject,
    bodyText: input.body,
    unsubscribeFooterHtml: AI_COPILOT_UNSUBSCRIBE_FOOTER,
    unsubscribeTextSuffix: "Reply STOP to unsubscribe.",
  })

  let html = prepared.htmlBody
  if (input.deliveryAttemptId && process.env.GROWTH_TRACKING_DISABLED?.trim() !== "true") {
    html =
      applyOutboundEmailTracking({
        html,
        deliveryAttemptId: input.deliveryAttemptId,
      }).html ?? html
  }

  return {
    subject: prepared.subject,
    html,
    text: prepared.textBody,
    signatureInjected: prepared.signatureInjected,
    mergeFields: prepared.mergeFields,
  }
}
