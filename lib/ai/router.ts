import "server-only"

import { applyPrimaryModelRef } from "@/lib/ai/config"
import { getTaskDefinition } from "@/lib/ai/tasks"
import {
  extractMinConfidence,
  parseJsonSafe,
  parseWithSchemaSafe,
} from "@/lib/ai/structured"
import { recordAiUsageLog, sumUsage } from "@/lib/ai/usage"
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
  return patch ? { ...base, ...patch } : base
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

  if (!options.skipUsageLog && usageParts.length > 0) {
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
    })
  }

  return {
    ok: false,
    error: lastText ? new Error(`${err.message}\nLast output (truncated): ${lastText.slice(0, 400)}`) : err,
    usage,
    meta: failMeta,
  }
}
