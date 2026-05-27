"use client"

import { Badge } from "@/components/ui/badge"
import { GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER } from "@/lib/growth/real-world-discovery/providers/google-places-query-expansion"
import { GROWTH_GOOGLE_PLACES_PROVIDER_QA_MARKER } from "@/lib/growth/real-world-discovery/providers/google-places-types"
import type { GrowthProspectSearchProviderDiagnostic } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  live_provider_active: "border-emerald-200 bg-emerald-50 text-emerald-900",
  fixture_fallback_active: "border-amber-200 bg-amber-50 text-amber-900",
  no_provider_configured: "border-slate-200 bg-slate-50 text-slate-700",
}

const STATUS_LABELS: Record<string, string> = {
  live_provider_active: "Live provider active",
  fixture_fallback_active: "Fixture fallback active",
  no_provider_configured: "No provider configured",
}

export function RealWorldProviderStatus({
  label,
  message,
  className,
}: {
  label?: string | null
  message?: string | null
  className?: string
}) {
  if (!label && !message) return null
  const style = STATUS_STYLES[label ?? ""] ?? STATUS_STYLES.no_provider_configured
  const title = STATUS_LABELS[label ?? ""] ?? "Provider status"

  return (
    <div
      className={cn("rounded-lg border px-3 py-2 text-sm", style, className)}
      data-qa-marker="growth-real-world-company-discovery-v1"
    >
      <p className="font-medium">{title}</p>
      {message ? <p className="mt-0.5 text-xs opacity-90">{message}</p> : null}
    </div>
  )
}

export function RealWorldSourceBadge({
  badge,
  providerType,
}: {
  badge?: string | null
  providerType?: string | null
}) {
  if (!badge && !providerType) return null
  const isGooglePlaces = providerType === "google_places" || badge === "Google Places"
  return (
    <Badge
      variant="outline"
      className="text-[10px]"
      data-qa-marker={isGooglePlaces ? GROWTH_GOOGLE_PLACES_PROVIDER_QA_MARKER : undefined}
    >
      {badge ?? providerType}
    </Badge>
  )
}

export function GooglePlacesQueryDiagnostics({
  diagnostic,
  qaMarker,
  className,
}: {
  diagnostic: GrowthProspectSearchProviderDiagnostic
  qaMarker?: string | null
  className?: string
}) {
  if (diagnostic.provider_type !== "google_places") return null
  if (!diagnostic.provider_query_generated?.length) return null

  const merged =
    diagnostic.provider_merged_result_count ?? diagnostic.provider_result_count ?? 0

  return (
    <div
      className={cn(
        "mt-2 rounded-md border border-violet-200 bg-violet-50/70 px-2.5 py-2 text-[11px] text-violet-950",
        className,
      )}
      data-qa-marker={qaMarker ?? GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER}
    >
      <p className="font-semibold">Google Places</p>
      <p className="mt-1 font-medium">Queries executed:</p>
      <ul className="mt-1 space-y-0.5">
        {diagnostic.provider_query_generated.map((query, index) => (
          <li key={`${query}-${index}`}>
            {query} ({diagnostic.provider_query_result_count?.[index] ?? 0})
          </li>
        ))}
      </ul>
      <p className="mt-1.5 font-medium">Total merged results: {merged}</p>
    </div>
  )
}
