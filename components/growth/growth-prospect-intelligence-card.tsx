"use client"

import type { ReactNode } from "react"
import { AlertTriangle, Brain, Building2, Gauge, Loader2, Phone, Sparkles, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, StatTile } from "@/components/growth/growth-ui-utils"
import { GROWTH_AI_RESEARCH_AGENT_QA_MARKER, type GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import { cn } from "@/lib/utils"

type GrowthProspectIntelligenceCardProps = {
  companyName: string
  run: GrowthResearchRunPublicView | null
  loading?: boolean
  running?: boolean
  error?: string | null
  onRunResearch?: () => void
  onRebuildResearch?: () => void
  compact?: boolean
}

function painSignalLabel(signal: string): string {
  return signal.replace(/_/g, " ")
}

export function GrowthProspectIntelligenceCard({
  companyName,
  run,
  loading = false,
  running = false,
  error,
  onRunResearch,
  onRebuildResearch,
  compact = false,
}: GrowthProspectIntelligenceCardProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/70 bg-muted/10 py-10 text-sm text-muted-foreground dark:border-slate-800">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading prospect intelligence…
      </div>
    )
  }

  return (
    <div
      className="space-y-4 rounded-xl border border-border/70 bg-gradient-to-br from-violet-500/5 via-background to-sky-500/5 p-4 dark:border-slate-800 dark:from-violet-500/10 dark:to-sky-500/10"
      data-qa-marker={GROWTH_AI_RESEARCH_AGENT_QA_MARKER}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-semibold tracking-tight">Prospect Intelligence</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Deterministic website research for {companyName}. Recommendations only — human approval required.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onRunResearch} disabled={running}>
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            Run Research
          </Button>
          {run?.status === "completed" ? (
            <Button size="sm" variant="ghost" onClick={onRebuildResearch} disabled={running}>
              Rebuild
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      {!run ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground dark:border-slate-800">
          No prospect intelligence yet. Run research to analyze the public website and build operator-ready signals.
        </div>
      ) : run.status === "failed" ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm text-amber-900 dark:text-amber-200">
          Research failed. {run.failedReason ?? "Try again or verify the website URL."}
        </div>
      ) : run.status !== "completed" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Research {run.status}…
        </div>
      ) : (
        <>
          <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            <StatTile label="Website maturity" value={`${run.websiteMaturityScore ?? 0}/100`} />
            <StatTile label="Confidence" value={`${run.researchConfidence ?? 0}%`} />
            <StatTile label="Industry" value={run.industryGuess ?? "Unknown"} />
            <StatTile label="Next action" value={run.recommendedNextAction ?? "Manual Review"} />
          </div>

          {run.researchSummary ? (
            <div className="rounded-lg border border-border/60 bg-background/80 p-3 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Research summary</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{run.researchSummary}</p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/70 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className="size-3.5" />
                Company signals
              </div>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Employees</dt>
                  <dd className="font-medium">{run.employeeSizeGuess ?? "Unknown"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Revenue</dt>
                  <dd className="font-medium">{run.revenueSizeGuess ?? "Unknown"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Tech score</dt>
                  <dd className="font-medium">{run.technologyScore ?? 0}/100</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/70 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Gauge className="size-3.5" />
                Technology stack
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {run.detectedTechnologies.length > 0 ? (
                  run.detectedTechnologies.map((tech) => (
                    <GrowthBadge key={tech} tone="neutral">
                      {tech}
                    </GrowthBadge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No major technologies detected</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="size-3.5" />
              Pain signals
            </div>
            <div className="flex flex-wrap gap-1.5">
              {run.signals.painSignals.length > 0 ? (
                run.signals.painSignals.map((signal) => (
                  <GrowthBadge key={signal} tone="attention">
                    {painSignalLabel(signal)}
                  </GrowthBadge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No major pain signals detected</span>
              )}
            </div>
          </div>

          {run.competitors.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detected competitors / stack rivals</p>
              <div className="flex flex-wrap gap-1.5">
                {run.competitors.map((entry) => (
                  <GrowthBadge key={`${entry.name}-${entry.source}`} tone="neutral">
                    {entry.name}
                  </GrowthBadge>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {run.suggestedPitchAngle ? (
              <InsightBlock icon={<Target className="size-3.5" />} title="Suggested pitch" body={run.suggestedPitchAngle} />
            ) : null}
            {run.suggestedSequence ? (
              <InsightBlock icon={<Sparkles className="size-3.5" />} title="Suggested sequence" body={run.suggestedSequence} />
            ) : null}
            {run.suggestedCallOpening ? (
              <InsightBlock icon={<Phone className="size-3.5" />} title="Call opener" body={run.suggestedCallOpening} className="md:col-span-2" />
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function InsightBlock({
  icon,
  title,
  body,
  className,
}: {
  icon: ReactNode
  title: string
  body: string
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-background/70 p-3 dark:border-slate-800", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{body}</p>
    </div>
  )
}
