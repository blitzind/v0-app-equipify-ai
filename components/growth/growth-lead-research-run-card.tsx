"use client"

import { useState, type ReactNode } from "react"
import type { GrowthLeadResearchResult, GrowthLeadResearchRun } from "@/lib/growth/research-types"

function pct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${Math.round(value * 100)}%`
}

function websiteFetchLabel(status: string) {
  return status.replace(/_/g, " ")
}

function websiteFetchClass(status: string) {
  switch (status) {
    case "ok":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "skipped":
      return "border-border bg-muted/40 text-muted-foreground"
    default:
      return "border-amber-200 bg-amber-50 text-amber-900"
  }
}

type GrowthLeadResearchRunCardProps = {
  run: GrowthLeadResearchRun
  title?: string
}

export function GrowthLeadResearchRunCard({ run, title = "Latest research" }: GrowthLeadResearchRunCardProps) {
  const result = run.result
  const [excerptOpen, setExcerptOpen] = useState(false)

  if (run.status === "failed") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">{title} failed</p>
        <p className="mt-1 text-muted-foreground">{run.errorMessage ?? run.errorCode ?? "Unknown error"}</p>
        {run.websiteFetchStatus !== "skipped" ? (
          <p className="mt-2 text-xs text-muted-foreground">Website fetch: {websiteFetchLabel(run.websiteFetchStatus)}</p>
        ) : null}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
        {title}: no result payload.
      </div>
    )
  }

  const sourceUrl = run.sourceUrls[0] ?? run.websiteUrl

  return (
    <ResearchResultBody
      result={result}
      header={
        <div className="space-y-3 border-b border-border pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {run.status === "partial" ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                  Partial research
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Fit {result.equipifyFitScore}/100</span>
              <span>Confidence {pct(result.researchConfidence)}</span>
              <span>Model {result.fitModelVersion}</span>
              {run.finishedAt ? <span>{new Date(run.finishedAt).toLocaleString()}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full border px-2 py-0.5 font-medium capitalize ${websiteFetchClass(run.websiteFetchStatus)}`}
            >
              Website: {websiteFetchLabel(run.websiteFetchStatus)}
            </span>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Source
              </a>
            ) : null}
          </div>
          {run.websiteTextExcerpt ? (
            <div>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setExcerptOpen((value) => !value)}
              >
                {excerptOpen ? "Hide website excerpt" : "Show website excerpt (internal)"}
              </button>
              {excerptOpen ? (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap text-foreground">
                  {run.websiteTextExcerpt}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      }
    />
  )
}

export function ResearchResultBody({
  result,
  header,
}: {
  result: GrowthLeadResearchResult
  header?: ReactNode
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-4 text-sm">
      {header}
      <Section title="Company summary" body={result.companySummary} />
      {result.websiteSummary ? <Section title="Website summary" body={result.websiteSummary} /> : null}
      {result.likelyServiceCategory ? <Section title="Likely service category" body={result.likelyServiceCategory} /> : null}
      <ListSection title="Service area clues" items={result.serviceAreaClues} />
      {result.companySizeEstimate ? <Section title="Company size estimate" body={result.companySizeEstimate} /> : null}
      <ListSection title="Equipment / service indicators" items={result.equipmentServiceIndicators} />
      <ListSection title="Equipify pain points" items={result.equipifyPainPoints} />
      <ListSection title="Outreach angles (internal only — do not auto-send)" items={result.outreachAngles} />
      <Section title="Recommended next action" body={result.recommendedNextAction} />
      <ListSection title="Caveats" items={result.caveats} />
    </div>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{body}</p>
    </div>
  )
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
