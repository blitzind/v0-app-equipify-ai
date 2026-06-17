"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Inbox, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"
import { GrowthSequencePreviewStudioPanel } from "@/components/growth/growth-sequence-preview-studio-panel"
import { GrowthCampaignBuilderWizardPanel } from "@/components/growth/growth-campaign-builder-wizard-panel"
import { GrowthAgentOrchestrationPanel } from "@/components/growth/growth-agent-orchestration-panel"
import {
  OPERATOR_INBOX_FILTERS,
  OPERATOR_INBOX_QA_MARKER,
  OPERATOR_INBOX_SOURCE_LABELS,
  type OperatorInboxFilter,
  type OperatorInboxItem,
  type OperatorInboxQueueResponse,
} from "@/lib/growth/operator-inbox/operator-inbox-types"
import { useGrowthRealtimeRefresh } from "@/lib/growth/realtime-events/use-growth-realtime-refresh"

function priorityTone(priority: OperatorInboxItem["priority"]) {
  switch (priority) {
    case "urgent":
      return "critical" as const
    case "high":
      return "attention" as const
    case "medium":
      return "neutral" as const
    default:
      return "healthy" as const
  }
}

export function GrowthOperatorInboxPanel({
  title = "Unified Operator Inbox",
  leadId,
  compact = false,
}: {
  title?: string
  leadId?: string | null
  compact?: boolean
}) {
  const [filter, setFilter] = useState<OperatorInboxFilter>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<OperatorInboxQueueResponse | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("lead_id", leadId)
      params.set("filter", filter)
      params.set("limit", compact ? "8" : "20")

      const res = await fetch(`/api/platform/growth/operator-inbox?${params.toString()}`)
      const data = (await res.json()) as OperatorInboxQueueResponse & { ok?: boolean }
      if (!res.ok) {
        setError("Operator inbox request failed")
        setQueue(null)
        return
      }
      setQueue(data)
    } catch {
      setError("Operator inbox unavailable")
      setQueue(null)
    } finally {
      setLoading(false)
    }
  }, [compact, filter, leadId])

  useEffect(() => {
    void load()
  }, [load])

  useGrowthRealtimeRefresh({ subscriber: "operator_inbox", onRefresh: () => void load() })

  async function runAction(item: OperatorInboxItem, action: "mark_viewed" | "mark_reviewed" | "dismiss") {
    setActingId(item.item_id)
    try {
      await fetch("/api/platform/growth/operator-inbox/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          item_id: item.item_id,
          source: item.source,
          source_ref: item.source_ref,
        }),
      })
      await load()
    } finally {
      setActingId(null)
    }
  }

  return (
    <>
    <GrowthEngineCard
      title={title}
      icon={<Inbox className="h-4 w-4" />}
      data-qa-marker={OPERATOR_INBOX_QA_MARKER}
      className={compact ? "p-3 sm:p-3" : undefined}
    >
      {!compact ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Human-reviewed operator queue — signals, replies, approvals, attention, and threads. No autonomous outreach
          execution.
        </p>
      ) : null}

      <div className={`mb-2 flex flex-wrap gap-2 ${compact ? "gap-1.5" : ""}`}>
        {OPERATOR_INBOX_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {value.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <Button size="sm" variant={compact ? "ghost" : "outline"} className={compact ? "h-7 px-2 text-xs" : undefined} disabled={loading} onClick={() => void load()}>
        {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        Refresh queue
      </Button>

      {queue && !compact ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <GrowthBadge tone="neutral">{queue.total} items</GrowthBadge>
          <GrowthBadge tone="attention">{queue.urgent_count} urgent/high</GrowthBadge>
          <span>Signals: {queue.source_counts.signal}</span>
          <span>Replies: {queue.source_counts.reply_workflow}</span>
          <span>Approvals: {queue.source_counts.human_approval}</span>
        </div>
      ) : null}

      <GrowthEnginePanelResilience
        loading={loading && !queue}
        error={error}
        isEmpty={!loading && (queue?.items.length ?? 0) === 0}
        emptyKind="no_inbox_items"
        emptyMessage="No notifications right now."
        onRetry={() => void load()}
        partialData={Boolean(queue)}
        compact={compact}
        compactTitle={title}
      >
        <div className={compact ? "max-h-[7.5rem] space-y-2 overflow-y-auto pr-1" : "space-y-2"}>
        {queue?.items.map((item) => (
          <div key={item.item_id} className={`rounded-lg border border-border bg-muted/20 ${compact ? "p-2" : "p-3"}`}>
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {OPERATOR_INBOX_SOURCE_LABELS[item.source]}
                  {item.company_name ? ` · ${item.company_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GrowthBadge tone={priorityTone(item.priority)}>{item.priority}</GrowthBadge>
                <GrowthBadge tone="neutral">Confidence {item.confidence}</GrowthBadge>
              </div>
            </div>

            <p className="mb-2 text-sm text-muted-foreground">{item.description}</p>

            {item.reasoning.length > 0 && !compact ? (
              <ul className="mb-2 list-disc pl-4 text-xs text-muted-foreground">
                {item.reasoning.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {item.cta_href ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={item.cta_href}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={actingId === item.item_id}
                onClick={() => void runAction(item, "mark_reviewed")}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actingId === item.item_id}
                onClick={() => void runAction(item, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
        </div>
      </GrowthEnginePanelResilience>
    </GrowthEngineCard>
    {!compact ? (
      <>
    <GrowthConversationalPlaybooksPanel consumer="operator_inbox" title="Conversational Playbook" leadId={leadId} compact />
    <GrowthHumanInterventionsPanel title="Human Interventions" leadId={leadId} compact />
    <GrowthSmartFollowUpPoliciesPanel title="Smart Follow-Up Policies" leadId={leadId} compact />
    <GrowthSequencePreviewStudioPanel title="Sequence Preview Studio" leadId={leadId} compact />
    <GrowthCampaignBuilderWizardPanel title="Campaign Builder Wizard" leadId={leadId} compact />
    <GrowthAgentOrchestrationPanel title="Agent Orchestration" leadId={leadId} compact />
      </>
    ) : null}
    </>
  )
}
