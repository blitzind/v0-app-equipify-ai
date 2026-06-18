import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { PlanId } from "@/lib/plans"

const BRANDED_PLAN_NAMES: Record<PlanId, string> = {
  solo: "Equipify Solo",
  core: "Equipify Core",
  growth: "Equipify Growth",
  scale: "Equipify Scale",
}

function isKnownDisplayPlanId(raw: string): boolean {
  return (
    raw === "solo" ||
    raw === "core" ||
    raw === "growth" ||
    raw === "scale" ||
    raw === "starter" ||
    raw === "enterprise"
  )
}

export type EquipifyPlanDisplayNameInput = {
  planId?: string | null
  effectivePlanId?: string | null
}

/**
 * User-facing branded plan label (Option A). Pure function — no I/O.
 * `enterprise` is handled from raw `planId` only (not a catalog {@link PlanId}).
 */
export function getEquipifyPlanDisplayName(input: EquipifyPlanDisplayNameInput = {}): string {
  const raw = String(input.planId ?? "").trim().toLowerCase()
  if (raw === "enterprise") return "Equipify Enterprise"

  const hasPlanInput =
    raw.length > 0 || String(input.effectivePlanId ?? "").trim().length > 0
  if (!hasPlanInput) return "Equipify"
  if (raw && !isKnownDisplayPlanId(raw)) return "Equipify"

  const effective = input.effectivePlanId ?? normalizePlanIdForRead(input.planId)
  const normalized = normalizePlanIdForRead(effective)
  return BRANDED_PLAN_NAMES[normalized] ?? "Equipify"
}
