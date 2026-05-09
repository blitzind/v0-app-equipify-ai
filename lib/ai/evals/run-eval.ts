import { z } from "zod"
import { runAiTask } from "@/lib/ai/router"
import { AI_EVAL_FIXTURES } from "@/lib/ai/evals/fixtures"
import type { AiEvalFixture, EvalRunResult } from "@/lib/ai/evals/types"
import { extractMinConfidence } from "@/lib/ai/structured"
import { applyPrimaryModelRef } from "@/lib/ai/config"
import { getTaskDefinition } from "@/lib/ai/tasks"

const EVAL_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000010"

function getByPath(value: unknown, path: string): unknown {
  if (path === ".") return value
  const parts = path.split(".").filter(Boolean)
  let cur: unknown = value
  for (const part of parts) {
    if (cur == null) return undefined
    if (Array.isArray(cur)) {
      const idx = Number.parseInt(part, 10)
      if (!Number.isFinite(idx)) return undefined
      cur = cur[idx]
      continue
    }
    if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[part]
      continue
    }
    return undefined
  }
  return cur
}

function hasRequiredPath(value: unknown, path: string): boolean {
  const v = getByPath(value, path)
  if (v == null) return false
  if (typeof v === "string") return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
}

function sampleExpectationMatches(actual: unknown, expected: unknown): boolean {
  if (typeof expected === "string") {
    if (typeof actual !== "string") return false
    return actual.toLowerCase().includes(expected.toLowerCase())
  }
  return Object.is(actual, expected)
}

function validateOutput(fixture: AiEvalFixture, output: unknown): { ok: true; confidence: number | null } | { ok: false; reason: string } {
  if (fixture.outputSchema) {
    const parsed = fixture.outputSchema.safeParse(output)
    if (!parsed.success) {
      return { ok: false, reason: `schema validation failed: ${parsed.error.issues[0]?.message ?? "unknown error"}` }
    }
  } else if (fixture.mode === "router" && fixture.task !== "OCR_cleanup") {
    const basic = z.union([z.record(z.string(), z.unknown()), z.string()]).safeParse(output)
    if (!basic.success) {
      return { ok: false, reason: "expected JSON object or string output" }
    }
  }

  for (const field of fixture.requiredFields) {
    if (!hasRequiredPath(output, field)) {
      return { ok: false, reason: `missing required field: ${field}` }
    }
  }

  for (const [path, expected] of Object.entries(fixture.sampleExpectedValues ?? {})) {
    const actual = getByPath(output, path)
    if (actual === undefined) continue
    if (!sampleExpectationMatches(actual, expected)) {
      return { ok: false, reason: `sample value check failed at "${path}"` }
    }
  }

  const confidence = extractMinConfidence(output)
  if (fixture.minimumConfidence != null && confidence != null && confidence < fixture.minimumConfidence) {
    return {
      ok: false,
      reason: `confidence ${confidence.toFixed(3)} below minimum ${fixture.minimumConfidence.toFixed(3)}`,
    }
  }

  return { ok: true, confidence }
}

async function runSingleFixture(fixture: AiEvalFixture, mock: boolean): Promise<EvalRunResult> {
  if (mock) {
    const schemaOk = fixture.outputSchema ? true : true
    const requiredOk = fixture.requiredFields.every((f) => typeof f === "string" && f.trim().length > 0)
    const promptMetaOk = fixture.promptId.trim().length > 0 && fixture.promptVersion > 0
    const pass = schemaOk && requiredOk && promptMetaOk
    const reason = pass
      ? "mock validation only (fixtures loaded; provider calls skipped)"
      : "fixture definition invalid"
    return {
      fixtureId: fixture.id,
      task: fixture.task,
      promptVersion: fixture.promptVersion,
      pass,
      reason,
      confidence: null,
      provider: "mock",
      model: "mock",
      estimatedCostUsd: 0,
    }
  }

  if (fixture.mode === "file_extraction") {
    const result = await runAiTask({
      task: fixture.task,
      organizationId: EVAL_ORGANIZATION_ID,
      input: {
        system: fixture.input.systemPrompt,
        user: `${fixture.input.userInstruction}\n\n[eval fixture: ${fixture.input.fileName} ${fixture.input.mimeType}]\n${fixture.input.bufferText}`,
      },
      schema: (fixture.outputSchema ?? z.unknown()) as z.ZodType<unknown>,
      skipUsageLog: true,
      skipBudgetCheck: true,
      skipPlanGateCheck: true,
      skipCache: true,
      skipExecutionModeMock: true,
      promptVersionOverride: fixture.promptVersion,
    })

    if (!result.ok) {
      return {
        fixtureId: fixture.id,
        task: fixture.task,
        promptVersion: fixture.promptVersion,
        pass: false,
        reason: result.error.message,
        provider: result.meta.provider,
        model: result.meta.model,
        estimatedCostUsd: result.usage.estimatedCostUsd,
      }
    }

    const validation = validateOutput(fixture, result.output)
    const ref = applyPrimaryModelRef(fixture.task, getTaskDefinition(fixture.task).primaryModel)
    return {
      fixtureId: fixture.id,
      task: fixture.task,
      promptVersion: fixture.promptVersion,
      pass: validation.ok,
      reason: validation.ok ? undefined : validation.reason,
      confidence: validation.ok ? validation.confidence : null,
      provider: result.meta.provider ?? ref.provider,
      model: result.meta.model ?? ref.model,
      estimatedCostUsd: result.usage.estimatedCostUsd,
    }
  }

  const result = await runAiTask({
    task: fixture.task,
    organizationId: EVAL_ORGANIZATION_ID,
    input: fixture.input,
    schema: fixture.outputSchema as z.ZodType<unknown> | undefined,
    skipUsageLog: true,
    skipBudgetCheck: true,
    skipPlanGateCheck: true,
    skipCache: true,
    skipExecutionModeMock: true,
    promptVersionOverride: fixture.promptVersion,
  })

  if (!result.ok) {
    return {
      fixtureId: fixture.id,
      task: fixture.task,
      promptVersion: fixture.promptVersion,
      pass: false,
      reason: result.error.message,
      provider: result.meta.provider,
      model: result.meta.model,
      estimatedCostUsd: result.usage.estimatedCostUsd,
    }
  }

  const validation = validateOutput(fixture, result.output)
  return {
    fixtureId: fixture.id,
    task: fixture.task,
    promptVersion: fixture.promptVersion,
    pass: validation.ok,
    reason: validation.ok ? undefined : validation.reason,
    confidence: validation.ok ? validation.confidence : null,
    provider: result.meta.provider,
    model: result.meta.model,
    estimatedCostUsd: result.usage.estimatedCostUsd,
  }
}

export async function runAiEvals(): Promise<{ results: EvalRunResult[]; mockMode: boolean; totalEstimatedCostUsd: number }> {
  const explicitMock = process.env.AI_EVAL_MOCK === "1"
  const allowProviderCalls = process.env.AI_EVAL_ALLOW_PROVIDER_CALLS === "1"
  const mockMode = explicitMock || !allowProviderCalls

  if (!allowProviderCalls && !explicitMock) {
    console.log("[ai-evals] Provider calls disabled (set AI_EVAL_ALLOW_PROVIDER_CALLS=1). Running in mock mode.")
  }

  const results: EvalRunResult[] = []
  let totalEstimatedCostUsd = 0

  for (const fixture of AI_EVAL_FIXTURES) {
    try {
      const run = await runSingleFixture(fixture, mockMode)
      results.push(run)
      totalEstimatedCostUsd += run.estimatedCostUsd ?? 0
      const status = run.pass ? "PASS" : "FAIL"
      const conf = run.confidence != null ? ` confidence=${run.confidence.toFixed(3)}` : ""
      const reason = run.reason ? ` reason="${run.reason}"` : ""
      const modelInfo = mockMode ? "provider=mock model=mock" : `provider=${run.provider ?? "unknown"} model=${run.model ?? "unknown"}`
      const runCost = run.estimatedCostUsd != null ? ` cost=$${run.estimatedCostUsd.toFixed(6)}` : ""
      console.log(
        `[ai-evals] ${status} task=${fixture.task} promptVersion=${fixture.promptVersion} ${modelInfo}${conf}${runCost}${reason}`,
      )
      if (!mockMode) {
        console.log(`[ai-evals] running estimated total cost: $${totalEstimatedCostUsd.toFixed(6)}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({
        fixtureId: fixture.id,
        task: fixture.task,
        promptVersion: fixture.promptVersion,
        pass: false,
        reason: msg,
      })
      console.log(`[ai-evals] FAIL task=${fixture.task} promptVersion=${fixture.promptVersion} reason="${msg}"`)
    }
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.length - passed
  console.log(`[ai-evals] summary pass=${passed} fail=${failed} total=${results.length}`)
  console.log(`[ai-evals] total estimated cost: $${totalEstimatedCostUsd.toFixed(6)}`)

  return { results, mockMode, totalEstimatedCostUsd }
}
