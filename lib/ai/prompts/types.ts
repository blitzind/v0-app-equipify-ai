import type { AiTaskId } from "@/lib/ai/types"

/** One immutable prompt revision (DB-backed governance can come later). */
export type AiPromptDefinition = {
  promptId: string
  version: number
  task: AiTaskId
  systemPrompt: string
  /** Use `{{varName}}` placeholders; see `applyUserPromptTemplate`. */
  userPromptTemplate: string
  /** Short human summary of expected model output shape (not sent to the model). */
  outputFormatNotes: string
  /** Bumped when the Zod / JSON contract changes for this prompt family. */
  schemaVersion: string
  changelog: string
  active: boolean
}

export type ResolvedAiPrompt = AiPromptDefinition

export type GetPromptOptions = {
  /** Pin a registry version (tests / experiments). Default: sole active row for `promptId`. */
  version?: number
}
