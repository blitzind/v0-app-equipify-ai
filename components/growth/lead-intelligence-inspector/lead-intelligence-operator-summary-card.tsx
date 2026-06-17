"use client"

import Link from "next/link"
import { ArrowRight, Phone, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useGrowthFeaturePath } from "@/lib/growth/navigation/use-growth-feature-path"
import { LEAD_STAGE_SUMMARY_QA_MARKER } from "@/lib/growth/lead-engine/lead-intelligence-inspector-qa"
import { buildLeadIntelligenceStageOperatorSummary } from "@/lib/growth/lead-engine/lead-intelligence-stage-display"
import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"

export function LeadIntelligenceOperatorSummaryCard({ run }: { run: GrowthLeadEnginePipelineRun }) {
  const leadsPath = useGrowthFeaturePath("leads")
  const callQueuePath = useGrowthFeaturePath("leads/queue")
  const callsPath = useGrowthFeaturePath("calls")
  const leadScore = run.stage_results.find((s) => s.stage_id === "lead_score")
  const approval = run.stage_results.find((s) => s.stage_id === "human_approval")
  const execution = run.stage_results.find((s) => s.stage_id === "revenue_execution")
  const brief = run.stage_results.find((s) => s.stage_id === "account_brief")

  const scoreSummary = leadScore ? buildLeadIntelligenceStageOperatorSummary(leadScore) : null
  const execSummary = execution ? buildLeadIntelligenceStageOperatorSummary(execution) : null
  const briefSummary = brief ? buildLeadIntelligenceStageOperatorSummary(brief) : null

  const approvalRoot =
    approval?.parsed && typeof approval.parsed === "object"
      ? (approval.parsed as Record<string, unknown>)
      : null

  return (
    <section
      className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-card p-5 shadow-sm"
      data-qa-marker={LEAD_STAGE_SUMMARY_QA_MARKER}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-emerald-700" />
            <h3 className="font-semibold text-emerald-950">Operator review summary</h3>
          </div>
          <p className="mt-1 text-sm text-emerald-900/80">
            Explainable pipeline output — what happened, why, and what to do next.
          </p>
        </div>
        {run.mode === "fixture_dry_run" ? (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-950">
            Sample mode
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lead readiness
          </p>
          {scoreSummary ? (
            <>
              <p className="mt-2 text-2xl font-bold">
                {scoreSummary.confidencePercent ?? "—"}
                <span className="text-sm font-normal text-muted-foreground"> score</span>
              </p>
              <p className="mt-1 text-sm">{scoreSummary.executiveSummary}</p>
              <p className="mt-2 text-sm font-medium text-emerald-900">
                → {scoreSummary.recommendedAction}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Run pipeline for lead score.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-background/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Account brief
          </p>
          {briefSummary ? (
            <>
              <p className="mt-2 text-sm leading-relaxed">{briefSummary.executiveSummary}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {briefSummary.signalChips.slice(0, 3).map((chip) => (
                  <Badge key={chip} variant="secondary" className="text-[10px]">
                    {chip}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Brief available after discovery stages.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-background/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Revenue execution
          </p>
          {execSummary ? (
            <>
              <p className="mt-2 text-sm leading-relaxed">{execSummary.executiveSummary}</p>
              <p className="mt-2 flex items-center gap-1 text-sm font-medium">
                <ArrowRight className="size-3.5" />
                {execSummary.recommendedAction}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {execSummary.signalChips.map((chip) => (
                  <Badge key={chip} variant="outline" className="text-[10px]">
                    {chip}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Execution plan generated at pipeline end.</p>
          )}
        </div>
      </div>

      {approvalRoot ? (
        <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-950">
            Human approval: {String(approvalRoot.approval_status ?? "pending")}
          </p>
          <p className="mt-1 text-amber-900/90">
            {String(approvalRoot.approval_summary ?? "Review required before outreach execution.")}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={leadsPath}>
            Open Lead Inbox
            <ArrowRight className="ml-1.5 size-3.5" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={callQueuePath}>Call queue</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={callsPath}>
            <Phone className="mr-1.5 size-3.5" />
            Call workspace
          </Link>
        </Button>
      </div>
    </section>
  )
}
