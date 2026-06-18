import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import { getOrganizationPlanDisplayFromWorkspace } from "@/lib/billing/get-organization-plan-display"
import type { TenantWorkspace } from "@/lib/tenant-data"

/**
 * Sidebar / chrome tier labels — aligned with `organization_subscriptions.plan_id`.
 * Legacy `starter` → Solo. Colors use `globals.css` tokens for Solo (purple) and Scale (brand gold / `--cta`).
 */
export const PLAN_BADGE_META: Record<string, { label: string; color: string }> = {
  solo: { label: "Solo", color: "var(--plan-solo-accent)" },
  starter: { label: "Solo", color: "var(--plan-solo-accent)" },
  core: { label: "Core", color: "#6366f1" },
  growth: { label: "Growth", color: "#3b82f6" },
  scale: { label: "Scale", color: "var(--plan-scale-accent)" },
  enterprise: { label: "Enterprise", color: "var(--plan-scale-accent)" },
}

/**
 * User-facing plan name from DB `plan_id` (`starter` and `solo` both → "Solo").
 * Does not mutate stored values.
 */
export function planTierLabelFromDbPlanId(planId: string | null | undefined): string {
  if (planId == null || String(planId).trim() === "") return "—"
  const p = String(planId).trim().toLowerCase()
  if (p === "enterprise") return "Enterprise"
  const nid = normalizePlanIdForRead(planId)
  return PLAN_BADGE_META[nid]?.label ?? String(planId).trim()
}

const MUTED = { label: "No plan", color: "#64748b" }

export function planBadgeFromWorkspace(workspace: TenantWorkspace): { label: string; color: string } {
  const sub = workspace.organizationSubscription

  if (sub === undefined) {
    const id = normalizePlanIdForRead(workspace.planId)
    const meta = PLAN_BADGE_META[id] ?? MUTED
    return {
      ...meta,
      label: getOrganizationPlanDisplayFromWorkspace(workspace),
    }
  }

  if (sub === null) return { ...MUTED, label: "Equipify" }

  const id = normalizePlanIdForRead(sub.planId)
  const meta = PLAN_BADGE_META[id] ?? { label: id, color: "#64748b" }
  const trialing = String(sub.status).toLowerCase() === "trialing"
  const branded = getOrganizationPlanDisplayFromWorkspace(workspace)
  return {
    ...meta,
    label: trialing ? `${branded} Trial` : branded,
  }
}
