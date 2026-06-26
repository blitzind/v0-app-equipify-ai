/**
 * GS-RBAC-1A — Central route → minimum Growth role matrix for `/growth/*` pages
 * and Growth API prefixes. First matching rule wins (most specific rules first).
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import type { GrowthRole } from "@/lib/growth/rbac/growth-role-types"
import { growthRoleMeetsMinimum } from "@/lib/growth/rbac/growth-role-types"

export const GROWTH_RBAC_ROUTE_MATRIX_QA_MARKER = "growth-rbac-route-matrix-1a-v1" as const

export type GrowthRouteAccessRule = {
  id: string
  pattern: RegExp
  minimumRole: GrowthRole
  label: string
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.trim()
  if (!trimmed) return "/"
  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1)
  }
  return withoutQuery
}

/** Platform-admin-only Growth workspace surfaces (certification blockers for operators). */
const GROWTH_PLATFORM_ADMIN_PAGE_RULES: GrowthRouteAccessRule[] = [
  {
    id: "admin-runtime",
    pattern: /^\/growth\/admin(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Admin Runtime",
  },
  {
    id: "compliance-admin",
    pattern: /^\/growth\/settings\/compliance(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Compliance Admin",
  },
  {
    id: "autonomy-admin",
    pattern: /^\/growth\/settings\/autonomy(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Autonomy Settings",
  },
  {
    id: "advanced-admin",
    pattern: /^\/growth\/settings\/advanced(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Advanced Settings",
  },
  {
    id: "delivery-admin",
    pattern: /^\/growth\/settings\/delivery(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Delivery Settings",
  },
  {
    id: "workspace-platform-settings",
    pattern: /^\/growth\/settings\/workspace(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Platform Workspace Settings",
  },
  {
    id: "provider-health",
    pattern: /^\/growth\/settings\/provider-health(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Provider Health",
  },
  {
    id: "inbox-diagnostics",
    pattern: /^\/growth\/inbox\/operations(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Inbox Diagnostics",
  },
  {
    id: "communications-infrastructure",
    pattern:
      /^\/growth\/settings\/communications\/(?:sender-pools|sending-domains|warmup|deliverability|reputation|mailboxes\/onboard)(?:\/|$)/,
    minimumRole: "platform_admin",
    label: "Provider Infrastructure",
  },
]

/** Manager-only workspace surfaces (certification targets). */
const GROWTH_MANAGER_PAGE_RULES: GrowthRouteAccessRule[] = [
  {
    id: "automation",
    pattern: /^\/growth\/automation(?:\/|$)/,
    minimumRole: "growth_manager",
    label: "Automation",
  },
  {
    id: "campaign-sequences",
    pattern: /^\/growth\/campaigns\/sequences(?:\/|$)/,
    minimumRole: "growth_manager",
    label: "Sequences",
  },
  {
    id: "performance-analytics",
    pattern: /^\/growth\/(?:videos\/analytics|videos\/personalized\/analytics|sendr\/analytics)(?:\/|$)/,
    minimumRole: "growth_manager",
    label: "Performance Analytics",
  },
  {
    id: "communications-configuration",
    pattern: /^\/growth\/settings\/communications(?:\/|$)/,
    minimumRole: "growth_manager",
    label: "Communications Configuration",
  },
]

/** Operator-accessible workspace surfaces (explicit for certification). */
const GROWTH_OPERATOR_PAGE_RULES: GrowthRouteAccessRule[] = [
  {
    id: "dashboard",
    pattern: /^\/growth$/,
    minimumRole: "growth_operator",
    label: "Dashboard",
  },
  {
    id: "leads",
    pattern: /^\/growth\/leads(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Leads",
  },
  {
    id: "inbox",
    pattern: /^\/growth\/inbox(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Inbox",
  },
  {
    id: "calls",
    pattern: /^\/growth\/calls(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Calls",
  },
  {
    id: "meetings",
    pattern: /^\/growth\/meetings(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Meetings",
  },
  {
    id: "opportunities",
    pattern: /^\/growth\/opportunities(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Opportunities",
  },
  {
    id: "activity",
    pattern: /^\/growth\/activity(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Activity",
  },
  {
    id: "engagement",
    pattern: /^\/growth\/engagement(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Engagement",
  },
  {
    id: "ai-operations",
    pattern: /^\/growth\/os(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "AI Operations",
  },
  {
    id: "audiences",
    pattern: /^\/growth\/audiences(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Audiences",
  },
  {
    id: "campaigns",
    pattern: /^\/growth\/campaigns(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Campaigns",
  },
  {
    id: "personal-settings",
    pattern: /^\/growth\/settings(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Personal Settings",
  },
  {
    id: "growth-workspace-default",
    pattern: /^\/growth(?:\/|$)/,
    minimumRole: "growth_operator",
    label: "Growth Workspace",
  },
]

export const GROWTH_WORKSPACE_PAGE_ACCESS_RULES: GrowthRouteAccessRule[] = [
  ...GROWTH_PLATFORM_ADMIN_PAGE_RULES,
  ...GROWTH_MANAGER_PAGE_RULES,
  ...GROWTH_OPERATOR_PAGE_RULES,
]

/** Platform-admin-only Growth API prefixes (certification blockers for managers). */
const GROWTH_PLATFORM_ADMIN_API_RULES: GrowthRouteAccessRule[] = [
  { id: "api-providers", pattern: /^\/api\/platform\/growth\/providers(?:\/|$)/, minimumRole: "platform_admin", label: "Providers API" },
  { id: "api-provider-setup", pattern: /^\/api\/platform\/growth\/provider-setup(?:\/|$)/, minimumRole: "platform_admin", label: "Provider Setup API" },
  { id: "api-governance", pattern: /^\/api\/platform\/growth\/governance(?:\/|$)/, minimumRole: "platform_admin", label: "Governance API" },
  { id: "api-compliance", pattern: /^\/api\/platform\/growth\/compliance(?:\/|$)/, minimumRole: "platform_admin", label: "Compliance API" },
  { id: "api-runtime", pattern: /^\/api\/platform\/growth\/runtime(?:\/|$)/, minimumRole: "platform_admin", label: "Runtime API" },
  { id: "api-dogfood", pattern: /^\/api\/platform\/growth\/dogfood(?:\/|$)/, minimumRole: "platform_admin", label: "Dogfood API" },
  { id: "api-experiments", pattern: /^\/api\/platform\/growth\/experiments(?:\/|$)/, minimumRole: "platform_admin", label: "Experiments API" },
  { id: "api-deliverability-admin", pattern: /^\/api\/platform\/growth\/deliverability(?:\/|$)/, minimumRole: "platform_admin", label: "Deliverability API" },
  { id: "api-deliverability-ops", pattern: /^\/api\/platform\/growth\/deliverability-ops(?:\/|$)/, minimumRole: "platform_admin", label: "Deliverability Ops API" },
  { id: "api-mailboxes", pattern: /^\/api\/platform\/growth\/mailboxes(?:\/|$)/, minimumRole: "platform_admin", label: "Mailboxes API" },
  { id: "api-warmup", pattern: /^\/api\/platform\/growth\/warmup(?:\/|$)/, minimumRole: "platform_admin", label: "Warmup API" },
  { id: "api-suppression", pattern: /^\/api\/platform\/growth\/suppression(?:\/|$)/, minimumRole: "platform_admin", label: "Suppression API" },
  { id: "api-operations-outbound", pattern: /^\/api\/platform\/growth\/operations(?:\/|$)/, minimumRole: "platform_admin", label: "Outbound Operations API" },
  { id: "api-import-batches", pattern: /^\/api\/platform\/growth\/import-batches(?:\/|$)/, minimumRole: "platform_admin", label: "Import Batches API" },
  { id: "api-acquisition", pattern: /^\/api\/platform\/growth\/acquisition(?:\/|$)/, minimumRole: "platform_admin", label: "Acquisition API" },
  { id: "api-apollo", pattern: /^\/api\/platform\/growth\/apollo(?:\/|$)/, minimumRole: "platform_admin", label: "Apollo Pilot API" },
  { id: "api-realtime-providers", pattern: /^\/api\/platform\/growth\/realtime\/providers(?:\/|$)/, minimumRole: "platform_admin", label: "Realtime Providers API" },
  { id: "api-browser-intake", pattern: /^\/api\/platform\/growth\/browser-intake(?:\/|$)/, minimumRole: "platform_admin", label: "Browser Intake API" },
  { id: "api-intent-pixel", pattern: /^\/api\/platform\/growth\/intent-pixel(?:\/|$)/, minimumRole: "platform_admin", label: "Intent Pixel API" },
  { id: "api-identity-evidence", pattern: /^\/api\/platform\/growth\/human-identity-evidence(?:\/|$)/, minimumRole: "platform_admin", label: "Identity Evidence API" },
  { id: "api-canonical-backfill", pattern: /^\/api\/platform\/growth\/canonical-(?:persons|companies)(?:\/|$)/, minimumRole: "platform_admin", label: "Canonical Backfill API" },
  { id: "api-outbound-cutover", pattern: /^\/api\/platform\/growth\/outbound\/cutover-status(?:\/|$)/, minimumRole: "platform_admin", label: "Outbound Cutover API" },
  { id: "api-communication-settings", pattern: /^\/api\/platform\/growth\/communication-settings(?:\/|$)/, minimumRole: "platform_admin", label: "Communication Settings API" },
  { id: "api-observability", pattern: /^\/api\/platform\/growth\/runtime\/observability(?:\/|$)/, minimumRole: "platform_admin", label: "Runtime Observability API" },
  { id: "api-provider-health", pattern: /^\/api\/platform\/growth\/prospect-search\/provider-health(?:\/|$)/, minimumRole: "platform_admin", label: "Provider Health API" },
  { id: "api-sequences-scheduler", pattern: /^\/api\/platform\/growth\/sequences\/scheduler(?:\/|$)/, minimumRole: "platform_admin", label: "Sequence Scheduler API" },
]

const GROWTH_MANAGER_API_RULES: GrowthRouteAccessRule[] = [
  { id: "api-automation", pattern: /^\/api\/platform\/growth\/automation(?:\/|$)/, minimumRole: "growth_manager", label: "Automation API" },
  { id: "api-automation-runtime", pattern: /^\/api\/platform\/growth\/automation-runtime(?:\/|$)/, minimumRole: "growth_manager", label: "Automation Runtime API" },
  { id: "api-campaign-builder", pattern: /^\/api\/platform\/growth\/campaign-builder(?:\/|$)/, minimumRole: "growth_manager", label: "Campaign Builder API" },
  { id: "api-audiences", pattern: /^\/api\/platform\/growth\/audiences(?:\/|$)/, minimumRole: "growth_manager", label: "Audiences API" },
  { id: "api-assignment-settings", pattern: /^\/api\/platform\/growth\/assignment\/(?:settings|reps)(?:\/|$)/, minimumRole: "growth_manager", label: "Assignment Admin API" },
  { id: "api-follow-up-policies", pattern: /^\/api\/platform\/growth\/follow-up-policies(?:\/|$)/, minimumRole: "growth_manager", label: "Follow-up Policies API" },
  { id: "api-booking-routing", pattern: /^\/api\/platform\/growth\/booking-intelligence\/routing-rules(?:\/|$)/, minimumRole: "growth_manager", label: "Booking Routing API" },
  { id: "api-capacity", pattern: /^\/api\/platform\/growth\/capacity(?:\/|$)/, minimumRole: "growth_manager", label: "Capacity API" },
  { id: "api-revenue-intelligence", pattern: /^\/api\/platform\/growth\/revenue-(?:intelligence|operating|attribution|execution)(?:\/|$)/, minimumRole: "growth_manager", label: "Revenue Intelligence API" },
  { id: "api-inbox-team-dashboard", pattern: /^\/api\/platform\/growth\/inbox\/team-dashboard(?:\/|$)/, minimumRole: "growth_manager", label: "Team Reporting API" },
  { id: "api-outreach-performance", pattern: /^\/api\/platform\/growth\/outreach\/performance(?:\/|$)/, minimumRole: "growth_manager", label: "Outreach Performance API" },
  { id: "api-sequences-builder", pattern: /^\/api\/platform\/growth\/sequences\/(?:patterns|builder|execution\/plan)(?:\/|$)/, minimumRole: "growth_manager", label: "Sequence Builder API" },
  { id: "api-multichannel-config", pattern: /^\/api\/platform\/growth\/multichannel(?:\/|$)/, minimumRole: "growth_manager", label: "Multichannel Config API" },
]

const GROWTH_OPERATOR_API_RULES: GrowthRouteAccessRule[] = [
  { id: "api-leads", pattern: /^\/api\/platform\/growth\/leads(?:\/|$)/, minimumRole: "growth_operator", label: "Leads API" },
  { id: "api-inbox", pattern: /^\/api\/platform\/growth\/(?:inbox|operator-inbox|lead-inbox|replies)(?:\/|$)/, minimumRole: "growth_operator", label: "Inbox API" },
  { id: "api-calls", pattern: /^\/api\/platform\/growth\/calls(?:\/|$)/, minimumRole: "growth_operator", label: "Calls API" },
  { id: "api-meetings", pattern: /^\/api\/platform\/growth\/meetings(?:\/|$)/, minimumRole: "growth_operator", label: "Meetings API" },
  { id: "api-opportunities", pattern: /^\/api\/platform\/growth\/opportunities(?:\/|$)/, minimumRole: "growth_operator", label: "Opportunities API" },
  { id: "api-engagement", pattern: /^\/api\/platform\/growth\/engagement(?:\/|$)/, minimumRole: "growth_operator", label: "Engagement API" },
  { id: "api-notifications", pattern: /^\/api\/platform\/growth\/notifications(?:\/|$)/, minimumRole: "growth_operator", label: "Notifications API" },
  { id: "api-sequences-enroll", pattern: /^\/api\/platform\/growth\/sequences\/enroll(?:\/|$)/, minimumRole: "growth_operator", label: "Sequence Enroll API" },
  { id: "api-calendar", pattern: /^\/api\/platform\/growth\/calendar(?:\/|$)/, minimumRole: "growth_operator", label: "Calendar API" },
  { id: "api-operator", pattern: /^\/api\/platform\/growth\/operator(?:\/|$)/, minimumRole: "growth_operator", label: "Operator API" },
  { id: "api-assignment-run", pattern: /^\/api\/platform\/growth\/assignment\/(?:run|dashboard)(?:\/|$)/, minimumRole: "growth_operator", label: "Assignment Operator API" },
  { id: "api-growth-workspace", pattern: /^\/api\/growth(?:\/|$)/, minimumRole: "growth_operator", label: "Growth Workspace API" },
  { id: "api-ai-os", pattern: /^\/api\/platform\/growth\/ai-os(?:\/|$)/, minimumRole: "growth_operator", label: "AI OS API" },
  { id: "api-platform-growth-default", pattern: /^\/api\/platform\/growth(?:\/|$)/, minimumRole: "growth_operator", label: "Growth Platform API" },
]

export const GROWTH_API_ACCESS_RULES: GrowthRouteAccessRule[] = [
  ...GROWTH_PLATFORM_ADMIN_API_RULES,
  ...GROWTH_MANAGER_API_RULES,
  ...GROWTH_OPERATOR_API_RULES,
]

export function matchGrowthRouteAccessRule(
  pathname: string,
  rules: GrowthRouteAccessRule[],
): GrowthRouteAccessRule | null {
  const normalized = normalizePath(pathname)
  for (const rule of rules) {
    if (rule.pattern.test(normalized)) return rule
  }
  return null
}

export function resolveGrowthWorkspacePageMinimumRole(pathname: string): GrowthRole {
  if (!pathname.startsWith(GROWTH_WORKSPACE_BASE_PATH)) return "platform_admin"
  return matchGrowthRouteAccessRule(pathname, GROWTH_WORKSPACE_PAGE_ACCESS_RULES)?.minimumRole ?? "growth_operator"
}

export function resolveGrowthApiMinimumRole(pathname: string): GrowthRole {
  const normalized = normalizePath(pathname)
  if (!normalized.startsWith("/api/growth/") && !normalized.startsWith("/api/platform/growth/")) {
    return "platform_admin"
  }
  return matchGrowthRouteAccessRule(normalized, GROWTH_API_ACCESS_RULES)?.minimumRole ?? "platform_admin"
}

export function growthRoleCanAccessWorkspacePath(role: GrowthRole, pathname: string): boolean {
  const minimumRole = resolveGrowthWorkspacePageMinimumRole(pathname)
  return growthRoleMeetsMinimum(role, minimumRole)
}

export function growthRoleCanAccessGrowthApiPath(role: GrowthRole, pathname: string): boolean {
  const minimumRole = resolveGrowthApiMinimumRole(pathname)
  return growthRoleMeetsMinimum(role, minimumRole)
}

export function listGrowthWorkspaceRouteMatrix(): Array<{
  route: string
  label: string
  operator: boolean
  manager: boolean
  admin: boolean
}> {
  const routes = GROWTH_WORKSPACE_PAGE_ACCESS_RULES.map((rule) => ({
    route: rule.pattern.source.replace(/^\^/, "").replace(/\(\?:\\\/\|\$\)$/, ""),
    label: rule.label,
    operator: rule.minimumRole === "growth_operator",
    manager: rule.minimumRole === "growth_operator" || rule.minimumRole === "growth_manager",
    admin: true,
  }))
  return routes
}
