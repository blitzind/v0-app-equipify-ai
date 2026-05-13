/**
 * Industry-aware relative weights for operational health rollup.
 * Values are importance multipliers before normalization to sum to 1.
 */
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import {
  OPERATIONAL_HEALTH_CATEGORY_IDS,
  type OperationalHealthCategoryId,
} from "@/lib/aiden/operational-health-score-types"

export type OperationalHealthWeightTemplate = Record<OperationalHealthCategoryId, number>

const BASE: OperationalHealthWeightTemplate = {
  preventive_maintenance_health: 1.15,
  asset_readiness: 1,
  dispatch_efficiency: 1.15,
  inspection_compliance: 1.05,
  operational_responsiveness: 1.1,
  work_order_backlog_health: 1.1,
  financial_workflow_completion: 0.85,
}

/** Multipliers merged with BASE then normalized. */
const INDUSTRY_MULTIPLIERS: Partial<Record<WorkspaceIndustryKey, Partial<Record<OperationalHealthCategoryId, number>>>> = {
  equipment_rental: {
    asset_readiness: 1.45,
    inspection_compliance: 1.35,
    work_order_backlog_health: 1.35,
    dispatch_efficiency: 1.15,
    preventive_maintenance_health: 0.95,
    financial_workflow_completion: 0.9,
  },
  refrigeration_service: {
    dispatch_efficiency: 1.35,
    preventive_maintenance_health: 1.35,
    work_order_backlog_health: 1.2,
    operational_responsiveness: 1.05,
    asset_readiness: 0.95,
  },
  generator_power: {
    inspection_compliance: 1.4,
    preventive_maintenance_health: 1.25,
    operational_responsiveness: 1.05,
    dispatch_efficiency: 1,
    asset_readiness: 0.9,
  },
  calibration_inspection: {
    inspection_compliance: 1.4,
    preventive_maintenance_health: 1.15,
    financial_workflow_completion: 1.1,
    work_order_backlog_health: 1.05,
    asset_readiness: 0.9,
  },
  material_handling: {
    inspection_compliance: 1.35,
    preventive_maintenance_health: 1.2,
    asset_readiness: 1.1,
    dispatch_efficiency: 1.05,
  },
  hvac_r: {
    dispatch_efficiency: 1.35,
    preventive_maintenance_health: 1.2,
    operational_responsiveness: 1.1,
    work_order_backlog_health: 1.05,
  },
  fleet_mobile_equipment: {
    dispatch_efficiency: 1.3,
    asset_readiness: 1.2,
    inspection_compliance: 1.1,
  },
  biomedical_medical_equipment: {
    inspection_compliance: 1.35,
    preventive_maintenance_health: 1.25,
    operational_responsiveness: 1.05,
  },
}

export function computeOperationalHealthWeights(
  industryKey: WorkspaceIndustryKey | null,
  includedCategories: OperationalHealthCategoryId[],
): Record<OperationalHealthCategoryId, number> {
  const key = industryKey ?? "field_service"
  const mult = { ...BASE, ...(INDUSTRY_MULTIPLIERS[key] ?? {}) }
  const raw: Partial<Record<OperationalHealthCategoryId, number>> = {}
  for (const id of OPERATIONAL_HEALTH_CATEGORY_IDS) {
    if (!includedCategories.includes(id)) continue
    raw[id] = mult[id] ?? 1
  }
  let sum = 0
  for (const id of includedCategories) {
    sum += raw[id] ?? 0
  }
  const out = {} as Record<OperationalHealthCategoryId, number>
  if (sum <= 0) {
    const even = 1 / Math.max(1, includedCategories.length)
    for (const id of OPERATIONAL_HEALTH_CATEGORY_IDS) {
      out[id] = includedCategories.includes(id) ? even : 0
    }
    return out
  }
  for (const id of OPERATIONAL_HEALTH_CATEGORY_IDS) {
    out[id] = includedCategories.includes(id) ? (raw[id] ?? 0) / sum : 0
  }
  return out
}

export function industryHealthWeightingSummary(industryKey: WorkspaceIndustryKey | null): string {
  if (!industryKey) {
    return "Weights use the generic field-service template because no workspace vertical is selected in organization settings."
  }
  const o = INDUSTRY_MULTIPLIERS[industryKey]
  if (!o) {
    return `Weights use the baseline mix adjusted lightly for ${industryKey.replace(/_/g, " ")}.`
  }
  const top = Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k.replace(/_/g, " "))
  return `Industry template emphasizes ${top.join(", ")} relative to other categories.`
}
