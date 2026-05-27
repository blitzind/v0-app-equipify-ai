"use client"

import { Badge } from "@/components/ui/badge"
import { GROWTH_GOOGLE_PLACES_PROVIDER_QA_MARKER } from "@/lib/growth/real-world-discovery/providers/google-places-types"
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
