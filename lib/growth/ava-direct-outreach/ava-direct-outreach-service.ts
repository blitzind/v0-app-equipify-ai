/**
 * AVA-SIMPLE-OUTREACH-2A — One GPT-5.5 call: gather context → reason → optional email.
 * Bypasses personalization/rewrite chain. Does not send outbound.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { insertGrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-repository"
import { buildAvaDirectOutreachContext } from "@/lib/growth/ava-direct-outreach/ava-direct-outreach-context-builder"
import {
  buildAvaDirectOutreachSystemPrompt,
  buildAvaDirectOutreachUserPrompt,
} from "@/lib/growth/ava-direct-outreach/ava-direct-outreach-prompts"
import {
  AVA_DIRECT_OUTREACH_JSON_CONTRACT,
  avaDirectOutreachResultSchema,
  normalizeAvaDirectOutreachResult,
} from "@/lib/growth/ava-direct-outreach/ava-direct-outreach-schema"
import {
  AVA_DIRECT_OUTREACH_MODEL,
  AVA_DIRECT_OUTREACH_PROMPT_VERSION,
  AVA_DIRECT_REASONING_GENERATION_MODE,
  AVA_SIMPLE_OUTREACH_2A_QA_MARKER,
  type AvaDirectOutreachContext,
  type AvaDirectOutreachResult,
  type AvaDirectOutreachRunOutput,
} from "@/lib/growth/ava-direct-outreach/ava-direct-outreach-types"

export type AvaDirectOutreachModelRunner = (input: {
  organizationId: string
  actingUserEmail: string
  systemPrompt: string
  userPrompt: string
}) => Promise<{
  result: AvaDirectOutreachResult
  provider: string | null
  model: string | null
  attempts?: number
}>

export type AvaDirectOutreachContextBuilder = (input: {
  admin: SupabaseClient
  organizationId: string
  leadId: string
}) => Promise<
  | { ok: true; context: AvaDirectOutreachContext }
  | { ok: false; code: "lead_not_found" | "organization_unavailable"; message: string }
>

export type AvaDirectOutreachPersister = (input: {
  admin: SupabaseClient
  leadId: string
  actingUserId: string
  context: AvaDirectOutreachContext
  result: AvaDirectOutreachResult
  provider: string | null
  model: string | null
}) => Promise<{ id: string }>

export type RunAvaDirectOutreachInput = {
  admin: SupabaseClient
  leadId: string
  actingUserId: string
  actingUserEmail: string
  organizationId?: string | null
  /** When false, skip persistence (diagnostic). Default true. */
  persist?: boolean
  /** Test seam — replaces the live model call. */
  runModel?: AvaDirectOutreachModelRunner
  /** Test seam — replaces context assembly. */
  buildContext?: AvaDirectOutreachContextBuilder
  /** Test seam — replaces draft persistence. */
  persistDraft?: AvaDirectOutreachPersister
}

export type RunAvaDirectOutreachResult =
  | { ok: true; output: AvaDirectOutreachRunOutput }
  | {
      ok: false
      code:
        | "lead_not_found"
        | "organization_unavailable"
        | "model_failed"
        | "approved_draft_blocked"
        | "invalid_output"
      message: string
    }

async function defaultRunModel(input: {
  organizationId: string
  actingUserEmail: string
  systemPrompt: string
  userPrompt: string
}): Promise<{
  result: AvaDirectOutreachResult
  provider: string | null
  model: string | null
  attempts: number
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
      schema: avaDirectOutreachResultSchema,
      cacheSchemaVersion: `${AVA_DIRECT_OUTREACH_PROMPT_VERSION}_attempt_${attempt}`,
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      skipCache: true,
      // Production Growth org is often `trialing`; trial mock cannot satisfy this schema.
      skipExecutionModeMock: true,
      forceLiveAi: true,
      taskOverrides: {
        structuredMode: "json_object",
        primaryModel: { provider: "openai", model: AVA_DIRECT_OUTREACH_MODEL },
        fallbackModel: { provider: "openai", model: AVA_DIRECT_OUTREACH_MODEL },
        escalationModel: { provider: "openai", model: AVA_DIRECT_OUTREACH_MODEL },
        maxOutputTokens: 4096,
        timeoutMs: 180_000,
        maxRetries: 1,
      },
    })

    if (!ai.ok) {
      lastError = ai.error?.message ?? "Model call failed."
      continue
    }

    const parsed = avaDirectOutreachResultSchema.safeParse(ai.output)
    if (!parsed.success) {
      lastError = "Structured output failed schema validation."
      continue
    }

    return {
      result: normalizeAvaDirectOutreachResult(parsed.data),
      provider: ai.meta.provider ?? null,
      model: ai.meta.model ?? null,
      attempts: attempt + 1,
    }
  }

  throw new Error(lastError ?? "Model call failed after retry.")
}

function assertNoFabricatedEmail(result: AvaDirectOutreachResult): AvaDirectOutreachResult {
  if (result.decision !== "outreach") {
    return { ...result, email: null }
  }
  return result
}

export async function runAvaDirectOutreach(
  input: RunAvaDirectOutreachInput,
): Promise<RunAvaDirectOutreachResult> {
  const organizationId = input.organizationId ?? getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      code: "organization_unavailable",
      message: "GROWTH_ENGINE_AI_ORG_ID is not configured.",
    }
  }

  const buildContext = input.buildContext ?? buildAvaDirectOutreachContext
  const built = await buildContext({
    admin: input.admin,
    organizationId,
    leadId: input.leadId,
  })

  if (!built.ok) {
    return { ok: false, code: built.code, message: built.message }
  }

  const context = built.context

  const runModel = input.runModel ?? defaultRunModel

  let modelOut: {
    result: AvaDirectOutreachResult
    provider: string | null
    model: string | null
    attempts?: number
  }

  try {
    modelOut = await runModel({
      organizationId,
      actingUserEmail: input.actingUserEmail,
      systemPrompt: buildAvaDirectOutreachSystemPrompt(),
      userPrompt: `${buildAvaDirectOutreachUserPrompt(context)}\n\n${AVA_DIRECT_OUTREACH_JSON_CONTRACT}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model call failed."
    logGrowthEngine("ava_direct_outreach_model_failed", {
      leadId: input.leadId,
      message,
    })
    return { ok: false, code: "model_failed", message }
  }

  const result = assertNoFabricatedEmail(modelOut.result)
  const modelAttempts = modelOut.attempts ?? 1

  let persistedGenerationId: string | null = null
  if (input.persist !== false) {
    const persistDraft = input.persistDraft ?? persistDirectOutreachDraft
    const generation = await persistDraft({
      admin: input.admin,
      leadId: input.leadId,
      actingUserId: input.actingUserId,
      context,
      result,
      provider: modelOut.provider,
      model: modelOut.model,
    })
    persistedGenerationId = generation.id
  }

  const output: AvaDirectOutreachRunOutput = {
    qaMarker: AVA_SIMPLE_OUTREACH_2A_QA_MARKER,
    generationMode: AVA_DIRECT_REASONING_GENERATION_MODE,
    organizationId,
    leadId: input.leadId,
    companyName: context.company.name,
    contact: context.decisionMaker,
    context,
    result,
    provider: modelOut.provider,
    model: modelOut.model,
    modelAttempts,
    persistedGenerationId,
    outboundAuthorized: false,
  }

  logGrowthEngine("ava_direct_outreach_completed", {
    leadId: input.leadId,
    decision: result.decision,
    persistedGenerationId,
    model: modelOut.model,
  })

  return { ok: true, output }
}

async function persistDirectOutreachDraft(input: {
  admin: SupabaseClient
  leadId: string
  actingUserId: string
  context: AvaDirectOutreachContext
  result: AvaDirectOutreachResult
  provider: string | null
  model: string | null
}) {
  const content =
    input.result.email?.body?.trim() ||
    [
      `Ava direct decision: ${input.result.decision}`,
      input.result.fitSummary,
      "",
      "Supporting reasons:",
      ...input.result.supportingReasons.map((r) => `- ${r}`),
      "",
      "Concerns:",
      ...input.result.concerns.map((c) => `- ${c}`),
    ].join("\n")

  return insertGrowthAiCopilotGeneration(input.admin, {
    leadId: input.leadId,
    generationType: "cold_email",
    promptVersion: AVA_DIRECT_OUTREACH_PROMPT_VERSION,
    promptVariant: AVA_DIRECT_REASONING_GENERATION_MODE,
    inputSnapshot: {
      generationMode: AVA_DIRECT_REASONING_GENERATION_MODE,
      qaMarker: AVA_SIMPLE_OUTREACH_2A_QA_MARKER,
      context: input.context,
    },
    generatedContent: content,
    generatedSubject: input.result.email?.subject ?? null,
    classification: {
      primary: input.result.decision,
      confidence: input.result.confidence,
      generationMode: AVA_DIRECT_REASONING_GENERATION_MODE,
      fitSummary: input.result.fitSummary,
      supportingReasons: input.result.supportingReasons,
      concerns: input.result.concerns,
      recommendedContactRole: input.result.recommendedContactRole,
      salesAngle: input.result.salesAngle,
      evidenceUsed: input.result.evidenceUsed,
      missingInformation: input.result.missingInformation,
      provider: input.provider,
      model: input.model,
      outboundAuthorized: false,
    },
    createdBy: input.actingUserId,
  })
}

/** Pure helper for tests — enforces reject/needs_more_research never keep email. */
export function enforceDirectOutreachEmailPolicy(
  result: AvaDirectOutreachResult,
): AvaDirectOutreachResult {
  return assertNoFabricatedEmail(result)
}

export function parseAvaDirectOutreachModelJson(raw: unknown): AvaDirectOutreachResult {
  const parsed = avaDirectOutreachResultSchema.parse(raw)
  return assertNoFabricatedEmail(normalizeAvaDirectOutreachResult(parsed))
}

export const avaDirectOutreachParseProbeSchema = z.object({
  decision: z.enum(["outreach", "reject", "needs_more_research"]),
})
