/** Prospect Search runtime initialization — client-safe mode parsing + diagnostics. */

import { GROWTH_BASE64URL_RUNTIME_FIX_QA_MARKER } from "@/lib/encoding/base64url-runtime"
import type { GrowthProspectSearchDiscoveryMode } from "@/lib/growth/prospect-search/prospect-search-types"

export { GROWTH_BASE64URL_RUNTIME_FIX_QA_MARKER }

export const GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER =
  "growth-prospect-search-runtime-fix-v1" as const

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

/** Client-safe diagnostic logging — no secrets, no stack traces in UI. */
export function logProspectSearchRuntimeIssue(
  code: string,
  context: Record<string, string | null | undefined> = {},
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return
  console.warn(`[${GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER}]`, code, context)
}
