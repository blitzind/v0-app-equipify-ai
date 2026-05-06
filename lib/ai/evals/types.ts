import type { z } from "zod"
import type { AiTaskId } from "@/lib/ai/types"

type EvalBaseFixture = {
  id: string
  task: AiTaskId
  promptId: string
  promptVersion: number
  expectedShape: string
  requiredFields: string[]
  sampleExpectedValues?: Record<string, unknown>
  minimumConfidence?: number
  notes?: string
}

export type RouterEvalFixture = EvalBaseFixture & {
  mode: "router"
  input: {
    system: string
    user: string
  }
  outputSchema?: z.ZodTypeAny
}

export type FileExtractionEvalFixture = EvalBaseFixture & {
  mode: "file_extraction"
  input: {
    fileName: string
    mimeType: string
    bufferText: string
    systemPrompt: string
    userInstruction: string
  }
  outputSchema?: z.ZodTypeAny
}

export type AiEvalFixture = RouterEvalFixture | FileExtractionEvalFixture

export type EvalRunResult = {
  fixtureId: string
  task: AiTaskId
  promptVersion: number
  pass: boolean
  reason?: string
  provider?: string
  model?: string
  confidence?: number | null
  estimatedCostUsd?: number
}
