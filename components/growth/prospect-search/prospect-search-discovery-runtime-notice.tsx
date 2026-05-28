"use client"

import { AlertTriangle } from "lucide-react"
import {
  GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
  GROWTH_RUNTIME_REGRESSION_FIX_QA_MARKER,
  GROWTH_SAFE_PROVIDER_PARSING_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
import type { GrowthProspectSearchResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function ProspectSearchDiscoveryRuntimeNotice({
  result,
  fetchError,
}: {
  result?: GrowthProspectSearchResult | null
  fetchError?: string | null
}) {
  const hydration = result?.discovery_hydration
  const providerMessage = result?.provider_status_message
  const showPartialHydration = hydration?.partial_intelligence === true
  const showProviderIssue =
    result?.discovery_mode === "discover_external" &&
    Boolean(providerMessage) &&
    (result.total_companies === 0 ||
      result.provider_status_label === "provider_key_missing" ||
      result.provider_status_label === "provider_quota_rate_limited" ||
      result.provider_status_label === "no_provider_configured")

  if (!fetchError && !showPartialHydration && !showProviderIssue) return null

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm"
      data-discovery-runtime-hardening-marker={GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER}
      data-safe-provider-parsing-marker={GROWTH_SAFE_PROVIDER_PARSING_QA_MARKER}
      data-runtime-regression-fix-marker={GROWTH_RUNTIME_REGRESSION_FIX_QA_MARKER}
    >
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-800" />
        <div className="min-w-0 space-y-1">
          {fetchError ? (
            <p className="font-medium text-amber-950">{fetchError}</p>
          ) : null}
          {showProviderIssue && providerMessage ? (
            <p className="text-amber-950">{providerMessage}</p>
          ) : null}
          {showPartialHydration && hydration?.summary ? (
            <p className="text-amber-950">{hydration.summary}</p>
          ) : null}
          {showPartialHydration && hydration?.diagnostics.length ? (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {hydration.diagnostics.slice(0, 3).map((row) => (
                <li key={row.layer}>{row.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
