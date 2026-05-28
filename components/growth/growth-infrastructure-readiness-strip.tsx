"use client"

import { useEffect, useState } from "react"
import {
  GrowthInfrastructureReadinessBadge,
  GrowthInfrastructureReadinessBanner,
} from "@/components/growth/growth-infrastructure-readiness-badge"
import type { GrowthInfrastructureReadinessCatalogEntry } from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import { GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER } from "@/lib/growth/operations/internal-outbound-ops-types"
import {
  GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER,
  isActionableInfrastructureReadiness,
} from "@/lib/growth/operator-ux/operator-attention-utils"

export function GrowthInfrastructureReadinessStrip({
  surfaceId,
  title,
  matchTitle,
}: {
  surfaceId: GrowthInfrastructureReadinessCatalogEntry["surfaceId"]
  title?: string
  matchTitle?: string
}) {
  const [entry, setEntry] = useState<GrowthInfrastructureReadinessCatalogEntry | null>(null)

  useEffect(() => {
    void fetch("/api/platform/growth/infrastructure/readiness", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { catalog?: GrowthInfrastructureReadinessCatalogEntry[] }) => {
        const catalog = data.catalog ?? []
        const matched =
          catalog.find((item) => item.surfaceId === surfaceId && (!matchTitle || item.title === matchTitle)) ??
          catalog.find((item) => item.surfaceId === surfaceId) ??
          null
        setEntry(matched)
      })
      .catch(() => setEntry(null))
  }, [surfaceId, matchTitle])

  if (!entry || !isActionableInfrastructureReadiness(entry.readiness.status)) return null

  return (
    <div data-qa-marker={GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER} data-attention-actionable-qa={GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER}>
      <GrowthInfrastructureReadinessBanner title={title ?? entry.title} readiness={entry.readiness} />
      <div className="mt-2 flex justify-end">
        <GrowthInfrastructureReadinessBadge readiness={entry.readiness} />
      </div>
    </div>
  )
}
