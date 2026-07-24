/**
 * FUZOR-COMPANY-INTELLIGENCE-1A — Gather evidence → GPT-5.5 business understanding.
 * Reusable across AI employees. No Equipify / ICP / outbound side effects.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import {
  gatherFuzorCompanyIntelligenceEvidence,
  type GatherFuzorCompanyIntelligenceEvidenceResult,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-gatherer"
import {
  buildFuzorCompanyIntelligenceSystemPrompt,
  buildFuzorCompanyIntelligenceUserPrompt,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-prompts"
import {
  FUZOR_COMPANY_INTELLIGENCE_JSON_CONTRACT,
  fuzorCompanyBusinessUnderstandingSchema,
  normalizeFuzorCompanyBusinessUnderstanding,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-schema"
import {
  FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER,
  FUZOR_COMPANY_INTELLIGENCE_GENERATION_MODE,
  FUZOR_COMPANY_INTELLIGENCE_MODEL,
  FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION,
  type FuzorCompanyBusinessUnderstanding,
  type FuzorCompanyIntelligenceEvidencePacket,
  type FuzorCompanyIntelligenceRunOutput,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

export type FuzorCompanyIntelligenceModelRunner = (input: {
  organizationId: string
  systemPrompt: string
  userPrompt: string
}) => Promise<{
  understanding: FuzorCompanyBusinessUnderstanding
  provider: string | null
  model: string | null
  attempts?: number
  promptTokens?: number | null
  completionTokens?: number | null
}>

export type FuzorCompanyIntelligenceEvidenceGatherer = (input: {
  admin: SupabaseClient
  leadId: string
  organizationId?: string | null
}) => Promise<GatherFuzorCompanyIntelligenceEvidenceResult>

export type RunFuzorCompanyIntelligenceInput = {
  admin: SupabaseClient
  leadId: string
  organizationId?: string | null
  actingUserEmail?: string | null
  gatherEvidence?: FuzorCompanyIntelligenceEvidenceGatherer
  runModel?: FuzorCompanyIntelligenceModelRunner
}

export type RunFuzorCompanyIntelligenceResult =
  | { ok: true; output: FuzorCompanyIntelligenceRunOutput }
  | {
      ok: false
      code: "lead_not_found" | "organization_unavailable" | "model_failed"
      message: string
    }

async function defaultRunModel(input: {
  organizationId: string
  actingUserEmail: string | null
  systemPrompt: string
  userPrompt: string
}): Promise<{
  understanding: FuzorCompanyBusinessUnderstanding
  provider: string | null
  model: string | null
  attempts: number
  promptTokens: number | null
  completionTokens: number | null
}> {
  let lastError: string | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const ai = await runAiTask({
      task: "growth_copilot_generation",
      organizationId: input.organizationId,
      actingUserEmail: input.actingUserEmail,
      input: {
        system: input.systemPrompt,
        user: input.userPrompt,
      },
      schema: fuzorCompanyBusinessUnderstandingSchema,
      cacheSchemaVersion: `${FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION}_attempt_${attempt}`,
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      skipCache: true,
      skipExecutionModeMock: true,
      forceLiveAi: true,
      taskOverrides: {
        structuredMode: "json_object",
        primaryModel: { provider: "openai", model: FUZOR_COMPANY_INTELLIGENCE_MODEL },
        fallbackModel: { provider: "openai", model: FUZOR_COMPANY_INTELLIGENCE_MODEL },
        escalationModel: { provider: "openai", model: FUZOR_COMPANY_INTELLIGENCE_MODEL },
        maxOutputTokens: 8192,
        timeoutMs: 180_000,
        maxRetries: 1,
      },
    })

    if (!ai.ok) {
      lastError = ai.error?.message ?? "Model call failed."
      continue
    }

    const parsed = fuzorCompanyBusinessUnderstandingSchema.safeParse(ai.output)
    if (!parsed.success) {
      lastError = "Structured output failed schema validation."
      continue
    }

    return {
      understanding: normalizeFuzorCompanyBusinessUnderstanding(parsed.data),
      provider: ai.meta.provider ?? null,
      model: ai.meta.model ?? null,
      attempts: attempt + 1,
      promptTokens: ai.usage?.promptTokens ?? null,
      completionTokens: ai.usage?.completionTokens ?? null,
    }
  }

  throw new Error(lastError ?? "Model call failed after retry.")
}

export async function runFuzorCompanyIntelligence(
  input: RunFuzorCompanyIntelligenceInput,
): Promise<RunFuzorCompanyIntelligenceResult> {
  const started = Date.now()
  const organizationId = input.organizationId ?? getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      code: "organization_unavailable",
      message: "GROWTH_ENGINE_AI_ORG_ID is not configured.",
    }
  }

  const gather = input.gatherEvidence ?? gatherFuzorCompanyIntelligenceEvidence
  const gathered = await gather({
    admin: input.admin,
    leadId: input.leadId,
    organizationId,
  })

  if (!gathered.ok) {
    return { ok: false, code: gathered.code, message: gathered.message }
  }

  const packet: FuzorCompanyIntelligenceEvidencePacket = gathered.packet
  const runModel = input.runModel ?? ((args) =>
    defaultRunModel({
      ...args,
      actingUserEmail: input.actingUserEmail ?? null,
    }))

  let modelOut: {
    understanding: FuzorCompanyBusinessUnderstanding
    provider: string | null
    model: string | null
    attempts?: number
    promptTokens?: number | null
    completionTokens?: number | null
  }

  try {
    modelOut = await runModel({
      organizationId,
      systemPrompt: buildFuzorCompanyIntelligenceSystemPrompt(),
      userPrompt: `${buildFuzorCompanyIntelligenceUserPrompt(packet)}\n\n${FUZOR_COMPANY_INTELLIGENCE_JSON_CONTRACT}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model call failed."
    logGrowthEngine("fuzor_company_intelligence_model_failed", {
      leadId: input.leadId,
      message,
    })
    return { ok: false, code: "model_failed", message }
  }

  const output: FuzorCompanyIntelligenceRunOutput = {
    qaMarker: FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER,
    generationMode: FUZOR_COMPANY_INTELLIGENCE_GENERATION_MODE,
    leadId: input.leadId,
    companyName: packet.companyName,
    website: packet.website,
    evidencePacket: packet,
    understanding: modelOut.understanding,
    provider: modelOut.provider,
    model: modelOut.model,
    modelAttempts: modelOut.attempts ?? 1,
    durationMs: Date.now() - started,
    promptTokens: modelOut.promptTokens ?? null,
    completionTokens: modelOut.completionTokens ?? null,
  }

  logGrowthEngine("fuzor_company_intelligence_completed", {
    leadId: input.leadId,
    companyName: packet.companyName,
    model: modelOut.model,
    evidenceWeakness: modelOut.understanding.evidenceWeakness,
  })

  return { ok: true, output }
}
