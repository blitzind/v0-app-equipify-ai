/**
 * GE-AI-UX-1B — Customer-facing AI OS workspace branding (UI only).
 * Internal routes, schema, APIs, and code identifiers remain unchanged.
 */

import { getOrganizationPlanDisplay, type OrganizationPlanDisplayInput } from "@/lib/billing/get-organization-plan-display"

export const GE_AI_UX_1B_QA_MARKER = "ge-ai-ux-1b-ai-os-branding-workspace-architecture-v1" as const

/** Workspace name shown in switcher, sidebar, and breadcrumbs. */
export const AI_OS_WORKSPACE_LABEL = "AI OS" as const

/** Primary landing nav label for `/growth`. */
export const AI_OS_HOME_NAV_LABEL = "Home" as const

/** Breadcrumb root for AI OS workspace routes. */
export const AI_OS_BREADCRUMB_ROOT_LABEL = AI_OS_WORKSPACE_LABEL

/** Sidebar footer workspace indicator (replaces "Workspace Active"). */
export const AI_OS_SIDEBAR_WORKSPACE_INDICATOR_LABEL = "Workspace" as const

/** Advanced nav grouping for engineering / diagnostics surfaces. */
export const AI_OS_ADVANCED_NAV_GROUP_LABEL = "Advanced" as const

/**
 * Subscription tier short label for workspace switcher left pill (Plan | AI OS).
 * Uses existing plan resolution — strips branded "Equipify " prefix when present.
 */
export function getSubscriptionPlanShortDisplay(input: OrganizationPlanDisplayInput = {}): string {
  const branded = getOrganizationPlanDisplay(input)
  if (branded.startsWith("Equipify ")) {
    return branded.slice("Equipify ".length)
  }
  return branded
}

/** Customer-facing strings that must NOT appear in operator chrome (audit helper). */
export const AI_OS_DEPRECATED_OPERATOR_LABELS = [
  "Growth Engine",
  "Workspace Active",
  "Growth Dashboard",
  "Growth Workspace",
] as const
