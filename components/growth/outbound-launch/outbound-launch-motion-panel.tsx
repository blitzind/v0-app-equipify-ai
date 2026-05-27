"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  buildOutboundApprovalChain,
  buildOutboundLaunchUrls,
  GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER,
  OUTBOUND_APPROVAL_CHAIN_STEPS,
  runOutboundLaunchPreflight,
  type OutboundLaunchReadinessSummary,
} from "@/lib/growth/outbound-launch/outbound-launch-motion"
import {
  buildGrowthWorkflowContext,
  summarizeGrowthWorkflowContext,
} from "@/lib/growth/prospect-search/prospect-workflow-context"
import { cn } from "@/lib/utils"

export function OutboundLaunchMotionPanel({
  company,
  query,
  savedSearchId,
  compact = false,
}: {
  company: GrowthProspectSearchCompanyResult
  query?: string
  savedSearchId?: string | null
  compact?: boolean
}) {
  const [readiness, setReadiness] = useState<OutboundLaunchReadinessSummary | null>(null)
  const [loadingReadiness, setLoadingReadiness] = useState(true)

  const workflowContext = useMemo(
    () =>
      buildGrowthWorkflowContext({
        company,
        query,
        savedSearchId,
        recommendation: company.pipeline_automation?.recommendation ?? null,
        sequenceBridge: company.pipeline_automation?.sequence_bridge ?? null,
      }),
    [company, query, savedSearchId],
  )

  const preflight = useMemo(() => runOutboundLaunchPreflight({ company }), [company])
  const launchUrls = useMemo(
    () => buildOutboundLaunchUrls({ company, workflowContext }),
    [company, workflowContext],
  )
  const approvalChain = useMemo(
    () => buildOutboundApprovalChain({ currentStepId: "draft", blocked: !preflight.can_launch }),
    [preflight.can_launch],
  )

  const loadReadiness = useCallback(async () => {
    setLoadingReadiness(true)
    try {
      const res = await fetch("/api/platform/growth/outbound-launch/readiness", { cache: "no-store" })
      const json = (await res.json()) as { ok?: boolean; summary?: OutboundLaunchReadinessSummary }
      if (res.ok && json.ok && json.summary) setReadiness(json.summary)
    } finally {
      setLoadingReadiness(false)
    }
  }, [])

  useEffect(() => {
    void loadReadiness()
  }, [loadReadiness])

  const blocks = preflight.checks.filter((c) => !c.passed && c.severity === "block")
  const warnings = preflight.checks.filter((c) => !c.passed && c.severity === "warn")

  return (
    <div
      className={cn(
        "rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2.5 dark:border-sky-900/40 dark:bg-sky-950/20",
        compact ? "text-[11px]" : "text-xs",
      )}
      data-qa-marker={GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-3.5 text-sky-700" />
        <p className="font-semibold text-sky-950 dark:text-sky-100">Outbound launch — human approval required</p>
        <span className="text-[10px] text-muted-foreground">No auto-send</span>
      </div>

      <p className="mt-1 text-muted-foreground">{summarizeGrowthWorkflowContext(workflowContext)}</p>

      {blocks.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {blocks.map((check) => (
            <li key={check.id} className="flex items-start gap-1.5 text-rose-900 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>
                <span className="font-medium">{check.label}:</span> {check.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {warnings.map((check) => (
            <li key={check.id} className="flex items-start gap-1.5 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>
                <span className="font-medium">{check.label}:</span> {check.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {preflight.can_launch ? (
        <p className="mt-2 flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="size-3.5" />
          Preflight passed — draft, queue, and sequence launch available after operator action.
        </p>
      ) : null}

      <div className="mt-3 border-t border-sky-100/80 pt-2 dark:border-sky-900/30">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Approval chain</p>
        <ol className="mt-1.5 flex flex-wrap gap-1">
          {approvalChain.map((step) => (
            <li
              key={step.id}
              title={step.description}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px]",
                step.status === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-900",
                step.status === "current" && "border-sky-300 bg-sky-100 text-sky-950",
                step.status === "blocked" && "border-rose-200 bg-rose-50 text-rose-900",
                step.status === "pending" && "border-border bg-background text-muted-foreground",
              )}
            >
              {step.label}
            </li>
          ))}
        </ol>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {OUTBOUND_APPROVAL_CHAIN_STEPS.length} human gates — execution never bypasses approval.
        </p>
      </div>

      <div className="mt-3 border-t border-sky-100/80 pt-2 dark:border-sky-900/30">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Provider readiness</p>
        {loadingReadiness ? (
          <p className="mt-1 flex items-center gap-1 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Checking provider surfaces…
          </p>
        ) : readiness ? (
          <div className="mt-1 space-y-1">
            {readiness.readiness_message ? (
              <p className="text-amber-900 dark:text-amber-200">{readiness.readiness_message}</p>
            ) : (
              <p className="text-emerald-800 dark:text-emerald-200">Provider surfaces ready for execute path.</p>
            )}
            <div className="flex flex-wrap gap-1">
              {readiness.provider_surfaces.map((surface) => (
                <span
                  key={surface.surfaceId}
                  className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
                  title={surface.detail}
                >
                  {surface.title}: {surface.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 border-t border-sky-100/80 pt-2 dark:border-sky-900/30">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Outcome visibility</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Draft → queued → approved → scheduled → sent — plus bounced, reply, and meeting events on the lead timeline after
          execute.
        </p>
      </div>

      {preflight.growth_lead_id && launchUrls.approval_queue ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Handoff preserves saved search, qualification, territory, and suppression context via workflow token.
        </p>
      ) : launchUrls.lead_inbox_workspace ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Open Lead Inbox workspace to qualify before outbound: {launchUrls.lead_inbox_workspace}
        </p>
      ) : null}
    </div>
  )
}
