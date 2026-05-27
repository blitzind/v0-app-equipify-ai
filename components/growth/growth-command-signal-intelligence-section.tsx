"use client"

import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthCommandSignalIntelligenceSummary } from "@/lib/growth/command/command-action-types"
import { GROWTH_SIGNAL_MOMENTUM_QA_MARKER } from "@/lib/growth/signals/company-signal-rollup"

export function GrowthCommandSignalIntelligenceSection({
  summary,
}: {
  summary: GrowthCommandSignalIntelligenceSummary
}) {
  return (
    <GrowthEngineCard title="Intent Signal Intelligence">
      <p className="mb-3 text-xs text-muted-foreground">
        Live Growth Signals momentum · {GROWTH_SIGNAL_MOMENTUM_QA_MARKER}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Momentum" value={summary.momentum_label} />
        <StatTile label="Avg momentum score" value={String(summary.average_momentum_score)} />
        <StatTile label="High urgency signals" value={String(summary.high_urgency_signals_count)} />
        <StatTile label="News events" value={String(summary.news_events_count)} />
        <StatTile label="Hiring spikes" value={String(summary.hiring_spikes_count)} />
        <StatTile label="Job changes" value={String(summary.job_changes_count ?? 0)} />
        <StatTile label="Promotions" value={String(summary.promotions_count ?? 0)} />
        <StatTile label="Watchlist matches 24h" value={String(summary.watchlist_matches_last_24h)} />
        <StatTile label="Watchlist matches 7d" value={String(summary.watchlist_matches_last_7d)} />
        <StatTile label="Recent hiring signals" value={String(summary.hiring.recent_hiring_signals_count)} />
      </div>

      {summary.top_companies_by_momentum.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top companies by signal momentum
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {summary.top_companies_by_momentum.map((company) => (
              <li key={`${company.domain ?? "none"}-${company.company_name}`}>
                {company.company_name} · {company.momentum_label} ({company.momentum_score})
                {company.latest_signal_summary ? ` — ${company.latest_signal_summary}` : ""}
                {company.watchlist_match ? " · Matched watchlist" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <GrowthBadge tone="neutral" label="Deterministic rollup" />
        <GrowthBadge tone="neutral" label="No autonomous outreach" />
      </div>
    </GrowthEngineCard>
  )
}
