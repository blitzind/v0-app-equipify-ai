import type { AiModelRef, AiProviderId, AiTaskId } from "@/lib/ai/types"

export type AiEnvConfig = {
  /** Default order when a task does not fix provider — first enabled wins for primary slot keys are unchanged but router uses task's ModelRef first. */
  providerPreference: AiProviderId[]
  enabledProviders: Set<AiProviderId>
  /** GLOBAL_MODEL_OVERRIDE=gpt-4o-mini — applies to all tasks' model id when provider matches openai (escape hatch). */
  globalModelOverride: string | null
  /** Per-task model id override for primary model only (same provider as task). Keys: CATALOG_EXTRACTION -> env AI_MODEL_OVERRIDE_catalog_extraction */
  taskModelOverrides: Partial<Record<AiTaskId, string>>
  /** Future: AI_BILLING_SOFT_CAP_USD_PER_MONTH */
  debug: boolean
}

function parseProviderList(raw: string | undefined, fallback: AiProviderId[]): AiProviderId[] {
  if (!raw?.trim()) return fallback
  const all: AiProviderId[] = ["openai", "anthropic", "google"]
  const set = new Set<AiProviderId>()
  for (const part of raw.split(",")) {
    const p = part.trim().toLowerCase()
    if (p === "openai" || p === "anthropic" || p === "google") set.add(p)
  }
  return set.size > 0 ? [...set] : fallback
}

function parseEnabledProviders(raw: string | undefined): Set<AiProviderId> {
  const preferred = parseProviderList(process.env.AI_PROVIDER_ORDER, ["openai", "anthropic", "google"])
  if (!raw?.trim()) return new Set(preferred)
  const enabled = new Set<AiProviderId>()
  for (const part of raw.split(",")) {
    const p = part.trim().toLowerCase()
    if (p === "openai" || p === "anthropic" || p === "google") enabled.add(p)
  }
  return enabled.size > 0 ? enabled : new Set(preferred)
}

/** Maps env suffix to task id (upper snake of task id). */
function taskEnvKey(task: AiTaskId): string {
  return task.toUpperCase().replace(/-/g, "_")
}

function loadTaskOverrides(): Partial<Record<AiTaskId, string>> {
  const tasks: AiTaskId[] = [
    "catalog_extraction",
    "insights_generation",
    "work_order_summary",
    "dispatch_recommendation",
    "quote_generation",
    "invoice_summary",
    "certificate_cleanup",
    "maintenance_prediction",
    "customer_email",
    "workflow_builder",
    "scheduling_assistant",
    "OCR_cleanup",
    "classification",
    "tagging",
    "inventory_operations",
    "aiden_help",
    "aiden_customer_summary",
    "aiden_work_order_productivity",
    "aiden_draft_generation",
  ]
  const out: Partial<Record<AiTaskId, string>> = {}
  for (const t of tasks) {
    const envKey = `AI_MODEL_OVERRIDE_${taskEnvKey(t)}`
    const v = process.env[envKey]?.trim()
    if (v) out[t] = v
  }
  return out
}

let cached: AiEnvConfig | null = null

export function getAiEnvConfig(): AiEnvConfig {
  if (cached) return cached
  cached = {
    providerPreference: parseProviderList(process.env.AI_PROVIDER_ORDER, ["openai", "anthropic", "google"]),
    enabledProviders: parseEnabledProviders(process.env.AI_ENABLED_PROVIDERS),
    globalModelOverride: process.env.AI_GLOBAL_MODEL_OVERRIDE?.trim() || null,
    taskModelOverrides: loadTaskOverrides(),
    debug: process.env.AI_DEBUG === "1" || process.env.NODE_ENV === "development",
  }
  return cached
}

export function isProviderEnabled(id: AiProviderId): boolean {
  return getAiEnvConfig().enabledProviders.has(id)
}

/** Apply global AI_GLOBAL_MODEL_OVERRIDE when no per-task override (OpenAI ids only). */
export function resolveOpenAiModelId(baseModel: string): string {
  const { globalModelOverride } = getAiEnvConfig()
  return globalModelOverride?.trim() || baseModel
}

/** Per-task / global env overrides for the primary model slot. */
export function applyPrimaryModelRef(task: AiTaskId, ref: AiModelRef): AiModelRef {
  const perTask = getAiEnvConfig().taskModelOverrides[task]?.trim()
  if (perTask) return { ...ref, model: perTask }
  if (ref.provider === "openai") return { ...ref, model: resolveOpenAiModelId(ref.model) }
  return ref
}
