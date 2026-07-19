/** GE-AIOS-UX-1A Phase 3 — Review Human Decision Queue routes (client-safe). */

import { isGrowthWorkspaceFirstUx1aEnabled } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-feature"

export const GROWTH_REVIEW_QA_MARKER = "ge-aios-ux-1a-review-human-decision-queue-v1" as const

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

/** Canonical operator entry for package authorization — list fallback when id unknown. */
export function resolveOperatorPackageReviewHref(packageId: string | null | undefined): string {
  const trimmed = packageId?.trim()
  return trimmed ? buildGrowthReviewPackageHref(trimmed) : buildGrowthReviewHref({ tab: "packages" })
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

/** Remap legacy operator approval surfaces to canonical Review deep links when UX-1A is active. */
export function remapLegacyHrefToGrowthReview(href: string): string {
  const normalized = href.trim()
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
    const packageId = extractPackageIdFromHref(normalized, params)
    return resolveOperatorPackageReviewHref(packageId)
  }

  if (normalized.includes("/os/approvals") || /approve|approval|outreach|package/i.test(normalized)) {
    const packageId = extractPackageIdFromHref(normalized, params)
    return resolveOperatorPackageReviewHref(packageId)
  }

  if (/send|sequence/i.test(normalized)) {
    const jobId = params.get("job") ?? params.get("jobId") ?? params.get("item")
    if (jobId) return buildGrowthReviewSendHref(jobId)
    return buildGrowthReviewHref({ tab: "sends" })
  }

  return buildGrowthReviewHref({ tab: "packages" })
}
