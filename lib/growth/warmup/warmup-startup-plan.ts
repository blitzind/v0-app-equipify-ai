/**
 * Pure warmup startup planning (client-safe).
 */

export type WarmupStartupPlan =
  | "create_and_generate"
  | "generate_existing_new"
  | "already_active"

export function resolveWarmupStartupPlan(
  existing: { status: string; scheduleLength: number } | null,
): WarmupStartupPlan {
  if (!existing) return "create_and_generate"

  const status = existing.status.trim().toLowerCase()
  if (status === "warming" || status === "active") return "already_active"
  if (status === "new") return "generate_existing_new"
  if (status === "paused" && existing.scheduleLength === 0) return "generate_existing_new"
  return "already_active"
}
