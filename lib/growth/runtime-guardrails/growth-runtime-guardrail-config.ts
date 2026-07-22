/** GS-RG-1 — centralized runtime guardrail limits (client-safe). */

import {
  PLATFORM_RUNTIME_DAILY_BUDGET_CAPS,
  PLATFORM_RUNTIME_DEFAULT_KILL_SWITCHES,
  PLATFORM_RUNTIME_GUARDRAIL_LIMITS,
  PLATFORM_RUNTIME_GUARDRAILS_QA_MARKER,
  PLATFORM_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION,
  PLATFORM_RUNTIME_HOURLY_BUDGET_CAPS,
  PLATFORM_RUNTIME_HOURLY_USER_BUDGET_CAPS,
  getPlatformBudgetCapForResource,
  getPlatformUserBudgetCapForResource,
  truncatePlatformSearchResults,
  type PlatformRuntimeBudgetWindowKind,
  type PlatformRuntimeKillSwitchKey,
  type PlatformRuntimeResourceType,
} from "@fuzor/configuration"

export const GROWTH_RUNTIME_GUARDRAILS_QA_MARKER = PLATFORM_RUNTIME_GUARDRAILS_QA_MARKER

export const GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION = PLATFORM_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION

/** Hard caps — every runtime feature must answer these before shipping. */
export const GROWTH_RUNTIME_GUARDRAIL_LIMITS = PLATFORM_RUNTIME_GUARDRAIL_LIMITS

export type GrowthRuntimeResourceType = PlatformRuntimeResourceType

export type GrowthRuntimeBudgetWindowKind = PlatformRuntimeBudgetWindowKind

export type GrowthRuntimeKillSwitchKey = PlatformRuntimeKillSwitchKey

export const GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES = PLATFORM_RUNTIME_DEFAULT_KILL_SWITCHES

/** Daily budget caps keyed by resource type. Zero = unlimited. */
export const GROWTH_RUNTIME_DAILY_BUDGET_CAPS = PLATFORM_RUNTIME_DAILY_BUDGET_CAPS

/** Hourly budget caps keyed by resource type. */
export const GROWTH_RUNTIME_HOURLY_BUDGET_CAPS = PLATFORM_RUNTIME_HOURLY_BUDGET_CAPS

/** Per-user hourly caps — evaluated AND org limits. */
export const GROWTH_RUNTIME_HOURLY_USER_BUDGET_CAPS = PLATFORM_RUNTIME_HOURLY_USER_BUDGET_CAPS

export function getBudgetCapForResource(
  resourceType: GrowthRuntimeResourceType,
  windowKind: GrowthRuntimeBudgetWindowKind,
): number {
  return getPlatformBudgetCapForResource(resourceType, windowKind)
}

export function getUserBudgetCapForResource(
  resourceType: GrowthRuntimeResourceType,
  windowKind: GrowthRuntimeBudgetWindowKind,
): number {
  return getPlatformUserBudgetCapForResource(resourceType, windowKind)
}

export function truncateSearchResults<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  return truncatePlatformSearchResults(rows)
}
