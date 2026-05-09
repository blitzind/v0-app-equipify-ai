import type { z } from "zod"
import type { PlanId } from "@/lib/plans"

/** Registered router tasks — extend `tasks.ts` when adding capabilities. */
export type AiTaskId =
  | "catalog_extraction"
  | "insights_generation"
  | "work_order_summary"
  | "dispatch_recommendation"
  | "quote_generation"
  | "invoice_summary"
  | "certificate_cleanup"
  | "maintenance_prediction"
  | "customer_email"
  | "workflow_builder"
  | "scheduling_assistant"
  | "OCR_cleanup"
  | "classification"
  | "tagging"
  | "inventory_operations"
  | "aiden_help"
  | "aiden_customer_summary"
  | "aiden_work_order_productivity"
  | "aiden_draft_generation"
  | "aiden_operational_recommendations"
  | "aiden_safe_action_prepare"

export type AiProviderId = "openai" | "anthropic" | "google" | "mock"

/** Relative spend envelope for observability and routing hints — primary models stay on cheaper tiers first. */
export type AiCostTier = "low" | "medium" | "high"

/** Capability tier for escalation (cheap → capable → strongest reasoning). */
export type AiModelTier = "fast" | "balanced" | "reasoning"

export type AiModelRef = {
  provider: AiProviderId
  /** Provider-native model id (e.g. gpt-4o-mini, claude-3-5-haiku-20241022, gemini-1.5-flash). */
  model: string
}

export type AiChatRole = "system" | "user" | "assistant"

export type AiTextPart = { type: "text"; text: string }

/** Multimodal parts — only some providers handle non-text (router forwards when supported). */
export type AiContentPart = AiTextPart | { type: "image_url"; image_url: { url: string } }

export type AiChatMessage = {
  role: AiChatRole
  content: string | AiContentPart[]
}

export type AiTaskInput = {
  messages?: AiChatMessage[]
  /** Single-turn shorthand (converted to messages). */
  system?: string
  user?: string
}

export type AiStructuredMode = "none" | "json_object" | "json_schema"

export type AiTaskDefinition = {
  id: AiTaskId
  /** Human-readable label for logs and dashboards. */
  label: string
  costTier: AiCostTier
  modelTier: AiModelTier
  /** Start here — cheapest acceptable quality for this task. */
  primaryModel: AiModelRef
  /** Same tier / alternate provider before spending on escalation. */
  fallbackModel: AiModelRef
  /** Used when parse invalid, low confidence, or caller rejects result. */
  escalationModel: AiModelRef
  temperature: number
  maxOutputTokens: number
  structuredMode: AiStructuredMode
  timeoutMs: number
  /** Retries for transport / rate-limit — not parse retries (handled by escalation). */
  maxRetries: number
  /** When structured JSON includes a numeric confidence, escalate if below this. */
  confidenceThreshold: number | null
  /** When true, identical normalized inputs may return cached results (see router + TTL). */
  cacheable?: boolean
  /**
   * Privacy guard: response payload caching is allowed only for explicitly safe tasks.
   * Defaults to false when omitted.
   */
  allowResponseCaching?: boolean
  /** TTL for cached rows; null = no expiry. */
  cacheTtlSeconds?: number | null
  /** Minimum subscription tier that may invoke this task (see `lib/ai/plan-ai-config.ts`). */
  requiredPlan?: PlanId
  /** When set, only these exact plans may invoke (overrides tier ladder with explicit allowlist). */
  enabledPlans?: PlanId[]
  /** Max logged AI rows per calendar month for this task (org-scoped); null = unlimited. */
  monthlyRequestLimit?: number | null
  /** Max estimated spend (cents USD) MTD for this task; null = unlimited. */
  monthlyCostLimitCents?: number | null
  /**
   * When set, prompts load from `lib/ai/prompts` via `getPromptForTask(id)`.
   * Version/schema come from the registry row, not this object.
   */
  promptId?: string
}

export type EscalationReason =
  | "transport_error"
  | "timeout"
  | "invalid_json"
  | "schema_rejected"
  | "low_confidence"
  | "caller_rejected"
  /** Monthly org AI budget exceeded (block mode). */
  | "budget_exceeded"
  /** Subscription plan does not include this task or plan limits exceeded. */
  | "plan_blocked"

export type AiUsageTotals = {
  promptTokens: number
  completionTokens: number
  estimatedCostUsd: number
}

export type AiRunMeta = {
  task: AiTaskId
  provider: AiProviderId
  model: string
  escalated: boolean
  escalationReasons: EscalationReason[]
  attempts: number
  durationMs: number
  /** Result served from ai_cache without calling the provider. */
  cacheHit?: boolean
  /** Trial simulation — callers must not persist side effects (e.g. pending workspace actions). */
  trialAiPreview?: boolean
}

export type AiTaskSuccess<T> = {
  ok: true
  output: T
  rawText: string
  usage: AiUsageTotals
  meta: AiRunMeta
}

export type AiTaskFailure = {
  ok: false
  error: Error
  usage: AiUsageTotals
  meta: Omit<AiRunMeta, "escalated"> & { escalated: boolean; escalationReasons: EscalationReason[] }
}

export type AiTaskResult<T = string> = AiTaskSuccess<T> | AiTaskFailure

export type RunAiTaskOptions<T = string> = {
  task: AiTaskId
  organizationId: string
  input: AiTaskInput
  /** Strong typing / validation for structured outputs. */
  schema?: z.ZodType<T>
  /**
   * After schema parse, return false to escalate (e.g. incomplete extraction).
   * Ignored when no schema (string output).
   */
  acceptResult?: (data: T, rawText: string) => boolean | Promise<boolean>
  /** Deep-merge overrides for experiments or emergency tuning. */
  taskOverrides?: Partial<AiTaskDefinition>
  /** Skip persistence (tests / scripts). */
  skipUsageLog?: boolean
  /** Skip organization monthly budget enforcement (non–org-scoped / platform flows). */
  skipBudgetCheck?: boolean
  /** Skip subscription plan / per-task limit checks (tests / platform overrides). */
  skipPlanGateCheck?: boolean
  /** Skip ai_cache lookup/write (debug / emergency). */
  skipCache?: boolean
  /** Stable extras folded into input hash (e.g. file_sha256 for extraction-aligned tasks). */
  cacheKeyExtras?: Record<string, string>
  /** Bump when the Zod schema or prompt contract changes for the same task id. */
  cacheSchemaVersion?: string
  /** Pin a registry prompt `version` (defaults to active). */
  promptVersionOverride?: number
  /** Skip trial simulation / execution resolver (evals and scripts). */
  skipExecutionModeMock?: boolean
  /** Platform-admin-only: force live providers when resolver allows (see `resolveAiExecutionMode`). */
  forceLiveAi?: boolean
  /** Authenticated user email for admin-only force-live resolution. */
  actingUserEmail?: string | null
}

/** Unified provider completion contract — implemented per vendor in `providers/`. */
export type UnifiedCompletionRequest = {
  model: string
  messages: AiChatMessage[]
  temperature: number
  maxOutputTokens: number
  structuredMode: AiStructuredMode
  /** OpenAI json_schema name when structuredMode is json_schema (optional future use). */
  jsonSchemaName?: string
  timeoutMs: number
  maxRetries: number
}

export type UnifiedCompletionResponse = {
  text: string
  promptTokens: number
  completionTokens: number
  finishReason?: string | null
}

export type AiProviderAdapter = {
  id: AiProviderId
  complete(req: UnifiedCompletionRequest): Promise<UnifiedCompletionResponse>
  /** If false, multimodal messages may need OpenAI-specific paths until extended. */
  supportsMultimodal: boolean
}
