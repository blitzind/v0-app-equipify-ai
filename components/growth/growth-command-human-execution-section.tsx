"use client"

import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthHumanExecutionDashboard } from "@/lib/growth/human-execution/human-execution-types"
import { GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER } from "@/lib/growth/human-execution/human-execution-types"
import { humanExecutionReadinessBandTone } from "@/lib/growth/human-execution/human-execution-readiness-score"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthNativeDialerLaunchButton } from "@/components/growth/growth-native-dialer-launch-button"

export function GrowthCommandHumanExecutionSection({
  dashboard,
}: {
  dashboard: GrowthHumanExecutionDashboard
}) {
  const { metrics, approvalQueue, readyQueue, criticalOpportunities, callNowRecommendations } = dashboard

  return (
    <GrowthEngineCard
      title="Execution Queue"
      subtitle="Human-approved multi-channel actions — operator controlled only"
      icon={<ShieldCheck className="size-4" />}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <GrowthBadge label={GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER} tone="healthy" />
        <GrowthBadge label="No autonomous sends · calls · CRM" tone="neutral" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Approval pending" value={String(metrics.approvalPending)} />
        <StatTile label="Ready now" value={String(metrics.readyNow)} />
        <StatTile label="Revenue influenced" value={`$${metrics.revenueInfluenced.toLocaleString()}`} />
        <StatTile label="Sequences active" value={String(metrics.sequencesActive)} />
        <StatTile label="Reply rate" value={`${metrics.replyRatePercent}%`} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Meetings created" value={String(metrics.meetingsCreated)} />
        <StatTile label="Approval SLA (avg h)" value={String(metrics.humanApprovalSlaHours)} />
        <StatTile label="Call-now opportunities" value={String(metrics.callNowOpportunities)} />
        <StatTile label="Fatigue prevented" value={String(metrics.contactFatiguePrevented)} />
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ready-to-approve actions
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/growth/execution">Open execution dashboard</Link>
          </Button>
        </div>
        {approvalQueue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approvals waiting in queue.</p>
        ) : (
          <ul className="space-y-2">
            {approvalQueue.slice(0, 5).map((item) => (
              <li key={item.id} className="rounded-lg border border-border/80 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{item.companyName}</p>
                    <p className="text-sm text-muted-foreground">{item.title}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge
                      label={item.readinessBand}
                      tone={humanExecutionReadinessBandTone(item.readinessBand)}
                    />
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.ctaHref}>Review</Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Critical revenue opportunities
          </p>
          {criticalOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">None flagged critical right now.</p>
          ) : (
            <ul className="space-y-2">
              {criticalOpportunities.slice(0, 4).map((item) => (
                <li key={item.id} className="rounded-lg border border-border/80 px-3 py-2 text-sm">
                  <p className="font-medium">{item.companyName}</p>
                  <p className="text-muted-foreground">{item.why}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Call-now recommendations
          </p>
          {callNowRecommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No call-now flags.</p>
          ) : (
            <ul className="space-y-2">
              {callNowRecommendations.slice(0, 4).map((item) => (
                <li key={item.id} className="rounded-lg border border-border/80 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.companyName}</p>
                      <p className="text-xs text-muted-foreground">Score {item.readinessScore}</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.ctaHref}>Open</Link>
                    </Button>
                    <GrowthNativeDialerLaunchButton leadId={item.leadId} label="Call" size="sm" variant="secondary" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {readyQueue.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {readyQueue.length} execution-ready lead{readyQueue.length === 1 ? "" : "s"} in queue.
        </p>
      ) : null}
    </GrowthEngineCard>
  )
}
