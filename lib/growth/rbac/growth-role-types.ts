/** GS-RBAC-1A — Growth Engine operator access roles (least → most privilege). */
export const GROWTH_ROLES = ["growth_operator", "growth_manager", "platform_admin"] as const

export type GrowthRole = (typeof GROWTH_ROLES)[number]

export const GROWTH_ROLE_LABELS: Record<GrowthRole, string> = {
  growth_operator: "Growth Operator",
  growth_manager: "Growth Manager",
  platform_admin: "Platform Admin",
}

export const GROWTH_ROLE_RANK: Record<GrowthRole, number> = {
  growth_operator: 1,
  growth_manager: 2,
  platform_admin: 3,
}

export function growthRoleMeetsMinimum(role: GrowthRole, minimumRole: GrowthRole): boolean {
  return GROWTH_ROLE_RANK[role] >= GROWTH_ROLE_RANK[minimumRole]
}

export function isGrowthRole(value: string | null | undefined): value is GrowthRole {
  return typeof value === "string" && (GROWTH_ROLES as readonly string[]).includes(value)
}
