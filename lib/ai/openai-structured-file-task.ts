/**
 * TODO(ai-router-migration): Merge file-id + multimodal path into `runAiTask` once the unified
 * adapter supports OpenAI `input_file` / Responses API without duplicating SDK calls here.
 *
 * Centralizes OpenAI SDK usage for PDF file uploads and vision images so domain modules stay
 * provider-agnostic.
 */
import "server-only"

import OpenAI, { toFile } from "openai"
import type { ChatCompletionContentPart } from "openai/resources/chat/completions/completions"
import type { z } from "zod"

import { aiDebugLog, aiDebugLogExtraction } from "@/lib/ai/ai-debug"
import { applyPrimaryModelRef } from "@/lib/ai/config"
import { extractMinConfidence, parseJsonSafe, parseWithSchemaSafe } from "@/lib/ai/structured"
import { getTaskDefinition } from "@/lib/ai/tasks"
import type { AiModelRef, AiTaskDefinition, AiTaskId } from "@/lib/ai/types"
import { getProviderApiKey } from "@/lib/ai/providers/credentials"
import {
  computeModelSignature,
  computeFileExtractionInputHash,
  computeFileExtractionStorageKey,
  sha256BufferHex,
} from "@/lib/ai/cache-key"
import { precheckOrganizationAiBudget } from "@/lib/ai/budget"
import { evaluateAiPlanGate, logAiPlanGateDenial } from "@/lib/ai/plan-gate"
import { readAiCache, recordCacheHitMeta, writeAiCache } from "@/lib/ai/result-cache"
import { recordAiUsageLog, safeAiFailureReason, sumUsage } from "@/lib/ai/usage"
import { getPromptForTask, promptMetadataForLog } from "@/lib/ai/prompts"
import { buildAiUsageOperationalMetadata } from "@/lib/ai/redaction"
import { resolveAiExecutionMode } from "@/lib/ai/execution-mode"
import { buildMockFileExtractionOutput } from "@/lib/ai/mock-task-output"

function mergeTaskDef(base: AiTaskDefinition, patch?: Partial<AiTaskDefinition>): AiTaskDefinition {
  const merged = patch ? { ...base, ...patch } : base
  return {
    ...merged,
    cacheable: merged.cacheable ?? false,
    allowResponseCaching: merged.allowResponseCaching ?? false,
    cacheTtlSeconds: merged.cacheTtlSeconds ?? null,
    promptId: merged.promptId,
  }
}

function legacyCatalogOverrides(): Partial<AiTaskDefinition> | undefined {
  const m = process.env.OPENAI_PRICE_LIST_MODEL?.trim() || process.env.OPENAI_IMPORT_MODEL?.trim()
  if (!m) return undefined
  return { primaryModel: { provider: "openai", model: m } }
}

function legacyCertificateOverrides(): Partial<AiTaskDefinition> | undefined {
  const m = process.env.OPENAI_IMPORT_MODEL?.trim()
  if (!m) return undefined
  return { primaryModel: { provider: "openai", model: m } }
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

function openAiChainFromTask(def: AiTaskDefinition): AiModelRef[] {
  const merged = dedupeModelChain([def.primaryModel, def.fallbackModel, def.escalationModel])
  return merged.filter((r) => r.provider === "openai")
}

export type StructuredFileTaskId = Extract<AiTaskId, "catalog_extraction" | "certificate_cleanup">

export async function executeOpenAiStructuredFileExtraction<T>(args: {
  organizationId: string | null
  task: StructuredFileTaskId
  buffer: Buffer
  fileName: string
  mimeType: string
  systemPrompt: string
  userInstruction: string
  schema: z.ZodType<T>
  /** When false, usage rows are skipped (org unknown). */
  skipUsageLog?: boolean
  /** Bypass monthly org AI budget (platform / tests). */
  skipBudgetCheck?: boolean
  /** Bypass subscription plan gate (tests). */
  skipPlanGateCheck?: boolean
  /** Skip ai_cache lookup/write (debug). */
  skipCache?: boolean
  /** Bypass trial simulation for scripts/tests that must hit live extraction. */
  skipExecutionModeMock?: boolean
}): Promise<T> {
  const started = Date.now()

  const base = getTaskDefinition(args.task)
  const legacy =
    args.task === "catalog_extraction" ? legacyCatalogOverrides() : legacyCertificateOverrides()
  const def = mergeTaskDef(base, legacy)
  const primaryRef = applyPrimaryModelRef(def.id, def.primaryModel)
  const chain = openAiChainFromTask({ ...def, primaryModel: primaryRef })

  let usagePromptMeta: Record<string, unknown> | undefined
  if (def.promptId?.trim()) {
    const pr = getPromptForTask(args.task)
    usagePromptMeta = promptMetadataForLog(pr) as unknown as Record<string, unknown>
  }

  const orgIdTrim = args.organizationId?.trim()
  if (orgIdTrim && !(args.skipExecutionModeMock ?? false)) {
    const { mode } = await resolveAiExecutionMode({ organizationId: orgIdTrim })
    if (mode === "disabled") {
      throw new Error("AI extraction is unavailable while billing is restricted for this workspace.")
    }
    if (mode === "mock_trial") {
      const mock = await buildMockFileExtractionOutput({
        task: args.task,
        schema: args.schema,
        fileName: args.fileName,
        byteLength: args.buffer.byteLength,
      })
      const durationMs = Date.now() - started
      if (!args.skipUsageLog) {
        await recordAiUsageLog({
          organization_id: orgIdTrim,
          task: args.task,
          provider: "mock",
          model: "simulated",
          prompt_tokens: mock.promptTokens,
          completion_tokens: mock.completionTokens,
          estimated_cost: 0,
          duration_ms: durationMs,
          success: true,
          cache_hit: false,
          budget_blocked: false,
          metadata: buildAiUsageOperationalMetadata({
            task: args.task,
            provider: "mock",
            model: "simulated",
            attemptCount: 1,
            cacheHit: false,
            budgetBlocked: false,
            durationMs,
            promptMeta: usagePromptMeta,
            extras: {
              execution_mode: "mock_trial",
              real_cost_usd: 0,
              fileMimeType: args.mimeType,
              fileSizeBytes: args.buffer.byteLength,
            },
          }),
        })
      }
      return mock.output
    }
  }

  const apiKey = getProviderApiKey("openai")
  if (!apiKey?.trim()) {
    throw new Error("AI extraction is not configured. Add OPENAI_API_KEY.")
  }

  if (chain.length === 0) {
    throw new Error("No OpenAI models configured for this extraction task.")
  }

  if (args.organizationId?.trim() && !(args.skipPlanGateCheck ?? false)) {
    const gate = await evaluateAiPlanGate({
      organizationId: args.organizationId.trim(),
      taskDef: def,
    })
    if (!gate.ok) {
      const durationMs = Date.now() - started
      await logAiPlanGateDenial({
        organizationId: args.organizationId.trim(),
        taskDef: def,
        primaryRef: { provider: "openai", model: chain[0]!.model },
        durationMs,
        gate,
        skipUsageLog: args.skipUsageLog,
      })
      throw new Error(gate.message)
    }
  }

  const fileSha256 = sha256BufferHex(args.buffer)
  const modelSig = computeModelSignature(def, primaryRef)
  const inputHash = computeFileExtractionInputHash({
    organizationId: args.organizationId,
    taskId: args.task,
    systemPrompt: args.systemPrompt,
    userInstruction: args.userInstruction,
    fileSha256,
    mimeType: args.mimeType,
    modelSignature: modelSig,
    promptId: (usagePromptMeta?.promptId as string) ?? "__none__",
    promptVersion: (usagePromptMeta?.promptVersion as number) ?? 0,
    schemaVersion: (usagePromptMeta?.schemaVersion as string) ?? "0",
  })
  const storageKey = computeFileExtractionStorageKey({
    organizationId: args.organizationId,
    taskId: args.task,
    systemPrompt: args.systemPrompt,
    userInstruction: args.userInstruction,
    fileSha256,
    mimeType: args.mimeType,
    modelSignature: modelSig,
    promptId: (usagePromptMeta?.promptId as string) ?? "__none__",
    promptVersion: (usagePromptMeta?.promptVersion as number) ?? 0,
    schemaVersion: (usagePromptMeta?.schemaVersion as string) ?? "0",
  })

  if (
    def.cacheable &&
    def.allowResponseCaching &&
    !args.skipCache &&
    args.organizationId?.trim() &&
    fileSha256.length > 0
  ) {
    const row = await readAiCache({
      storageKey,
      organizationId: args.organizationId.trim(),
    })
    if (row?.response_json != null) {
      const rawJson = JSON.stringify(row.response_json)
      const schemaResult = await parseWithSchemaSafe(rawJson, args.schema)
      if (schemaResult.ok) {
        let parsedForConfidence: unknown
        try {
          parsedForConfidence = parseJsonSafe(rawJson)
        } catch {
          parsedForConfidence = schemaResult.data as unknown
        }
        const passesConfidence =
          def.confidenceThreshold == null ||
          (() => {
            const minConf = extractMinConfidence(parsedForConfidence)
            return minConf == null || minConf >= def.confidenceThreshold
          })()
        if (passesConfidence) {
          await recordCacheHitMeta({
            storageKey,
            organizationId: args.organizationId.trim(),
            task: args.task,
            provider: "openai",
            model: chain[0]!.model,
            skipUsageLog: Boolean(args.skipUsageLog),
            usageMetadata: usagePromptMeta,
          })
          aiDebugLogExtraction({
            task: args.task,
            model: chain[0]!.model,
            attempt: 0,
            escalated: false,
            reason: "cache_hit",
            promptId: usagePromptMeta?.promptId as string | undefined,
            promptVersion: usagePromptMeta?.promptVersion as number | undefined,
          })
          return schemaResult.data
        }
      }
    }
  }

  if (args.organizationId?.trim() && !args.skipBudgetCheck) {
    const pre = await precheckOrganizationAiBudget(args.organizationId.trim())
    if (pre.action === "block") {
      if (!args.skipUsageLog && args.organizationId) {
        const usageMeta = buildAiUsageOperationalMetadata({
          task: args.task,
          provider: "openai",
          model: chain[0]!.model,
          attemptCount: 0,
          budgetBlocked: true,
          durationMs: Date.now() - started,
          promptMeta: usagePromptMeta,
          extras: {
            fileMimeType: args.mimeType,
            fileSizeBytes: args.buffer.byteLength,
          },
        })
        await recordAiUsageLog({
          organization_id: args.organizationId,
          task: args.task,
          provider: "openai",
          model: chain[0]!.model,
          prompt_tokens: 0,
          completion_tokens: 0,
          estimated_cost: 0,
          duration_ms: Date.now() - started,
          success: false,
          budget_blocked: true,
          failure_reason: "budget_exceeded",
          cache_hit: false,
          metadata: usageMeta,
        })
      }
      throw new Error(pre.message)
    }
  }

  aiDebugLog("openai_file_extraction_start", {
    task: args.task,
    models: chain.map((m) => m.model),
    mimeType: args.mimeType,
    timeoutMs: def.timeoutMs,
    promptId: usagePromptMeta?.promptId,
    promptVersion: usagePromptMeta?.promptVersion,
    schemaVersion: usagePromptMeta?.schemaVersion,
  })

  const client = new OpenAI({ apiKey })
  const usageParts: Array<{ model: string; promptTokens: number; completionTokens: number }> = []
  let uploadedFileId: string | null = null
  let lastError: Error | null = null

  try {
    const isPdf = args.mimeType === "application/pdf"
    const isImage = args.mimeType === "image/png" || args.mimeType === "image/jpeg"

    if (isPdf) {
      const file = await toFile(args.buffer, args.fileName || "document.pdf", {
        type: "application/pdf",
      })
      const uploaded = await client.files.create({ file, purpose: "user_data" })
      uploadedFileId = uploaded.id
    } else if (!isImage) {
      throw new Error("Unsupported media type for vision import.")
    }

    const buildUserContent = (): ChatCompletionContentPart[] => {
      if (isPdf) {
        if (!uploadedFileId) throw new Error("PDF upload failed.")
        return [
          { type: "file", file: { file_id: uploadedFileId } },
          { type: "text", text: args.userInstruction },
        ]
      }
      const b64 = args.buffer.toString("base64")
      const dataUrl = `data:${args.mimeType};base64,${b64}`
      return [
        { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        { type: "text", text: args.userInstruction },
      ]
    }

    let attempt = 0
    for (const modelRef of chain) {
      attempt++
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), def.timeoutMs)
      try {
        const completion = await client.chat.completions.create(
          {
            model: modelRef.model,
            temperature: def.temperature,
            max_tokens: def.maxOutputTokens,
            response_format: def.structuredMode === "json_object" ? { type: "json_object" } : undefined,
            messages: [
              { role: "system", content: args.systemPrompt },
              { role: "user", content: buildUserContent() },
            ],
          },
          { signal: controller.signal },
        )
        clearTimeout(timer)

        const usage = completion.usage
        usageParts.push({
          model: modelRef.model,
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
        })

        const rawText = completion.choices[0]?.message?.content?.trim() ?? ""
        if (!rawText) {
          lastError = new Error("The model returned an empty response.")
          aiDebugLogExtraction({
            task: args.task,
            model: modelRef.model,
            attempt,
            escalated: attempt > 1,
            reason: "empty_response",
            promptId: usagePromptMeta?.promptId as string | undefined,
            promptVersion: usagePromptMeta?.promptVersion as number | undefined,
          })
          continue
        }

        const schemaResult = await parseWithSchemaSafe(rawText, args.schema)
        if (!schemaResult.ok) {
          lastError = schemaResult.error
          aiDebugLogExtraction({
            task: args.task,
            model: modelRef.model,
            attempt,
            escalated: attempt > 1,
            reason: `invalid_json_or_schema: ${schemaResult.error.message}`,
          })
          continue
        }

        if (def.confidenceThreshold != null) {
          let parsedForConfidence: unknown
          try {
            parsedForConfidence = parseJsonSafe(rawText)
          } catch {
            parsedForConfidence = schemaResult.data as unknown
          }
          const minConf = extractMinConfidence(parsedForConfidence)
          if (minConf != null && minConf < def.confidenceThreshold) {
            lastError = new Error(
              `Confidence ${minConf} below threshold ${def.confidenceThreshold}`,
            )
            aiDebugLogExtraction({
              task: args.task,
              model: modelRef.model,
              attempt,
              escalated: attempt > 1,
              reason: "low_confidence",
              promptId: usagePromptMeta?.promptId as string | undefined,
              promptVersion: usagePromptMeta?.promptVersion as number | undefined,
            })
            continue
          }
        }

        const usageTotals = sumUsage(usageParts)
        const durationMs = Date.now() - started
        if (!args.skipUsageLog && args.organizationId) {
          const usageMeta = buildAiUsageOperationalMetadata({
            task: args.task,
            provider: "openai",
            model: modelRef.model,
            attemptCount: attempt,
            cacheHit: false,
            durationMs,
            promptMeta: usagePromptMeta,
            extras: {
              fileMimeType: args.mimeType,
              fileSizeBytes: args.buffer.byteLength,
            },
          })
          await recordAiUsageLog({
            organization_id: args.organizationId,
            task: args.task,
            provider: "openai",
            model: modelRef.model,
            prompt_tokens: usageTotals.promptTokens,
            completion_tokens: usageTotals.completionTokens,
            estimated_cost: usageTotals.estimatedCostUsd,
            duration_ms: durationMs,
            success: true,
            cache_hit: false,
            budget_blocked: false,
            metadata: usageMeta,
          })
        }

        aiDebugLogExtraction({
          task: args.task,
          model: modelRef.model,
          attempt,
          escalated: attempt > 1,
          reason: "success",
          promptId: usagePromptMeta?.promptId as string | undefined,
          promptVersion: usagePromptMeta?.promptVersion as number | undefined,
        })

        if (args.organizationId?.trim() && def.cacheable && def.allowResponseCaching && !args.skipCache) {
          let confParsed: unknown
          try {
            confParsed = parseJsonSafe(rawText)
          } catch {
            confParsed = schemaResult.data as unknown
          }
          const confScore = extractMinConfidence(confParsed)
          await writeAiCache({
            organizationId: args.organizationId.trim(),
            storageKey,
            task: args.task,
            inputHash,
            modelSignature: modelSig,
            responseJson: schemaResult.data as unknown,
            responseText: null,
            confidenceScore: confScore != null ? confScore : null,
            ttlSeconds: def.cacheTtlSeconds ?? null,
          })
        }

        return schemaResult.data
      } catch (e) {
        clearTimeout(timer)
        const err = e instanceof Error ? e : new Error(String(e))
        const aborted = err.name === "AbortError" || err.message.includes("aborted")
        lastError = aborted
          ? new Error(
              args.task === "catalog_extraction"
                ? "AI extraction timed out. Try a smaller PDF or try again."
                : "Import timed out. Try again with a smaller file.",
            )
          : err
        aiDebugLogExtraction({
          task: args.task,
          model: modelRef.model,
          attempt,
          escalated: attempt > 1,
          reason: aborted ? "timeout" : `transport: ${err.message}`,
          promptId: usagePromptMeta?.promptId as string | undefined,
          promptVersion: usagePromptMeta?.promptVersion as number | undefined,
        })
        continue
      }
    }

    const failUsage = sumUsage(usageParts)
    const durationMs = Date.now() - started
    if (!args.skipUsageLog && args.organizationId) {
      const usageMeta = buildAiUsageOperationalMetadata({
        task: args.task,
        provider: "openai",
        model: chain[chain.length - 1]?.model ?? "unknown",
        attemptCount: attempt,
        cacheHit: false,
        durationMs,
        escalationReasons: lastError?.message ? [lastError.message] : undefined,
        promptMeta: usagePromptMeta,
        extras: {
          fileMimeType: args.mimeType,
          fileSizeBytes: args.buffer.byteLength,
        },
      })
      await recordAiUsageLog({
        organization_id: args.organizationId,
        task: args.task,
        provider: "openai",
        model: chain[chain.length - 1]?.model ?? "unknown",
        prompt_tokens: usageParts.length > 0 ? failUsage.promptTokens : 0,
        completion_tokens: usageParts.length > 0 ? failUsage.completionTokens : 0,
        estimated_cost: usageParts.length > 0 ? failUsage.estimatedCostUsd : 0,
        duration_ms: durationMs,
        success: false,
        failure_reason: safeAiFailureReason(lastError?.message ?? "extraction_failed"),
        cache_hit: false,
        budget_blocked: false,
        metadata: usageMeta,
      })
    }

    aiDebugLog("openai_file_extraction_failed", {
      task: args.task,
      attempts: attempt,
      message: lastError?.message,
    })

    if (args.task === "catalog_extraction") {
      throw lastError ?? new Error("AI extraction failed. Try a smaller PDF or try again.")
    }
    throw lastError ?? new Error("Import failed. Try again.")
  } finally {
    if (uploadedFileId) {
      try {
        await client.files.del(uploadedFileId)
      } catch {
        /* ignore */
      }
    }
  }
}
