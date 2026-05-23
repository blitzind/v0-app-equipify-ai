import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
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
  type GrowthAiCopilotPromptVariant,
} from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
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

export type RunGrowthAiCopilotGenerationInput = {
  admin: SupabaseClient
  leadId: string
  generationType: GrowthAiCopilotGenerationType
  promptVariant?: GrowthAiCopilotPromptVariant | string
  sourceReplyId?: string | null
  actingUserId: string
  actingUserEmail: string
}

export type RunGrowthAiCopilotGenerationResult =
  | { ok: true; generation: GrowthAiCopilotGeneration; cached?: boolean }
  | { ok: false; code: string; message: string }

export async function runGrowthAiCopilotGeneration(
  input: RunGrowthAiCopilotGenerationInput,
): Promise<RunGrowthAiCopilotGenerationResult> {
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
  const snapshot = await buildGrowthAiCopilotInput(input.admin, lead, {
    sourceReplyId: input.sourceReplyId,
  })
  const inputHash = growthAiCopilotInputHash({
    generationType: input.generationType,
    promptVariant,
    snapshot,
  })

  const playbookResolution =
    settings.aiCopilotPlaybookEnabled
      ? await resolveGrowthAiCopilotPlaybookRules(input.admin, {
          generationType: input.generationType,
          maxRules: settings.aiCopilotPlaybookMaxRulesPerGeneration,
          leadIndustryTags: [],
        })
      : { rules: [], conflicts: [] }

  const playbookInfluenceScore = computePlaybookInfluenceScore(playbookResolution.rules)
  const playbookAttribution = buildPlaybookAttribution({
    rules: playbookResolution.rules,
    conflicts: playbookResolution.conflicts,
  })

  const systemPrompt = buildGrowthAiCopilotSystemPrompt(
    input.generationType,
    promptVariant,
    playbookResolution.rules,
  )
  const userPrompt = buildGrowthAiCopilotUserPrompt(input.generationType, snapshot)

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
      createdBy: input.actingUserId,
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
    createdBy: input.actingUserId,
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
