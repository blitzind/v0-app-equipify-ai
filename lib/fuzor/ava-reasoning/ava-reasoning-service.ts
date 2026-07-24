/**
 * FUZOR Ava Reasoning — reusable Layer 3 service.
 * Accepts generic deployment context. No Equipify-specific imports.
 */

import "server-only"

import { runAiTask } from "@/lib/ai/server"
import {
  AVA_REASONING_JSON_CONTRACT,
  avaReasoningResultSchema,
  enforceAvaReasoningEmailPolicy,
  normalizeAvaReasoningResult,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-schema"
import {
  buildAvaReasoningSystemPrompt,
  buildAvaReasoningUserPrompt,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-prompts"
import {
  AVA_CI_INTEGRATION_1A_QA_MARKER,
  AVA_REASONING_GENERATION_MODE,
  AVA_REASONING_MODEL,
  AVA_REASONING_PROMPT_VERSION,
  type RunAvaReasoningInput,
  type RunAvaReasoningOutput,
} from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

export type RunAvaReasoningResult =
  | { ok: true; output: RunAvaReasoningOutput }
  | {
      ok: false
      code: "owner_organization_required" | "objective_required" | "model_failed" | "hard_rule_blocked"
      message: string
    }

async function defaultRunModel(input: {
  organizationId: string
  actingUserEmail: string
  systemPrompt: string
  userPrompt: string
}): Promise<{
  result: ReturnType<typeof normalizeAvaReasoningResult>
  provider: string | null
  model: string | null
  attempts: number
  durationMs: number
  promptTokens: number | null
  completionTokens: number | null
}> {
  let lastError: string | null = null
  const started = Date.now()

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const ai = await runAiTask({
      task: "growth_copilot_generation",
      organizationId: input.organizationId,
      actingUserEmail: input.actingUserEmail,
      input: {
        system: input.systemPrompt,
        user: input.userPrompt,
      },
      schema: avaReasoningResultSchema,
      cacheSchemaVersion: `${AVA_REASONING_PROMPT_VERSION}_attempt_${attempt}`,
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
        timeoutMs: 180_000,
        maxRetries: 1,
      },
    })

    if (!ai.ok) {
      lastError = ai.error?.message ?? "Model call failed."
      continue
    }

    const parsed = avaReasoningResultSchema.safeParse(ai.output)
    if (!parsed.success) {
      lastError = "Structured output failed schema validation."
      continue
    }

    return {
      result: enforceAvaReasoningEmailPolicy(normalizeAvaReasoningResult(parsed.data)),
      provider: ai.meta.provider ?? null,
      model: ai.meta.model ?? null,
      attempts: attempt + 1,
      durationMs: Date.now() - started,
      promptTokens: ai.usage?.promptTokens ?? null,
      completionTokens: ai.usage?.completionTokens ?? null,
    }
  }

  throw new Error(lastError ?? "Model call failed after retry.")
}

/**
 * Canonical reusable Ava reasoning entry.
 * Deployment adapters assemble inputs; this service performs judgment only.
 */
export async function runAvaReasoning(
  input: RunAvaReasoningInput,
): Promise<RunAvaReasoningResult> {
  const ownerOrganizationId = input.ownerOrganizationId?.trim()
  if (!ownerOrganizationId) {
    return {
      ok: false,
      code: "owner_organization_required",
      message: "ownerOrganizationId is required.",
    }
  }

  const objective = input.objective?.trim()
  if (!objective) {
    return {
      ok: false,
      code: "objective_required",
      message: "Deployment objective is required.",
    }
  }

  if (input.hardRuleState.optOutBlocked || input.hardRuleState.suppressed) {
    return {
      ok: false,
      code: "hard_rule_blocked",
      message: "Hard business rules block reasoning for this prospect (opt-out or suppression).",
    }
  }

  // Defense: never allow Equipify-named facts to be required by this module —
  // organization knowledge is opaque deployment input.
  const runModel = input.runModel ?? defaultRunModel

  let modelOut: Awaited<ReturnType<typeof defaultRunModel>>
  try {
    modelOut = await runModel({
      organizationId: ownerOrganizationId,
      actingUserEmail: input.actingUserEmail,
      systemPrompt: buildAvaReasoningSystemPrompt(input.roleKnowledge),
      userPrompt: `${buildAvaReasoningUserPrompt({ ...input, ownerOrganizationId, objective })}\n\n${AVA_REASONING_JSON_CONTRACT}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model call failed."
    return { ok: false, code: "model_failed", message }
  }

  const result = enforceAvaReasoningEmailPolicy(modelOut.result)

  return {
    ok: true,
    output: {
      qaMarker: AVA_CI_INTEGRATION_1A_QA_MARKER,
      generationMode: AVA_REASONING_GENERATION_MODE,
      ownerOrganizationId,
      aiDeploymentId: input.aiDeploymentId ?? null,
      companyName: input.companyIntelligence.companyName,
      companyIntelligenceVersionId: input.companyIntelligence.companyIntelligenceVersionId,
      evidenceFingerprint: input.companyIntelligence.evidenceFingerprint,
      organizationKnowledgeSource: input.organizationKnowledge.source,
      organizationKnowledgeVersionId: input.organizationKnowledge.versionId,
      objective,
      contactsSupplied: input.contacts,
      result,
      provider: modelOut.provider,
      model: modelOut.model,
      modelAttempts: modelOut.attempts,
      durationMs: modelOut.durationMs,
      promptTokens: modelOut.promptTokens,
      completionTokens: modelOut.completionTokens,
      outboundSendAuthorized: false,
      persistenceStatus: input.hardRuleState.persistenceEnabled ? "not_requested" : "disabled",
    },
  }
}
