"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, ShieldCheck, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { HumanExecutionLeadView } from "@/lib/growth/human-execution/human-execution-types"
import { GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER } from "@/lib/growth/human-execution/human-execution-types"
import { humanExecutionReadinessBandTone } from "@/lib/growth/human-execution/human-execution-readiness-score"
import {
  GrowthHumanExecutionSchemaNotice,
  type GrowthHumanExecutionSchemaMeta,
} from "@/components/growth/growth-human-execution-schema-notice"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadExecutionReadinessProps = {
  lead: GrowthLead
}

function formatTiming(iso: string | null | undefined): string {
  if (!iso) return "Operator sets timing"
  return new Date(iso).toLocaleString()
}

export function GrowthLeadExecutionReadiness({ lead }: GrowthLeadExecutionReadinessProps) {
  const [view, setView] = useState<HumanExecutionLeadView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMeta, setSetupMeta] = useState<GrowthHumanExecutionSchemaMeta | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/human-execution/leads/${lead.id}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: GrowthHumanExecutionSchemaMeta
        leadView?: HumanExecutionLeadView | null
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load execution readiness.")
      if (data.meta?.schemaReady === false) {
        setSetupMeta(data.meta)
        setView(null)
        return
      }
      setSetupMeta(null)
      setView(data.leadView ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  async function transitionApproval(approvalId: string, toStatus: "review" | "approved") {
    setActionId(approvalId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/human-execution/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Could not update approval.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActionId(null)
    }
  }

  return (
    <GrowthCollapsibleEngineCard
      id="growth-execution-readiness"
      cardKey={GROWTH_DRAWER_CARD_KEYS.execution}
      title="Execution Readiness"
      subtitle="Human-approved multi-channel orchestration — no autonomous sends"
      icon={<Workflow className="size-4" />}
      badges={[
        { label: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER, tone: "healthy" },
        { label: "Operator controlled", tone: "neutral" },
      ]}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading execution readiness…
        </div>
      ) : setupMeta?.schemaReady === false ? (
        <GrowthHumanExecutionSchemaNotice meta={setupMeta} />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !view ? (
        <p className="text-sm text-muted-foreground">No execution data for this lead.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge
              label={`Readiness ${view.readiness.readinessScore}/100`}
              tone={humanExecutionReadinessBandTone(view.readiness.readinessBand)}
            />
            {view.readiness.callNowRecommended ? (
              <GrowthBadge label="Call now recommended" tone="attention" />
            ) : null}
            {view.approvalStatusLabel ? (
              <GrowthBadge label={`Approval: ${view.approvalStatusLabel}`} tone="neutral" />
            ) : null}
          </div>

          {view.readiness.signals.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {view.readiness.signals.slice(0, 4).map((signal) => (
                <li key={signal.key}>
                  {signal.label} · {signal.contribution}
                </li>
              ))}
            </ul>
          ) : null}

          {view.recommendedSequence ? (
            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended sequence</p>
              <p className="text-sm font-medium">{view.recommendedSequence.templateLabel}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {view.recommendedSequence.steps.slice(0, 5).map((step) => (
                  <li key={step.stepOrder}>
                    Day {step.dayOffset}: {step.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">Suggested channel</p>
              <p className="text-sm font-medium">{view.suggestedChannelLabel ?? "Awaiting operator selection"}</p>
            </div>
            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">Suggested timing</p>
              <p className="text-sm font-medium">{formatTiming(view.suggestedTiming)}</p>
            </div>
          </div>

          {view.pendingApprovals.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending approvals</p>
              {view.pendingApprovals.slice(0, 3).map((approval) => (
                <div key={approval.id} className="rounded-lg border border-border/80 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{approval.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {approval.channelLabel} · {approval.approvalStatus}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {approval.approvalStatus === "draft" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionId === approval.id}
                          onClick={() => void transitionApproval(approval.id, "review")}
                        >
                          Send to review
                        </Button>
                      ) : null}
                      {approval.approvalStatus === "review" ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={actionId === approval.id}
                          onClick={() => void transitionApproval(approval.id, "approved")}
                        >
                          Approve
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={approval.ctaHref}>Open</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No pending approvals — create from Execution dashboard.</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/growth/execution?leadId=${lead.id}`}>Open execution</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
