"use client"

import {
  GooglePlacesQueryDiagnostics,
  ProviderCacheCostDiagnostics,
  ProviderRuntimeDiagnosticsPanel,
  RealWorldProviderStatus,
} from "@/components/growth/prospect-search/real-world-provider-status"
import { GROWTH_SEARCH_DIAGNOSTICS_HIDDEN_QA_MARKER } from "@/components/growth/prospect-search/prospect-search-ux-constants"
import { GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchResult } from "@/lib/growth/prospect-search/prospect-search-types"

const SHOW_DIAGNOSTICS = process.env.NODE_ENV === "development"

export function ProspectSearchDiagnosticsDisclosure({
  result,
}: {
  result: GrowthProspectSearchResult
}) {
  if (!SHOW_DIAGNOSTICS || result.discovery_mode !== "discover_external") return null

  const hasDiagnostics =
    result.provider_status_label ||
    result.provider_status_message ||
    (result.provider_messages && result.provider_messages.length > 0) ||
    (result.provider_diagnostics && result.provider_diagnostics.length > 0) ||
    result.provider_runtime_diagnostics ||
    result.external_filter_diagnostics

  if (!hasDiagnostics) return null

  return (
    <details
      className="w-full min-w-0 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs"
      data-qa-marker={GROWTH_SEARCH_DIAGNOSTICS_HIDDEN_QA_MARKER}
    >
      <summary className="cursor-pointer font-medium text-muted-foreground">Diagnostics (dev)</summary>
      <div className="mt-2 flex flex-col gap-2">
        {result.provider_status_label || result.provider_status_message ? (
          <RealWorldProviderStatus
            className="w-full min-w-0"
            label={result.provider_status_label}
            message={
              result.real_world_built_query
                ? `${result.provider_status_message ?? ""} Query: ${result.real_world_built_query}`
                : result.provider_status_message
            }
          />
        ) : null}
        {result.provider_runtime_diagnostics ? (
          <ProviderRuntimeDiagnosticsPanel
            className="w-full min-w-0"
            diagnostics={result.provider_runtime_diagnostics}
          />
        ) : null}
        {result.provider_messages && result.provider_messages.length > 0 ? (
          <p className="break-words text-muted-foreground">{result.provider_messages.join(" · ")}</p>
        ) : null}
        {result.provider_diagnostics && result.provider_diagnostics.length > 0 ? (
          <>
            {result.provider_diagnostics
              .filter((row) => row.provider_type === "google_places")
              .map((row) => (
                <GooglePlacesQueryDiagnostics
                  key={`${row.provider_type}-${row.provider_name}`}
                  className="w-full min-w-0"
                  diagnostic={row}
                  qaMarker={result.google_places_query_expansion_qa_marker}
                />
              ))}
            <ProviderCacheCostDiagnostics
              className="w-full min-w-0"
              diagnostics={result.provider_diagnostics}
              qaMarker={result.provider_cache_qa_marker}
            />
            <div
              className="w-full min-w-0 break-words rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700"
              data-qa-marker={result.provider_audit_qa_marker ?? GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER}
            >
              <p className="font-medium">Provider diagnostics</p>
              <ul className="mt-1 space-y-1">
                {result.provider_diagnostics
                  .filter((row) => row.provider_type !== "google_places")
                  .map((row) => (
                    <li key={`${row.provider_type}-${row.provider_name}`}>
                      {row.provider_name}: executed={String(row.provider_executed)}, latency=
                      {row.provider_latency_ms}ms, results={row.provider_result_count}
                      {row.provider_fallback_reason ? `, fallback=${row.provider_fallback_reason}` : ""}
                    </li>
                  ))}
              </ul>
            </div>
          </>
        ) : null}
        {result.external_filter_diagnostics ? (
          <div className="w-full min-w-0 break-words rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
            <p className="font-medium">External filter diagnostics</p>
            <p>
              raw={result.external_filter_diagnostics.raw_provider_count} · normalized=
              {result.external_filter_diagnostics.normalized_result_count} · dropped=
              {result.external_filter_diagnostics.dropped_result_count}
            </p>
          </div>
        ) : null}
        {result.discovery_hydration?.partial_intelligence ? (
          <div className="w-full min-w-0 break-words rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-[11px] text-indigo-950">
            <p className="font-medium">Hydration diagnostics</p>
            <ul className="mt-1 space-y-1">
              {result.discovery_hydration.diagnostics.map((row) => (
                <li key={row.layer}>{row.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  )
}
