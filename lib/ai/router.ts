import "server-only"

import { applyPrimaryModelRef } from "@/lib/ai/config"
import { getTaskDefinition } from "@/lib/ai/tasks"
import {
  extractMinConfidence,
  parseJsonSafe,
  parseWithSchemaSafe,
} from "@/lib/ai/structured"
import {
  canonicalizeMessagesForCache,
  computeInputHash,
  computeModelSignature,
  computeStorageKey,
} from "@/lib/ai/cache-key"
import { precheckOrganizationAiBudget } from "@/lib/ai/budget"
import { evaluateAiPlanGate, logAiPlanGateDenial } from "@/lib/ai/plan-gate"
import { readAiCache, recordCacheHitMeta, writeAiCache } from "@/lib/ai/result-cache"
import { recordAiUsageLog, safeAiFailureReason, sumUsage } from "@/lib/ai/usage"
import { getPromptForTask, promptMetadataForLog } from "@/lib/ai/prompts"
import { buildAiUsageOperationalMetadata } from "@/lib/ai/redaction"
import { resolveAiExecutionMode } from "@/lib/ai/execution-mode"
import { buildMockStructuredOutput } from "@/lib/ai/mock-task-output"
import { getProviderAdapter, isProviderAvailable } from "@/lib/ai/providers/index"
import type {
  AiChatMessage,
  AiModelRef,
  AiRunMeta,
  AiTaskDefinition,
  AiTaskFailure,
  AiTaskResult,
  AiTaskSuccess,
  EscalationReason,
  RunAiTaskOptions,
  UnifiedCompletionRequest,
} from "@/lib/ai/types"

function mergeTaskDef(base: AiTaskDefinition, patch?: Partial<AiTaskDefinition>): AiTaskDefinition {
  const merged = patch ? { ...base, ...patch } : base
  return {
    ...merged,
    cacheable: merged.cacheable ?? false,
    allowResponseCaching: merged.allowResponseCaching ?? false,
    cacheTtlSeconds: merged.cacheTtlSeconds ?? null,
  }
}

function routerShouldUseCache(def: AiTaskDefinition, options: RunAiTaskOptions): boolean {
  if (!def.cacheable || !def.allowResponseCaching || options.skipCache) return false
  const oid = options.organizationId?.trim()
  if (!oid) return false
  if (def.id === "catalog_extraction" || def.id === "certificate_cleanup") {
    return Boolean(options.cacheKeyExtras?.file_sha256?.trim())
  }
  return true
}

function messagesHaveNonTextParts(messages: AiChatMessage[]): boolean {
  return messages.some((m) => {
    if (typeof m.content === "string") return false
    return m.content.some((p) => p.type !== "text")
  })
}

async function tryRouterCacheHit<T>(params: {
  def: AiTaskDefinition
  options: RunAiTaskOptions<T>
  primaryRef: AiModelRef
  started: number
  cacheWrite: { storageKey: string }
  usagePromptMeta?: Record<string, unknown>
}): Promise<AiTaskSuccess<T> | null> {
  const { def, options, primaryRef, started, cacheWrite, usagePromptMeta } = params
  const orgId = options.organizationId.trim()

  const row = await readAiCache({
    storageKey: cacheWrite.storageKey,
    organizationId: orgId,
  })
  if (!row) return null

  const zeroUsage = { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 }
  const metaBase: AiRunMeta = {
    task: def.id,
    provider: primaryRef.provider,
    model: primaryRef.model,
    escalated: false,
    escalationReasons: [],
    attempts: 0,
    durationMs: Date.now() - started,
    cacheHit: true,
  }

  const bumpHit = async () => {
    await recordCacheHitMeta({
      storageKey: cacheWrite.storageKey,
      organizationId: orgId,
      task: def.id,
      provider: primaryRef.provider,
      model: primaryRef.model,
      skipUsageLog: Boolean(options.skipUsageLog),
      usageMetadata: usagePromptMeta,
    })
  }

  if (!options.schema) {
    const text = row.response_text?.trim() ?? ""
    if (!text) return null
    await bumpHit()
    return {
      ok: true,
      output: text as T,
      rawText: text,
      usage: zeroUsage,
      meta: metaBase,
    }
  }

  const rawJson = row.response_json != null ? JSON.stringify(row.response_json) : ""
  if (!rawJson) return null

  const schemaResult = await parseWithSchemaSafe(rawJson, options.schema)
  if (!schemaResult.ok) return null

  const data = schemaResult.data
  let parsedForConfidence: unknown
  try {
    parsedForConfidence = parseJsonSafe(rawJson)
  } catch {
    parsedForConfidence = data as unknown
  }

  if (def.confidenceThreshold != null) {
    const minConf = extractMinConfidence(parsedForConfidence)
    if (minConf != null && minConf < def.confidenceThreshold) return null
  }

  if (options.acceptResult) {
    const ok = await options.acceptResult(data, rawJson)
    if (!ok) return null
  }

  await bumpHit()
  return {
    ok: true,
    output: data,
    rawText: rawJson,
    usage: zeroUsage,
    meta: metaBase,
  }
}

function messagesFromInput(input: RunAiTaskOptions["input"]): AiChatMessage[] {
  if (input.messages && input.messages.length > 0) {
    const msgs = [...input.messages]
    if (msgs.every((m) => m.role === "system")) {
      msgs.push({ role: "user", content: "Proceed." })
    }
    return msgs
  }
  const out: AiChatMessage[] = []
  if (input.system?.trim()) out.push({ role: "system", content: input.system.trim() })
  if (input.user?.trim()) out.push({ role: "user", content: input.user.trim() })
  if (out.length === 0) {
    throw new Error("AI task input must include `messages` or both `system` and/or `user` prompts.")
  }
  if (out.every((m) => m.role === "system")) {
    out.push({ role: "user", content: "Proceed." })
  }
  return out
}

function augmentForStructuredJson(def: AiTaskDefinition, messages: AiChatMessage[]): AiChatMessage[] {
  if (def.structuredMode !== "json_object") return messages
  const hint = "\n\nRespond with a single valid JSON object only. Do not wrap in markdown fences."
  const copy = [...messages]
  const sysIdx = copy.findIndex((m) => m.role === "system")
  if (sysIdx >= 0 && typeof copy[sysIdx].content === "string") {
    copy[sysIdx] = { role: "system", content: copy[sysIdx].content + hint }
    return copy
  }
  return [{ role: "system", content: hint.trim() }, ...copy]
}

function dedupeModelChain(refs: AiModelRef[]): AiModelRef[] {
  const seen = new Set<string>()
  const out: AiModelRef[] = []
  for (const r of refs) {
    const k = `${r.provider}:${r.model}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

function filterAvailable(refs: AiModelRef[]): AiModelRef[] {
  return refs.filter((r) => isProviderAvailable(r.provider))
}

async function runOneCompletion(
  def: AiTaskDefinition,
  modelRef: AiModelRef,
  messages: AiChatMessage[],
): Promise<{ response: Awaited<ReturnType<ReturnType<typeof getProviderAdapter>["complete"]>>; modelRef: AiModelRef }> {
  const adapter = getProviderAdapter(modelRef.provider)
  const msgs = augmentForStructuredJson(def, messages)

  if (!adapter.supportsMultimodal) {
    const bad = msgs.some((m) => typeof m.content !== "string" && m.content.some((p) => p.type !== "text"))
    if (bad) {
      throw new Error(`Provider ${modelRef.provider} does not support non-text multimodal content for this task.`)
    }
  }

  const req: UnifiedCompletionRequest = {
    model: modelRef.model,
    messages: msgs,
    temperature: def.temperature,
    maxOutputTokens: def.maxOutputTokens,
    structuredMode: modelRef.provider === "openai" ? def.structuredMode : "none",
    timeoutMs: def.timeoutMs,
    maxRetries: def.maxRetries,
  }

  const response = await adapter.complete(req)
  return { response, modelRef }
}

/**
 * Central AI entrypoint — all server-side features should call this instead of vendor SDKs.
 * Streaming, agents, and queues can wrap this in later iterations.
 */
export async function runAiTask<T = string>(options: RunAiTaskOptions<T>): Promise<AiTaskResult<T>> {
  const started = Date.now()
  const escalationReasons: EscalationReason[] = []
  const usageParts: Array<{ model: string; promptTokens: number; completionTokens: number }> = []

  const baseDef = getTaskDefinition(options.task)
  const def = mergeTaskDef(baseDef, options.taskOverrides)
  const primaryRef = applyPrimaryModelRef(def.id, def.primaryModel)

  let usagePromptMeta: Record<string, unknown> | undefined
  if (def.promptId?.trim()) {
    try {
      const pr = getPromptForTask(def.id, { version: options.promptVersionOverride })
      usagePromptMeta = promptMetadataForLog(pr) as unknown as Record<string, unknown>
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      return {
        ok: false,
        error: err,
        usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
        meta: {
          task: def.id,
          provider: primaryRef.provider,
          model: primaryRef.model,
          escalated: false,
          escalationReasons,
          attempts: 0,
          durationMs: Date.now() - started,
        },
      }
    }
  }

  const chain = dedupeModelChain([primaryRef, def.fallbackModel, def.escalationModel])
  const available = filterAvailable(chain)

  if (available.length === 0) {
    const err = new Error(
      "No AI provider is configured and enabled. Set OPENAI_API_KEY (and optional ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY) and AI_ENABLED_PROVIDERS.",
    )
    const failMeta = {
      task: def.id,
      provider: primaryRef.provider,
      model: primaryRef.model,
      escalated: false,
      escalationReasons,
      attempts: 0,
      durationMs: Date.now() - started,
    }
    return {
      ok: false,
      error: err,
      usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
      meta: failMeta,
    }
  }

  let messages: AiChatMessage[]
  try {
    messages = messagesFromInput(options.input)
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    return {
      ok: false,
      error: err,
      usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
      meta: {
        task: def.id,
        provider: primaryRef.provider,
        model: primaryRef.model,
        escalated: false,
        escalationReasons,
        attempts: 0,
        durationMs: Date.now() - started,
      },
    }
  }

  const orgIdForMode = options.organizationId?.trim() ?? ""
  if (orgIdForMode && !options.skipExecutionModeMock) {
    const resolved = await resolveAiExecutionMode({
      organizationId: orgIdForMode,
      actingUserEmail: options.actingUserEmail ?? null,
      forceLiveAi: options.forceLiveAi ?? false,
    })
    if (resolved.mode === "disabled") {
      const durationMs = Date.now() - started
      return {
        ok: false,
        error: new Error(
          "AI is unavailable while billing is restricted for this workspace. Restore billing to continue.",
        ),
        usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
        meta: {
          task: def.id,
          provider: primaryRef.provider,
          model: primaryRef.model,
          escalated: false,
          escalationReasons,
          attempts: 0,
          durationMs,
        },
      }
    }

    if (resolved.mode === "mock_trial") {
      try {
        const mock = await buildMockStructuredOutput<T>({
          task: def.id,
          input: options.input,
          schema: options.schema,
          acceptResult: options.acceptResult,
        })
        const durationMs = Date.now() - started
        const trialAiPreview = def.id === "aiden_safe_action_prepare"
        const meta: AiRunMeta = {
          task: def.id,
          provider: "mock",
          model: "simulated",
          escalated: false,
          escalationReasons: [],
          attempts: 1,
          durationMs,
          trialAiPreview,
        }
        if (!options.skipUsageLog) {
          const usageMeta = buildAiUsageOperationalMetadata({
            task: def.id,
            provider: "mock",
            model: "simulated",
            attemptCount: 1,
            escalationReasons: [],
            cacheHit: false,
            budgetBlocked: false,
            durationMs,
            promptMeta: usagePromptMeta,
            extras: {
              execution_mode: "mock_trial",
              real_cost_usd: 0,
            },
          })
          await recordAiUsageLog({
            organization_id: orgIdForMode,
            task: def.id,
            provider: "mock",
            model: "simulated",
            prompt_tokens: mock.promptTokens,
            completion_tokens: mock.completionTokens,
            estimated_cost: 0,
            duration_ms: durationMs,
            success: true,
            cache_hit: false,
            budget_blocked: false,
            metadata: usageMeta,
          })
        }
        return {
          ok: true,
          output: mock.output,
          rawText: mock.rawText,
          usage: {
            promptTokens: mock.promptTokens,
            completionTokens: mock.completionTokens,
            estimatedCostUsd: 0,
          },
          meta,
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        const durationMs = Date.now() - started
        if (!options.skipUsageLog) {
          await recordAiUsageLog({
            organization_id: orgIdForMode,
            task: def.id,
            provider: "mock",
            model: "simulated",
            prompt_tokens: 0,
            completion_tokens: 0,
            estimated_cost: 0,
            duration_ms: durationMs,
            success: false,
            failure_reason: safeAiFailureReason(err.message),
            cache_hit: false,
            budget_blocked: false,
            metadata: buildAiUsageOperationalMetadata({
              task: def.id,
              provider: "mock",
              model: "simulated",
              attemptCount: 1,
              escalationReasons: [],
              cacheHit: false,
              budgetBlocked: false,
              durationMs,
              promptMeta: usagePromptMeta,
              extras: {
                execution_mode: "mock_trial",
                real_cost_usd: 0,
              },
            }),
          })
        }
        return {
          ok: false,
          error: err,
          usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
          meta: {
            task: def.id,
            provider: "mock",
            model: "simulated",
            escalated: false,
            escalationReasons,
            attempts: 1,
            durationMs,
          },
        }
      }
    }
  }

  if (!options.skipPlanGateCheck && options.organizationId?.trim()) {
    const gate = await evaluateAiPlanGate({
      organizationId: options.organizationId.trim(),
      taskDef: def,
    })
    if (!gate.ok) {
      const durationMs = Date.now() - started
      await logAiPlanGateDenial({
        organizationId: options.organizationId.trim(),
        taskDef: def,
        primaryRef,
        durationMs,
        gate,
        skipUsageLog: options.skipUsageLog,
      })
      return {
        ok: false,
        error: new Error(gate.message),
        usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
        meta: {
          task: def.id,
          provider: primaryRef.provider,
          model: primaryRef.model,
          escalated: false,
          escalationReasons: [...escalationReasons, "plan_blocked"],
          attempts: 0,
          durationMs,
        },
      }
    }
  }

  if (!options.skipBudgetCheck && options.organizationId?.trim()) {
    const pre = await precheckOrganizationAiBudget(options.organizationId.trim())
    if (pre.action === "block") {
      const durationMs = Date.now() - started
      if (!options.skipUsageLog) {
        const usageMeta = buildAiUsageOperationalMetadata({
          task: def.id,
          provider: primaryRef.provider,
          model: primaryRef.model,
          attemptCount: 0,
          budgetBlocked: true,
          cacheHit: false,
          durationMs,
          promptMeta: usagePromptMeta,
        })
        await recordAiUsageLog({
          organization_id: options.organizationId.trim(),
          task: def.id,
          provider: primaryRef.provider,
          model: primaryRef.model,
          prompt_tokens: 0,
          completion_tokens: 0,
          estimated_cost: 0,
          duration_ms: durationMs,
          success: false,
          budget_blocked: true,
          failure_reason: "budget_exceeded",
          cache_hit: false,
          metadata: usageMeta,
        })
      }
      return {
        ok: false,
        error: new Error(pre.message),
        usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 },
        meta: {
          task: def.id,
          provider: primaryRef.provider,
          model: primaryRef.model,
          escalated: false,
          escalationReasons: [...escalationReasons, "budget_exceeded"],
          attempts: 0,
          durationMs,
        },
      }
    }
  }

  let cacheWrite:
    | {
        inputHash: string
        storageKey: string
        modelSig: string
      }
    | undefined

  if (routerShouldUseCache(def, options) && !messagesHaveNonTextParts(messages)) {
    const msgsForHash = augmentForStructuredJson(def, messages)
    const inputHash = computeInputHash({
      taskId: def.id,
      messagesCanonical: canonicalizeMessagesForCache(msgsForHash),
      schemaVersion:
        options.cacheSchemaVersion ??
        (usagePromptMeta?.schemaVersion as string | undefined) ??
        "default",
      prompt: usagePromptMeta
        ? {
            promptId: usagePromptMeta.promptId as string,
            promptVersion: usagePromptMeta.promptVersion as number,
            schemaVersion: usagePromptMeta.schemaVersion as string,
          }
        : undefined,
      extras: options.cacheKeyExtras,
    })
    const modelSig = computeModelSignature(def, primaryRef)
    const storageKey = computeStorageKey(
      options.organizationId.trim(),
      def.id,
      inputHash,
      modelSig,
    )
    cacheWrite = { inputHash, storageKey, modelSig }

    const cached = await tryRouterCacheHit<T>({
      def,
      options,
      primaryRef,
      started,
      cacheWrite: { storageKey },
      usagePromptMeta,
    })
    if (cached) return cached
  }

  let attempts = 0
  let lastError: Error | null = null
  let lastText = ""

  for (const modelRef of available) {
    attempts++
    let text = ""
    try {
      const { response } = await runOneCompletion(def, modelRef, messages)
      text = response.text?.trim() ?? ""
      lastText = text
      usageParts.push({
        model: modelRef.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
      })
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      escalationReasons.push("transport_error")
      continue
    }

    if (!options.schema) {
      const usage = sumUsage(usageParts)
      const meta: AiRunMeta = {
        task: def.id,
        provider: modelRef.provider,
        model: modelRef.model,
        escalated: attempts > 1,
        escalationReasons,
        attempts,
        durationMs: Date.now() - started,
      }
      const success: AiTaskSuccess<T> = {
        ok: true,
        output: text as T,
        rawText: text,
        usage,
        meta,
      }
      if (!options.skipUsageLog) {
        const usageMeta = buildAiUsageOperationalMetadata({
          task: def.id,
          provider: modelRef.provider,
          model: modelRef.model,
          attemptCount: attempts,
          escalationReasons,
          cacheHit: false,
          budgetBlocked: false,
          durationMs: meta.durationMs,
        })
        await recordAiUsageLog({
          organization_id: options.organizationId,
          task: def.id,
          provider: modelRef.provider,
          model: modelRef.model,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          estimated_cost: usage.estimatedCostUsd,
          duration_ms: meta.durationMs,
          success: true,
          cache_hit: false,
          budget_blocked: false,
        })
      }
      if (cacheWrite && !options.skipCache && def.allowResponseCaching) {
        await writeAiCache({
          organizationId: options.organizationId.trim(),
          storageKey: cacheWrite.storageKey,
          task: def.id,
          inputHash: cacheWrite.inputHash,
          modelSignature: cacheWrite.modelSig,
          responseJson: null,
          responseText: text,
          confidenceScore: null,
          ttlSeconds: def.cacheTtlSeconds ?? null,
        })
      }
      return success
    }

    const parsedUnknown = (() => {
      try {
        return parseJsonSafe(text)
      } catch {
        return null
      }
    })()

    if (parsedUnknown === null) {
      escalationReasons.push("invalid_json")
      lastError = new Error("Model output was not valid JSON.")
      continue
    }

    const schemaResult = await parseWithSchemaSafe(text, options.schema)
    if (!schemaResult.ok) {
      escalationReasons.push("invalid_json")
      lastError = schemaResult.error
      continue
    }

    const data = schemaResult.data

    if (def.confidenceThreshold != null) {
      const minConf = extractMinConfidence(parsedUnknown)
      if (minConf != null && minConf < def.confidenceThreshold) {
        escalationReasons.push("low_confidence")
        lastError = new Error(`Confidence ${minConf} below threshold ${def.confidenceThreshold}`)
        continue
      }
    }

    if (options.acceptResult) {
      const ok = await options.acceptResult(data, text)
      if (!ok) {
        escalationReasons.push("caller_rejected")
        lastError = new Error("acceptResult rejected model output.")
        continue
      }
    }

    const usage = sumUsage(usageParts)
    const meta: AiRunMeta = {
      task: def.id,
      provider: modelRef.provider,
      model: modelRef.model,
      escalated: attempts > 1,
      escalationReasons,
      attempts,
      durationMs: Date.now() - started,
    }
    const success: AiTaskSuccess<T> = {
      ok: true,
      output: data,
      rawText: text,
      usage,
      meta,
    }
    if (!options.skipUsageLog) {
      const usageMeta = buildAiUsageOperationalMetadata({
        task: def.id,
        provider: modelRef.provider,
        model: modelRef.model,
        attemptCount: attempts,
        escalationReasons,
        cacheHit: false,
        budgetBlocked: false,
        durationMs: meta.durationMs,
        promptMeta: usagePromptMeta,
      })
      await recordAiUsageLog({
        organization_id: options.organizationId,
        task: def.id,
        provider: modelRef.provider,
        model: modelRef.model,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        estimated_cost: usage.estimatedCostUsd,
        duration_ms: meta.durationMs,
        success: true,
        cache_hit: false,
        budget_blocked: false,
        metadata: usageMeta,
      })
    }
    if (cacheWrite && !options.skipCache && def.allowResponseCaching) {
      const confVal = extractMinConfidence(parsedUnknown)
      await writeAiCache({
        organizationId: options.organizationId.trim(),
        storageKey: cacheWrite.storageKey,
        task: def.id,
        inputHash: cacheWrite.inputHash,
        modelSignature: cacheWrite.modelSig,
        responseJson: data as unknown,
        responseText: null,
        confidenceScore: confVal != null ? confVal : null,
        ttlSeconds: def.cacheTtlSeconds ?? null,
      })
    }
    return success
  }

  const usage = sumUsage(usageParts)
  const err = lastError ?? new Error("All AI model attempts failed.")
  const failMeta: AiTaskFailure["meta"] = {
    task: def.id,
    provider: available[0]?.provider ?? primaryRef.provider,
    model: available[0]?.model ?? primaryRef.model,
    escalated: attempts > 1,
    escalationReasons,
    attempts,
    durationMs: Date.now() - started,
  }

  if (!options.skipUsageLog && options.organizationId?.trim()) {
    const metaSmall = buildAiUsageOperationalMetadata({
      task: def.id,
      provider: failMeta.provider,
      model: failMeta.model,
      attemptCount: attempts,
      escalationReasons: failMeta.escalationReasons,
      cacheHit: false,
      budgetBlocked: false,
      durationMs: failMeta.durationMs,
      promptMeta: usagePromptMeta,
    })
    const metaPayload = Object.keys(metaSmall).length > 0 ? metaSmall : undefined
    if (usageParts.length > 0) {
      await recordAiUsageLog({
        organization_id: options.organizationId,
        task: def.id,
        provider: failMeta.provider,
        model: failMeta.model,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        estimated_cost: usage.estimatedCostUsd,
        duration_ms: failMeta.durationMs,
        success: false,
        failure_reason: safeAiFailureReason(lastError?.message ?? err.message),
        cache_hit: false,
        budget_blocked: false,
        metadata: metaPayload,
      })
    } else {
      await recordAiUsageLog({
        organization_id: options.organizationId.trim(),
        task: def.id,
        provider: failMeta.provider,
        model: failMeta.model,
        prompt_tokens: 0,
        completion_tokens: 0,
        estimated_cost: 0,
        duration_ms: failMeta.durationMs,
        success: false,
        failure_reason: safeAiFailureReason(lastError?.message ?? err.message),
        cache_hit: false,
        budget_blocked: false,
        metadata: metaPayload,
      })
    }
  }

  return {
    ok: false,
    error: lastText ? new Error(`${err.message}\nLast output (truncated): ${lastText.slice(0, 400)}`) : err,
    usage,
    meta: failMeta,
  }
}
