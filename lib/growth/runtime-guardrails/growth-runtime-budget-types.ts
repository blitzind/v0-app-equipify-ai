/** GS-RG-1 — runtime budget row types (client-safe). */

import type {
  GrowthRuntimeBudgetWindowKind,
  GrowthRuntimeResourceType,
} from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export type GrowthRuntimeBudgetRow = {
  id: string
  organizationId: string
  resourceType: GrowthRuntimeResourceType
  windowKind: GrowthRuntimeBudgetWindowKind
  windowStart: string
  count: number
  updatedAt: string
}

export type GrowthRuntimeBudgetConsumeResult = {
  allowed: boolean
  consumed: number
  remaining: number
  cap: number
  reason: string | null
}

export type GrowthOrganizationBudgetSnapshot = {
  organizationId: string
  budgets: Array<{
    resourceType: GrowthRuntimeResourceType
    windowKind: GrowthRuntimeBudgetWindowKind
    count: number
    cap: number
    remaining: number
  }>
}
