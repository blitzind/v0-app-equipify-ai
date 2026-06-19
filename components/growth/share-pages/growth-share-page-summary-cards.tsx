"use client"

import type { GrowthSharePageOperatorWorkspaceSummaryCards } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function formatWhen(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function GrowthSharePageSummaryCards({
  summary,
}: {
  summary: GrowthSharePageOperatorWorkspaceSummaryCards
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Share page workspace summary">
      <section className="rounded-lg border bg-card p-3" aria-labelledby="sp-draft-status">
        <h3 id="sp-draft-status" className="text-xs text-muted-foreground">
          Draft status
        </h3>
        <p className="mt-1 text-sm font-semibold">{summary.draftStatus}</p>
      </section>

      <section className="rounded-lg border bg-card p-3" aria-labelledby="sp-personalization">
        <h3 id="sp-personalization" className="text-xs text-muted-foreground">
          Personalization
        </h3>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Score</dt>
            <dd className="font-medium">{summary.personalizationScore}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Variables</dt>
            <dd className="font-medium">{summary.variablesUsed}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Template</dt>
            <dd className="truncate font-medium">{summary.templateName ?? "Custom"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Generated</dt>
            <dd className="font-medium">{formatWhen(summary.lastGeneratedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-3" aria-labelledby="sp-engagement">
        <h3 id="sp-engagement" className="text-xs text-muted-foreground">
          Engagement
        </h3>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Views</dt>
            <dd className="font-medium">{summary.views}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Unique visitors</dt>
            <dd className="font-medium">{summary.uniqueVisitors}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">CTA clicks</dt>
            <dd className="font-medium">{summary.ctaClicks}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Calendar clicks</dt>
            <dd className="font-medium">{summary.calendarClicks}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-3" aria-labelledby="sp-lead-signals">
        <h3 id="sp-lead-signals" className="text-xs text-muted-foreground">
          Lead signals
        </h3>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Fit score</dt>
            <dd className="font-medium">{summary.fitScore ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Momentum</dt>
            <dd className="font-medium">{summary.momentum ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Next best action</dt>
            <dd className="truncate font-medium capitalize">{summary.nextBestAction?.replace(/_/g, " ") ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Relationship</dt>
            <dd className="truncate font-medium capitalize">{summary.relationshipHealth ?? "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
