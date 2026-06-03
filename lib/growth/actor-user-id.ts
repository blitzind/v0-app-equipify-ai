/** Client-safe helpers for Growth Engine actor_user_id UUID columns. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const GROWTH_CRON_ACTOR_EMAIL = "cron@growth.equipify.internal"

export function isGrowthActorUserIdUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim())
}

/** Never persist cron placeholders like "system" into uuid columns. */
export function normalizeGrowthActorUserIdForDb(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed || trimmed === "system") return null
  return isGrowthActorUserIdUuid(trimmed) ? trimmed : null
}

export function resolveGrowthActorForDb(input?: {
  actorUserId?: unknown
  actorEmail?: string | null
}): { actorUserId: string | null; actorEmail: string | null } {
  const actorEmail = input?.actorEmail?.trim() || GROWTH_CRON_ACTOR_EMAIL
  return {
    actorUserId: normalizeGrowthActorUserIdForDb(input?.actorUserId),
    actorEmail,
  }
}
