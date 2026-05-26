"use client"

import type { GrowthIntentPixelVisitHistory } from "@/lib/growth/intent-pixel/intent-pixel-types"
import type { GrowthLeadOperatorSearchIntentSummary } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { formatLabel } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"

const HIGH_INTENT_SEGMENTS = ["/pricing", "/demo", "/book", "/contact", "/service", "/quote"]

export function HighIntentActivityCard({
  intentActivity,
  searchSignals,
}: {
  intentActivity: GrowthIntentPixelVisitHistory | null
  searchSignals: GrowthLeadOperatorSearchIntentSummary[]
}) {
  const paths = new Set<string>()
  for (const session of intentActivity?.sessions ?? []) {
    for (const pv of session.pageviews) {
      const path = (pv.page_path || pv.page_url).split("?")[0] ?? ""
      if (HIGH_INTENT_SEGMENTS.some((s) => path.includes(s))) paths.add(path)
    }
  }

  const conversions =
    intentActivity?.sessions.flatMap((s) => s.conversions.map((c) => c.conversion_type)) ?? []

  return (
    <div className="space-y-4 text-sm">
      {paths.size > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">High-intent paths</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground">
            {[...paths].slice(0, 8).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">No high-intent paths recorded yet.</p>
      )}

      {conversions.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conversions</p>
          <p className="mt-1 capitalize text-emerald-800">{conversions.join(", ").replace(/_/g, " ")}</p>
        </div>
      ) : null}

      {searchSignals.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Search intent timeline</p>
          <ul className="mt-2 space-y-2">
            {searchSignals.slice(0, 6).map((s) => (
              <li key={s.id} className="rounded-lg border border-border px-3 py-2">
                <p className="font-medium">{s.intent_topic}</p>
                <p className="text-xs text-muted-foreground">
                  {formatLabel(s.intent_category)} · score {s.intent_score}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
