"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  SMART_FOLLOW_UP_FILTERS,
  SMART_FOLLOW_UP_POLICY_QA_MARKER,
  SMART_FOLLOW_UP_POLICY_TYPE_LABELS,
  type SmartFollowUpFilter,
  type SmartFollowUpPoliciesResponse,
  type SmartFollowUpPolicy,
} from "@/lib/growth/follow-up-policies/follow-up-policy-types"

function priorityTone(priority: SmartFollowUpPolicy["priority"]) {
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

function reviewTone(status: SmartFollowUpPolicy["review_status"]) {
  switch (status) {
    case "reviewed":
      return "healthy" as const
    case "dismissed":
      return "neutral" as const
    default:
      return "attention" as const
  }
}

export function GrowthSmartFollowUpPoliciesPanel({
  title = "Smart Follow-Up Policies",
  leadId,
  compact = false,
}: {
  title?: string
  leadId?: string | null
  compact?: boolean
}) {
  const [filter, setFilter] = useState<SmartFollowUpFilter>("all")
  const [loading, setLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [queue, setQueue] = useState<SmartFollowUpPoliciesResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("lead_id", leadId)
      params.set("filter", filter)
      params.set("limit", compact ? "8" : "25")

      const res = await fetch(`/api/platform/growth/follow-up-policies?${params.toString()}`)
      const data = (await res.json()) as SmartFollowUpPoliciesResponse & { ok?: boolean }
      setQueue(res.ok ? data : null)
    } catch {
      setQueue(null)
    } finally {
      setLoading(false)
    }
  }, [compact, filter, leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(policy: SmartFollowUpPolicy, action: "mark_reviewed" | "dismiss") {
    setActingId(policy.policy_id)
    try {
      await fetch("/api/platform/growth/follow-up-policies/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, policy }),
      })
      await load()
    } finally {
      setActingId(null)
    }
  }

  async function viewDetails(policy: SmartFollowUpPolicy) {
    setExpandedId(policy.policy_id)
    await fetch("/api/platform/growth/follow-up-policies/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view_details", policy }),
    }).catch(() => null)
  }

  return (
    <GrowthEngineCard
      title={title}
      icon={<CalendarClock className="h-4 w-4" />}
      data-qa-marker={SMART_FOLLOW_UP_POLICY_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Deterministic follow-up planning — when, why, and which channels to consider. Recommendations only.
        No autonomous send, enroll, or scheduling.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {SMART_FOLLOW_UP_FILTERS.map((value) => (
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

      <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
        {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        Refresh policies
      </Button>

      {queue ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <GrowthBadge tone="neutral">{queue.total} policies</GrowthBadge>
          <GrowthBadge tone="attention">{queue.urgent_count} urgent/high</GrowthBadge>
          <GrowthBadge tone="healthy">{queue.recommended_count} follow-up recommended</GrowthBadge>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {loading && !queue ? (
          <p className="text-sm text-muted-foreground">Loading follow-up policies…</p>
        ) : null}

        {!loading && (queue?.policies.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No follow-up policies matched this filter.</p>
        ) : null}

        {queue?.policies.map((policy) => (
          <div key={policy.policy_id} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{policy.title}</p>
                <p className="text-xs text-muted-foreground">
                  {SMART_FOLLOW_UP_POLICY_TYPE_LABELS[policy.policy_type]}
                  {policy.company_name ? ` · ${policy.company_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GrowthBadge tone={priorityTone(policy.priority)}>{policy.priority}</GrowthBadge>
                <GrowthBadge tone={reviewTone(policy.review_status)}>{policy.review_status}</GrowthBadge>
                {policy.follow_up_recommended ? (
                  <GrowthBadge tone="healthy">Follow-up recommended</GrowthBadge>
                ) : (
                  <GrowthBadge tone="neutral">Defer follow-up</GrowthBadge>
                )}
              </div>
            </div>

            <p className="mb-2 text-sm text-muted-foreground">{policy.description}</p>

            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              <GrowthBadge tone="neutral">{policy.follow_up_window.label}</GrowthBadge>
              {policy.recommended_channels.map((channel) => (
                <GrowthBadge key={channel} tone="attention">
                  {channel.replace(/_/g, " ")}
                </GrowthBadge>
              ))}
            </div>

            {expandedId === policy.policy_id ? (
              <div className="mb-3 space-y-2">
                {policy.reasoning.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Reasoning</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {policy.reasoning.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {policy.risks.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Risks</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {policy.risks.map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {policy.required_approvals.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Required approvals</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {policy.required_approvals.map((approval) => (
                        <li key={approval}>{approval}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!compact && policy.channel_plans.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Channel plans</p>
                    {policy.channel_plans.map((plan) => (
                      <div key={plan.channel} className="rounded border border-border p-2 text-xs">
                        <p className="font-medium capitalize">
                          {plan.channel.replace(/_/g, " ")} · {plan.status}
                        </p>
                        <p className="text-muted-foreground">{plan.rationale}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void viewDetails(policy)}>
                View Details
              </Button>
              {policy.related_href ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={policy.related_href}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open Related Item
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={actingId === policy.policy_id}
                onClick={() => void runAction(policy, "mark_reviewed")}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actingId === policy.policy_id}
                onClick={() => void runAction(policy, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </GrowthEngineCard>
  )
}
