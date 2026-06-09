/** Prospect Search runtime initialization — client-safe mode parsing + diagnostics. */

import { GROWTH_BASE64URL_RUNTIME_FIX_QA_MARKER } from "@/lib/encoding/base64url-runtime"
import {
  GROWTH_PROSPECT_SEARCH_CANONICAL_COMPANY_QUERY_PARAM,
  GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_QUERY_PARAM,
} from "@/lib/growth/prospect-search/prospect-search-company-candidate-deep-link-types"
import type { GrowthProspectSearchDiscoveryMode } from "@/lib/growth/prospect-search/prospect-search-types"

export {
  GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_QUERY_PARAM,
  GROWTH_PROSPECT_SEARCH_CANONICAL_COMPANY_QUERY_PARAM,
}

export { GROWTH_BASE64URL_RUNTIME_FIX_QA_MARKER }

export const GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER =
  "growth-prospect-search-runtime-fix-v1" as const

export const GROWTH_PROSPECT_SEARCH_RENDER_LOOP_FIX_QA_MARKER =
  "growth-prospect-search-render-loop-fix-v1" as const

export const GROWTH_PROSPECT_SEARCH_DEFAULT_DISCOVERY_MODE: GrowthProspectSearchDiscoveryMode =
  "discover_external"

const VALID_DISCOVERY_MODES = new Set<GrowthProspectSearchDiscoveryMode>([
  "internal",
  "discover_external",
])

/** Alias map — `mode=discover` opens external discovery (command palette + nav href). */
const DISCOVER_MODE_ALIASES = new Set(["discover", "discover_external"])

export function isProspectSearchDiscoveryMode(
  value: string | null | undefined,
): value is GrowthProspectSearchDiscoveryMode {
  return typeof value === "string" && VALID_DISCOVERY_MODES.has(value as GrowthProspectSearchDiscoveryMode)
}

/** Safe mode resolution — invalid values fall back to discover (never throw). */
export function resolveProspectSearchDiscoveryMode(
  modeParam: string | null | undefined,
): GrowthProspectSearchDiscoveryMode {
  const mode = modeParam?.trim().toLowerCase() ?? ""
  if (mode === "internal") return "internal"
  if (DISCOVER_MODE_ALIASES.has(mode)) return "discover_external"
  if (mode) {
    logProspectSearchRuntimeIssue("invalid_mode_param", { mode })
  }
  return GROWTH_PROSPECT_SEARCH_DEFAULT_DISCOVERY_MODE
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Resolve operator deep-link company candidate id from URL — invalid values return null. */
export function resolveProspectSearchCompanyCandidateIdParam(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed || !UUID_RE.test(trimmed)) {
    if (trimmed) {
      logProspectSearchRuntimeIssue("invalid_company_candidate_id_param", { value: trimmed })
    }
    return null
  }
  return trimmed
}

/** Resolve optional canonical company id from URL — invalid values return null. */
export function resolveProspectSearchCanonicalCompanyIdParam(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  if (!UUID_RE.test(trimmed)) {
    logProspectSearchRuntimeIssue("invalid_canonical_company_id_param", { value: trimmed })
    return null
  }
  return trimmed
}

/** Client-safe diagnostic logging — no secrets, no stack traces in UI. */
export function logProspectSearchRuntimeIssue(
  code: string,
  context: Record<string, string | null | undefined> = {},
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return
  console.warn(`[${GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER}]`, code, context)
}
