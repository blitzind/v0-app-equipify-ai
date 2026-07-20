/** GE-AIOS-UX-1A Phase 3 — Review Human Decision Queue routes (client-safe). */

import { isGrowthWorkspaceFirstUx1aEnabled } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-feature"

export const GROWTH_REVIEW_QA_MARKER = "ge-aios-ux-1a-review-human-decision-queue-v1" as const

/** Matches customer CRM drawer — literal avoids route-registry init cycles in tests. */
export const GROWTH_CUSTOMER_LEADS_CRM_HREF = "/growth/leads/crm" as const

/** Matches {@link GROWTH_WORKSPACE_BASE_PATH}/review — literal avoids route-registry init cycles in tests. */
export const GROWTH_REVIEW_PAGE_HREF = "/growth/review" as const

export const GROWTH_REVIEW_LEGACY_APPROVALS_HREF = "/growth/os/approvals" as const

export const GROWTH_REVIEW_LEGACY_SEQUENCE_HREF = "/growth/campaigns/sequences" as const

export type GrowthReviewTabId = "packages" | "sends"

export function resolveUx1aReviewHref(
  env: Record<string, string | undefined> = process.env,
): string {
  return isGrowthWorkspaceFirstUx1aEnabled(env)
    ? GROWTH_REVIEW_PAGE_HREF
    : GROWTH_REVIEW_LEGACY_APPROVALS_HREF
}

export function buildGrowthReviewHref(input?: {
  tab?: GrowthReviewTabId
  item?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.tab) params.set("tab", input.tab)
  if (input?.item) params.set("item", input.item)
  const query = params.toString()
  return query ? `${GROWTH_REVIEW_PAGE_HREF}?${query}` : GROWTH_REVIEW_PAGE_HREF
}

export function buildGrowthReviewPackageHref(packageId: string): string {
  return buildGrowthReviewHref({ tab: "packages", item: packageId })
}

/** Customer AI OS — open the lead CRM drawer for package review. */
export function buildCustomerPackageReviewHref(leadId: string): string {
  const params = new URLSearchParams({ open: leadId })
  return `${GROWTH_CUSTOMER_LEADS_CRM_HREF}?${params.toString()}`
}

const LEAD_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function decodeRouteParam(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    return decodeURIComponent(trimmed)
  } catch {
    return trimmed
  }
}

function isLeadUuid(value: string | null | undefined): value is string {
  const trimmed = value?.trim()
  return Boolean(trimmed && LEAD_UUID_PATTERN.test(trimmed))
}

function parseLeadIdFromPathSegment(route: string): string | null {
  const adminMatch = route.match(/^\/admin\/growth\/leads\/([^/?#]+)/i)
  if (adminMatch?.[1]) {
    const segment = decodeRouteParam(adminMatch[1])
    if (segment && segment !== "crm" && segment !== "queue" && segment !== "captured" && segment !== "lead-engine") {
      return segment
    }
  }

  const growthLeadMatch = route.match(/^\/growth\/leads\/(?!crm|queue|captured|lead-engine)([^/?#]+)/i)
  if (growthLeadMatch?.[1]) {
    return decodeRouteParam(growthLeadMatch[1])
  }

  return null
}

/** Parse a lead id from customer/admin package-review routes. Rejects external URLs. */
export function parseLeadIdFromPackageReviewRoute(route: string | undefined): string | null {
  const trimmed = route?.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null

  const fromPath = parseLeadIdFromPathSegment(trimmed)
  if (fromPath) return fromPath

  try {
    const url = new URL(trimmed, "https://growth.local")
    if (url.pathname.includes("/leads/crm")) {
      const open = decodeRouteParam(url.searchParams.get("open"))
      if (open) return open
    }

    const item = decodeRouteParam(url.searchParams.get("item"))
    if (item && isLeadUuid(item)) return item

    const packageIdParam = decodeRouteParam(url.searchParams.get("packageId"))
    if (packageIdParam && isLeadUuid(packageIdParam)) return packageIdParam
  } catch {
    return null
  }

  return null
}

/** Normalize customer-facing package review links to the CRM lead drawer. */
export function resolveCustomerPackageReviewHref(input: {
  leadId?: string | null
  route?: string | null
}): string | null {
  const leadFromInput = input.leadId?.trim()
  if (leadFromInput && !/^https?:\/\//i.test(leadFromInput)) {
    return buildCustomerPackageReviewHref(leadFromInput)
  }

  const leadFromRoute = parseLeadIdFromPackageReviewRoute(input.route ?? undefined)
  if (leadFromRoute) return buildCustomerPackageReviewHref(leadFromRoute)

  return null
}

export type ResolveOperatorPackageReviewHrefInput = {
  leadId?: string | null
  packageId?: string | null
  route?: string | null
}

/** Canonical operator package review entry — customer CRM drawer when lead id is known. */
export function resolveOperatorPackageReviewHref(
  input: ResolveOperatorPackageReviewHrefInput | string | null | undefined,
): string {
  if (typeof input === "string") {
    return buildGrowthReviewHref({ tab: "packages" })
  }

  const customerHref = resolveCustomerPackageReviewHref({
    leadId: input?.leadId,
    route: input?.route,
  })
  if (customerHref) return customerHref

  return buildGrowthReviewHref({ tab: "packages" })
}

function extractPackageIdFromHref(href: string, params: URLSearchParams): string | null {
  return (
    params.get("item") ??
    params.get("packageId") ??
    params.get("package") ??
    null
  )
}

export function buildGrowthReviewSendHref(jobId: string): string {
  return buildGrowthReviewHref({ tab: "sends", item: jobId })
}

export function parseGrowthReviewSearchParams(input: {
  get(name: string): string | null
}): { tab: GrowthReviewTabId; itemId: string | null } {
  const tabRaw = input.get("tab")?.trim().toLowerCase()
  const tab: GrowthReviewTabId = tabRaw === "sends" ? "sends" : "packages"
  const itemId = input.get("item")?.trim() || null
  return { tab, itemId }
}

function readReviewHrefParams(href: string): URLSearchParams {
  try {
    const url = new URL(href, "https://review.local")
    return url.searchParams
  } catch {
    return new URLSearchParams()
  }
}

/** Remap legacy operator approval surfaces to customer-safe package review links when UX-1A is active. */
export function remapLegacyHrefToGrowthReview(href: string): string {
  const normalized = href.trim()
  const customerHref = resolveCustomerPackageReviewHref({ route: normalized })
  if (customerHref) return customerHref

  const params = readReviewHrefParams(normalized)

  if (normalized.includes("/campaigns/sequences")) {
    const jobId =
      params.get("job") ??
      params.get("jobId") ??
      params.get("item") ??
      params.get("executionJobId")
    return jobId ? buildGrowthReviewSendHref(jobId) : buildGrowthReviewHref({ tab: "sends" })
  }

  if (normalized.includes("/pilot/lead-research/")) {
    const leadId = normalized.match(/lead-research\/([^/?#]+)/)?.[1] ?? null
    const packageCustomerHref = resolveCustomerPackageReviewHref({ leadId, route: normalized })
    if (packageCustomerHref) return packageCustomerHref
    const packageId = extractPackageIdFromHref(normalized, params)
    return resolveOperatorPackageReviewHref({ route: normalized, packageId })
  }

  if (normalized.includes("/os/approvals") || /approve|approval|outreach|package/i.test(normalized)) {
    const packageCustomerHref = resolveCustomerPackageReviewHref({ route: normalized })
    if (packageCustomerHref) return packageCustomerHref
    const packageId = extractPackageIdFromHref(normalized, params)
    return resolveOperatorPackageReviewHref({ route: normalized, packageId })
  }

  if (/send|sequence/i.test(normalized)) {
    const jobId = params.get("job") ?? params.get("jobId") ?? params.get("item")
    if (jobId) return buildGrowthReviewSendHref(jobId)
    return buildGrowthReviewHref({ tab: "sends" })
  }

  return buildGrowthReviewHref({ tab: "packages" })
}
