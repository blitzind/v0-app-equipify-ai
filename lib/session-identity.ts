import type { GrowthRole } from "@/lib/growth/rbac/growth-role-types"

/** Signed-in user snapshot for headers / admin UI (not tenant mock data). */
export type SessionIdentity = {
  /** Supabase auth.users.id — must match the current session user. */
  authUserId: string
  email: string
  displayName: string
  platformAdmin: boolean
  /** Human-readable role label for Growth / platform surfaces. */
  platformRoleLabel: string | null
  /** Resolved Growth Engine role when signed into Growth workspace. */
  growthRole?: GrowthRole
}
