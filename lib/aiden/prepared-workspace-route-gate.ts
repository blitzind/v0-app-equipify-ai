import type { OrgPermissions } from "@/lib/permissions/model"

/**
 * Session context from authenticated prepared-workspace routes so resolvers re-check **plan/tier**
 * consistently with the API (including platform-admin synthetic plan evaluation).
 */
export type AidenPreparedWorkspaceRouteGate = {
  /** Effective session permissions (owner-equivalent for platform admins on org routes). */
  sessionPermissions?: OrgPermissions
  /** When true, plan / tier checks use a synthetic Scale paid evaluation after permissions pass. */
  platformAdminPlanBypass?: boolean
}
