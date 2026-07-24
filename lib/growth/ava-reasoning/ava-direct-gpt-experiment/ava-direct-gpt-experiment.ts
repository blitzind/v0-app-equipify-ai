/**
 * AVA-DIRECT-GPT-1A — Website → Ava single-pass experiment.
 * Does NOT modify production Ava or Company Intelligence paths.
 */

import "server-only"

import { runAiTask } from "@/lib/ai/server"
import {
  AVA_DIRECT_GPT_1A_QA_MARKER,
  AVA_DIRECT_GPT_JSON_CONTRACT,
  avaDirectGptResultSchema,
  normalizeAvaDirectGptResult,
  type AvaDirectGptResult,
} from "@/lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-schema"
import {
  buildAvaDirectGptSystemPrompt,
  buildAvaDirectGptUserPrompt,
} from "@/lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-prompts"
import type {
  AvaContactEvidence,
  AvaOrganizationKnowledge,
  AvaRoleKnowledge,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"
import { AVA_REASONING_MODEL } from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

export type RunAvaDirectGptExperimentInput = {
  companyName: string
  website: string | null
  websiteText: string
  organizationId: string
  actingUserEmail?: string | null
  roleKnowledge: AvaRoleKnowledge
  objective: string
  organizationKnowledge: AvaOrganizationKnowledge
  contacts: AvaContactEvidence[]
}

export type RunAvaDirectGptExperimentResult =
  | {
      ok: true
      output: AvaDirectGptResult
      provider: string | null
      model: string | null
      durationMs: number
      promptTokens: number | null
      completionTokens: number | null
    }
  | { ok: false; code: "model_failed"; message: string; durationMs: number }

export async function runAvaDirectGptExperiment(
  input: RunAvaDirectGptExperimentInput,
): Promise<RunAvaDirectGptExperimentResult> {
  const started = Date.now()
  const systemPrompt = buildAvaDirectGptSystemPrompt(input.roleKnowledge)
  const userPrompt = `${buildAvaDirectGptUserPrompt({
    companyName: input.companyName,
    website: input.website,
    websiteText: input.websiteText,
    roleKnowledge: input.roleKnowledge,
    objective: input.objective,
    organizationKnowledge: input.organizationKnowledge,
    contacts: input.contacts,
  })}\n\n${AVA_DIRECT_GPT_JSON_CONTRACT}`

  const ai = await runAiTask({
    task: "growth_copilot_generation",
    organizationId: input.organizationId,
    actingUserEmail: input.actingUserEmail ?? null,
    input: { system: systemPrompt, user: userPrompt },
    schema: avaDirectGptResultSchema,
    cacheSchemaVersion: AVA_DIRECT_GPT_1A_QA_MARKER,
    skipPlanGateCheck: true,
    skipBudgetCheck: true,
    skipCache: true,
    skipExecutionModeMock: true,
    forceLiveAi: true,
    taskOverrides: {
      structuredMode: "json_object",
      primaryModel: { provider: "openai", model: AVA_REASONING_MODEL },
      fallbackModel: { provider: "openai", model: AVA_REASONING_MODEL },
      escalationModel: { provider: "openai", model: AVA_REASONING_MODEL },
      maxOutputTokens: 4096,
      timeoutMs: 120_000,
      maxRetries: 0,
    },
  })

  const durationMs = Date.now() - started

  if (!ai.ok) {
    return {
      ok: false,
      code: "model_failed",
      message: ai.error?.message ?? "Model call failed.",
      durationMs,
    }
  }

  const parsed = avaDirectGptResultSchema.safeParse(ai.output)
  if (!parsed.success) {
    return {
      ok: false,
      code: "model_failed",
      message: "Structured output failed schema validation.",
      durationMs,
    }
  }

  return {
    ok: true,
    output: normalizeAvaDirectGptResult(parsed.data),
    provider: ai.meta.provider ?? null,
    model: ai.meta.model ?? null,
    durationMs,
    promptTokens: ai.usage?.promptTokens ?? null,
    completionTokens: ai.usage?.completionTokens ?? null,
  }
}
