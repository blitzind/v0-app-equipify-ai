"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Clock, Loader2, Search, ShieldAlert, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthOpportunityRecommendationScoringDetails } from "@/components/growth/growth-opportunity-recommendation-scoring-details"
import { GrowthSalesExecutionPlanPanel } from "@/components/growth/growth-sales-execution-plan-panel"
import { GrowthRevenuePlaybookGuidance } from "@/components/growth/growth-revenue-playbook-guidance"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type GrowthBuyingSignalEvidence,
  type GrowthOpportunityReviewContext,
} from "@/lib/growth/revenue-execution/revenue-execution-types"
import { revenueReadinessTierLabel } from "@/lib/growth/revenue-workflow/revenue-workflow-types"

type ReviewPayload = { ok?: boolean; context?: GrowthOpportunityReviewContext; error?: string }

export function GrowthRevenueExecutionReviewWorkspace({ recommendationId }: { recommendationId: string }) {
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<GrowthOpportunityReviewContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [humanApproved, setHumanApproved] = useState(false)
  const [note, setNote] = useState("")
  const [snoozeUntil, setSnoozeUntil] = useState("")
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/revenue-execution/review?recommendationId=${encodeURIComponent(recommendationId)}`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as ReviewPayload
      if (!response.ok || !payload.context) {
        setError(payload.error ?? "Could not load review context.")
        setContext(null)
        return
      }
      setContext(payload.context)
    } finally {
      setLoading(false)
    }
  }, [recommendationId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(action: "accept" | "reject" | "snooze" | "request_research") {
    if (!humanApproved) {
      setActionMessage("Confirm human approval before proceeding.")
      return
    }
    setActionLoading(action)
    setActionMessage(null)
    try {
      let url = ""
      let body: Record<string, unknown> = { humanApprovalConfirmed: true, note: note || undefined }

      if (action === "accept") {
        url = `/api/platform/growth/opportunities/recommendations/${recommendationId}/accept`
      } else if (action === "reject") {
        url = `/api/platform/growth/opportunities/recommendations/${recommendationId}/dismiss`
      } else if (action === "snooze") {
        if (!snoozeUntil) {
          setActionMessage("Select a snooze date.")
          return
        }
        url = `/api/platform/growth/revenue-execution/recommendations/${recommendationId}/snooze`
        body = { ...body, snoozeUntil: new Date(snoozeUntil).toISOString() }
      } else {
        url = `/api/platform/growth/revenue-execution/recommendations/${recommendationId}/request-research`
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) {
        setActionMessage(payload.message ?? payload.error ?? "Action failed.")
        return
      }
      setActionMessage(payload.message ?? "Action recorded — no autonomous execution.")
      await load()
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading opportunity review…
      </div>
    )
  }

  if (error || !context || context.qaMarker !== GROWTH_REVENUE_EXECUTION_QA_MARKER) {
    return <p className="text-sm text-destructive">{error ?? "Review context unavailable."}</p>
  }

  const rec = context.recommendation
  const readiness = context.revenueReadiness

  return (
    <div className="space-y-6">
      <GrowthEngineCard title={rec.title} icon={<ShieldAlert className="size-4" />}>
        <p className="text-sm text-muted-foreground">{rec.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <GrowthBadge label={rec.recommendationType.replace(/_/g, " ")} tone="attention" />
          <GrowthBadge label={rec.status} tone="neutral" />
          {rec.leadLabel ? (
            <Link
              href={`/admin/growth/leads/${rec.leadId}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {rec.leadLabel}
            </Link>
          ) : null}
        </div>
        <GrowthOpportunityRecommendationScoringDetails recommendation={rec} />
      </GrowthEngineCard>

      <div className="grid gap-4 md:grid-cols-2">
        <GrowthEngineCard title="Revenue Readiness">
          {readiness ? (
            <div className="space-y-2 text-sm">
              <p>
                Score <span className="font-semibold">{readiness.score}</span> ·{" "}
                {revenueReadinessTierLabel(readiness.tier)}
              </p>
              <p className="text-muted-foreground">{readiness.summary}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No readiness snapshot on file.</p>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Relationship Context">
          <div className="space-y-2 text-sm">
            <p>
              Stage{" "}
              <span className="font-medium">{context.relationshipStage?.replace(/_/g, " ") ?? "—"}</span>
            </p>
            <p>
              Engagement{" "}
              <span className="font-medium">{context.engagementTrend?.replace(/_/g, " ") ?? "—"}</span>
            </p>
          </div>
        </GrowthEngineCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BuyingSignalsList signals={context.buyingSignals} />
        <EvidenceList title="Commitments" items={context.commitments} />
        <EvidenceList title="Objections" items={context.objections} />
      </div>

      {context.playbook ? (
        <GrowthEngineCard title={`Playbook: ${context.playbook.title}`}>
          <p className="text-sm text-muted-foreground">{context.playbook.summary}</p>
          <p className="mt-2 text-sm font-medium">{context.playbook.recommendedNextStep}</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {context.playbook.recommendedActions.map((action) => (
              <li key={action.kind}>
                <span className="font-medium text-foreground">{action.label}</span> — {action.description}
              </li>
            ))}
          </ul>
          <GrowthRevenuePlaybookGuidance playbook={context.playbook} />
          <p className="mt-3 text-xs text-muted-foreground">Decision support only — operator executes manually.</p>
        </GrowthEngineCard>
      ) : null}

      {context.executionPlan ? (
        <GrowthSalesExecutionPlanPanel leadId={rec.leadId} initialPlan={context.executionPlan} />
      ) : null}

      <GrowthEngineCard title="Operator Actions">
        <p className="mb-4 text-sm text-muted-foreground">
          All actions require explicit human approval. Nothing creates opportunities, tasks, or pipeline changes
          automatically.
        </p>

        <label className="mb-4 flex items-center gap-2 text-sm">
          <Checkbox checked={humanApproved} onCheckedChange={(value) => setHumanApproved(value === true)} />
          I confirm this is a human operator decision
        </label>

        <Textarea
          placeholder="Optional note for audit trail"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="mb-3"
          rows={2}
        />

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Snooze until</label>
            <Input type="datetime-local" value={snoozeUntil} onChange={(event) => setSnoozeUntil(event.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!!actionLoading}
            onClick={() => void runAction("accept")}
          >
            {actionLoading === "accept" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
            Accept Recommendation
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!!actionLoading}
            onClick={() => void runAction("reject")}
          >
            {actionLoading === "reject" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <XCircle className="mr-2 size-4" />}
            Reject Recommendation
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!actionLoading}
            onClick={() => void runAction("snooze")}
          >
            {actionLoading === "snooze" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Clock className="mr-2 size-4" />}
            Snooze Recommendation
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!actionLoading}
            onClick={() => void runAction("request_research")}
          >
            {actionLoading === "request_research" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Search className="mr-2 size-4" />
            )}
            Request More Research
          </Button>
        </div>

        {actionMessage ? <p className="mt-3 text-sm text-muted-foreground">{actionMessage}</p> : null}
      </GrowthEngineCard>
    </div>
  )
}

function BuyingSignalsList({ signals }: { signals: GrowthBuyingSignalEvidence[] }) {
  return (
    <GrowthEngineCard title="Buying signals">
      {signals.length === 0 ? (
        <p className="text-sm text-muted-foreground">None recorded.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {signals.map((signal, index) => (
            <li key={`${signal.signalType}-${index}`} className="space-y-1">
              <p className="font-medium text-foreground">{signal.signalType.replace(/_/g, " ")}</p>
              <p className="text-muted-foreground">{signal.evidenceSnippet}</p>
              {signal.supportingContext ? (
                <p className="text-xs text-muted-foreground">Context: {signal.supportingContext}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {[signal.confidence ? `${signal.confidence} confidence` : null, signal.source ? `Source: ${signal.source}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  return (
    <GrowthEngineCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None recorded.</p>
      ) : (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}
