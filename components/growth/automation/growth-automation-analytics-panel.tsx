"use client"

import { useCallback, useEffect, useState } from "react"
import { BarChart3, Loader2 } from "lucide-react"
import { GrowthAutomationApprovalAnalytics } from "@/components/growth/automation/growth-automation-approval-analytics"
import { GrowthAutomationAuditTimeline } from "@/components/growth/automation/growth-automation-audit-timeline"
import { GrowthAutomationBranchAnalytics } from "@/components/growth/automation/growth-automation-branch-analytics"
import { GrowthAutomationJobAnalytics } from "@/components/growth/automation/growth-automation-job-analytics"
import { GrowthAutomationRuntimeHealthCard } from "@/components/growth/automation/growth-automation-runtime-health-card"
import { GrowthAutomationRuntimeMetricsGrid } from "@/components/growth/automation/growth-automation-runtime-metrics-grid"
import { GrowthAutomationWaitAnalytics } from "@/components/growth/automation/growth-automation-wait-analytics"
import {
  GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
  GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS,
  type GrowthAutomationAnalyticsSnapshot,
  type GrowthAutomationAuditTimelineSnapshot,
} from "@/lib/growth/automation/growth-automation-analytics-types"

type Props = {
  flowId: string
}

type AnalyticsResponse = {
  analytics?: GrowthAutomationAnalyticsSnapshot
}

type AuditResponse = {
  audit?: GrowthAutomationAuditTimelineSnapshot
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function GrowthAutomationAnalyticsPanel({ flowId }: Props) {
  const [analytics, setAnalytics] = useState<GrowthAutomationAnalyticsSnapshot | null>(null)
  const [audit, setAudit] = useState<GrowthAutomationAuditTimelineSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [analyticsRes, auditRes] = await Promise.all([
        fetch(`/api/platform/growth/automation/${flowId}/analytics`),
        fetch(`/api/platform/growth/automation/${flowId}/audit?limit=25`),
      ])
      const analyticsData = (await analyticsRes.json()) as AnalyticsResponse
      const auditData = (await auditRes.json()) as AuditResponse
      if (analyticsData.analytics) setAnalytics(analyticsData.analytics)
      if (auditData.audit) setAudit(auditData.audit)
    } finally {
      setLoading(false)
    }
  }, [flowId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      data-qa-marker={GROWTH_AUTOMATION_ANALYTICS_QA_MARKER}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="size-4" />
            Performance & history
          </h3>
          <p className="text-xs text-muted-foreground">
            Read-only observability · analytics + immutable audit trail · no sends
          </p>
        </div>
        <span className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide">
          read only
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.analytics_enabled ? <span>analytics</span> : null}
        {GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.audit_enabled ? <span>audit</span> : null}
        {GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.read_only ? <span>read only</span> : null}
        {GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS.requires_human_review ? <span>human review</span> : null}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading analytics…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <GrowthAutomationRuntimeHealthCard health={analytics?.runtimeHealth ?? null} />
          <div>
            <p className="mb-2 text-xs font-medium">Activity counts</p>
            <GrowthAutomationRuntimeMetricsGrid counts={analytics?.counts ?? null} />
          </div>
          {analytics?.completionStats ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border/70 p-2">
                <p className="text-muted-foreground">Completion rate</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatRate(analytics.completionStats.completionRate)}
                </p>
              </div>
              <div className="rounded-md border border-border/70 p-2">
                <p className="text-muted-foreground">Completed</p>
                <p className="mt-1 text-lg font-semibold">{analytics.completionStats.completedCount}</p>
              </div>
            </div>
          ) : null}
          {analytics?.topBottlenecks && analytics.topBottlenecks.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium">Top bottlenecks</p>
              <div className="space-y-2">
                {analytics.topBottlenecks.map((bottleneck) => (
                  <div key={`${bottleneck.kind}:${bottleneck.label}`} className="rounded-md border border-border/70 p-2 text-xs">
                    <p className="font-medium">{bottleneck.label}</p>
                    <p className="mt-1 text-muted-foreground">{bottleneck.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-medium">Branch metrics</p>
            <GrowthAutomationBranchAnalytics branchStats={analytics?.branchStats ?? []} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Wait metrics</p>
            <GrowthAutomationWaitAnalytics waitStats={analytics?.waitStats ?? []} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Approval metrics</p>
            <GrowthAutomationApprovalAnalytics approvalStats={analytics?.approvalStats ?? null} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Pending job metrics</p>
            <GrowthAutomationJobAnalytics jobStats={analytics?.jobStats ?? null} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Audit timeline</p>
            <GrowthAutomationAuditTimeline entries={audit?.entries ?? []} />
          </div>
        </div>
      )}
    </div>
  )
}
