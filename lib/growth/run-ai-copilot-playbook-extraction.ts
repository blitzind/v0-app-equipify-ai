import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { getGrowthAiProvider } from "@/lib/growth/ai-copilot-provider"
import { fetchGrowthCopilotSettings } from "@/lib/growth/ai-copilot-repository"
import { detectPlaybookDraftConflicts } from "@/lib/growth/ai-copilot-playbook-conflicts"
import { runGrowthAiCopilotPlaybookExtractionTask } from "@/lib/growth/ai-copilot-playbook-provider"
import {
  fetchGrowthAiCopilotPlaybookSourceById,
  finalizeGrowthAiCopilotPlaybookExtraction,
  insertGrowthAiCopilotPlaybookDraftRules,
  insertGrowthAiCopilotPlaybookEffectiveness,
  insertGrowthAiCopilotPlaybookExtraction,
  updateGrowthAiCopilotPlaybookSourceStatus,
} from "@/lib/growth/ai-copilot-playbook-repository"
import { GROWTH_AI_COPILOT_PLAYBOOK_EXTRACTION_VERSION } from "@/lib/growth/ai-copilot-playbook-types"

export type RunGrowthAiCopilotPlaybookExtractionInput = {
  admin: SupabaseClient
  sourceId: string
  actingUserId: string
}

export type RunGrowthAiCopilotPlaybookExtractionResult =
  | {
      ok: true
      extractionId: string
      draftRuleCount: number
      conflictCount: number
    }
  | { ok: false; code: string; message: string }

export async function runGrowthAiCopilotPlaybookExtraction(
  input: RunGrowthAiCopilotPlaybookExtractionInput,
): Promise<RunGrowthAiCopilotPlaybookExtractionResult> {
  const settings = await fetchGrowthCopilotSettings(input.admin)
  if (!settings.aiCopilotPlaybookEnabled) {
    return { ok: false, code: "playbook_disabled", message: "Playbook training is disabled in copilot settings." }
  }

  const provider = getGrowthAiProvider()
  const health = await provider.health()
  if (!health.ok) {
    return { ok: false, code: "ai_not_configured", message: health.message ?? "AI provider unavailable." }
  }

  const source = await fetchGrowthAiCopilotPlaybookSourceById(input.admin, input.sourceId)
  if (!source) {
    return { ok: false, code: "source_not_found", message: "Playbook source not found." }
  }

  const content = source.rawContent?.trim()
  if (!content) {
    return {
      ok: false,
      code: "source_missing_content",
      message: "Source has no extractable content yet. Add transcript or notes first.",
    }
  }

  await updateGrowthAiCopilotPlaybookSourceStatus(input.admin, source.id, "extracting")

  const extraction = await insertGrowthAiCopilotPlaybookExtraction(input.admin, {
    sourceId: source.id,
    extractionVersion: GROWTH_AI_COPILOT_PLAYBOOK_EXTRACTION_VERSION,
    promptVariant: "default",
    inputSnapshot: {
      sourceTitle: source.title,
      sourceKind: source.sourceKind,
      contentLength: content.length,
      trainerProfile: source.trainerProfile,
      industryScope: source.industryScope,
    },
    createdBy: input.actingUserId,
  })

  try {
    const aiResult = await runGrowthAiCopilotPlaybookExtractionTask({
      source,
      content,
    })

    const draftRules = await insertGrowthAiCopilotPlaybookDraftRules(
      input.admin,
      aiResult.output.rules.map((rule) => ({
        extractionId: extraction.id,
        sourceId: source.id,
        category: rule.category,
        title: rule.title.trim(),
        principle: rule.principle.trim(),
        appliesTo: rule.appliesTo,
        priority: rule.priority,
        industryScope: rule.industryScope ?? source.industryScope,
        trainerProfile: rule.trainerProfile ?? source.trainerProfile,
      })),
    )

    const conflicts = detectPlaybookDraftConflicts(draftRules)

    await finalizeGrowthAiCopilotPlaybookExtraction(input.admin, extraction.id, {
      status: "succeeded",
      draftRuleCount: draftRules.length,
      conflictCount: conflicts.length,
      conflicts,
      modelProvider: aiResult.provider,
      modelName: aiResult.model,
    })

    await updateGrowthAiCopilotPlaybookSourceStatus(input.admin, source.id, "extracted")

    for (const draft of draftRules) {
      await insertGrowthAiCopilotPlaybookEffectiveness(input.admin, {
        sourceId: source.id,
        outcome: "extracted",
        category: draft.category,
        effectivenessScore: 50,
        metadata: { draftRuleId: draft.id, extractionId: extraction.id },
      })
    }

    if (conflicts.length > 0) {
      await insertGrowthAiCopilotPlaybookEffectiveness(input.admin, {
        sourceId: source.id,
        outcome: "conflict_detected",
        playbookInfluenceScore: 0,
        effectivenessScore: 0,
        metadata: { extractionId: extraction.id, conflicts },
      })
    }

    logGrowthEngine("ai_copilot_playbook_extraction_succeeded", {
      sourceId: source.id,
      extractionId: extraction.id,
      draftRuleCount: draftRules.length,
      conflictCount: conflicts.length,
    })

    return {
      ok: true,
      extractionId: extraction.id,
      draftRuleCount: draftRules.length,
      conflictCount: conflicts.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finalizeGrowthAiCopilotPlaybookExtraction(input.admin, extraction.id, {
      status: "failed",
      draftRuleCount: 0,
      conflictCount: 0,
      conflicts: [],
      errorMessage: message,
    })
    await updateGrowthAiCopilotPlaybookSourceStatus(input.admin, source.id, "failed")
    return { ok: false, code: "extraction_failed", message }
  }
}
