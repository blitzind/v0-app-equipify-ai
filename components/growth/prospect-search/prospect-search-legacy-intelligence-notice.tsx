"use client"

import type { ReactNode } from "react"
import { PROSPECT_SEARCH_LEGACY_PANEL_HELPER } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"

export function ProspectSearchLegacyIntelligenceNotice({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <details className="rounded-lg border border-dashed border-amber-200 bg-amber-50/40 px-3 py-2 text-xs text-amber-950">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <p className="mt-2 text-[11px] text-amber-900">{PROSPECT_SEARCH_LEGACY_PANEL_HELPER}</p>
      <div className="mt-3">{children}</div>
    </details>
  )
}
