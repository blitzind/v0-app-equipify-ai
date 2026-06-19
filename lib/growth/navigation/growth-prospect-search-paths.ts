/** Context-aware Prospect Search hrefs — workspace vs Platform Admin. */

import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-metadata-types"
import { resolveGrowthFeatureBasePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_WORKSPACE_PROSPECT_SEARCH_HREF =
  `${GROWTH_WORKSPACE_BASE_PATH}/leads/prospect-search` as const

export const GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF =
  `${GROWTH_WORKSPACE_BASE_PATH}/leads/prospect-search/discover` as const

export const GROWTH_ADMIN_PROSPECT_SEARCH_HREF = `${GROWTH_ADMIN_BASE_PATH}/search` as const

export const GROWTH_ADMIN_PROSPECT_SEARCH_DISCOVER_HREF =
  `${GROWTH_ADMIN_BASE_PATH}/search?mode=discover` as const

export const GROWTH_ADMIN_PROSPECT_SEARCH_INTERNAL_HREF =
  `${GROWTH_ADMIN_BASE_PATH}/search?mode=internal` as const

export type GrowthProspectSearchPathMode = "discover" | "internal"

export function growthProspectSearchHref(
  pathname: string | null | undefined,
  mode?: GrowthProspectSearchPathMode,
): string {
  const base = resolveGrowthFeatureBasePath(pathname)

  if (base === GROWTH_WORKSPACE_BASE_PATH) {
    if (mode === "discover") return GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF
    if (mode === "internal") return `${GROWTH_WORKSPACE_PROSPECT_SEARCH_HREF}?mode=internal`
    return GROWTH_WORKSPACE_PROSPECT_SEARCH_HREF
  }

  if (mode === "discover") return GROWTH_ADMIN_PROSPECT_SEARCH_DISCOVER_HREF
  if (mode === "internal") return GROWTH_ADMIN_PROSPECT_SEARCH_INTERNAL_HREF
  return GROWTH_ADMIN_PROSPECT_SEARCH_HREF
}
