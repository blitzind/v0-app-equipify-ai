import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { TenantWorkspace } from "@/lib/tenant-data"

/** Sidebar / chrome tier labels — aligned with `organization_subscriptions.plan_id`. Legacy `starter` → Solo. */
export const PLAN_BADGE_META: Record<string, { label: string; color: string }> = {
  solo: { label: "Solo", color: "#f59e0b" },
  starter: { label: "Solo", color: "#f59e0b" },
  core: { label: "Core", color: "#6366f1" },
  growth: { label: "Growth", color: "#3b82f6" },
  scale: { label: "Scale", color: "#8b5cf6" },
  enterprise: { label: "Enterprise", color: "#8b5cf6" },
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
    return PLAN_BADGE_META[id] ?? MUTED
  }

  if (sub === null) return MUTED

  const id = normalizePlanIdForRead(sub.planId)
  const meta = PLAN_BADGE_META[id] ?? { label: id, color: "#64748b" }
  const trialing = String(sub.status).toLowerCase() === "trialing"
  return {
    ...meta,
    label: trialing ? `${meta.label} Trial` : meta.label,
  }
}
