"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GrowthAvaOutreachExecutionRequest } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import {
  buildAvaOperatorPackageActionApiPath,
  GROWTH_AVA_OPERATOR_SUCCESS_PIPELINE_STEPS,
} from "@/lib/growth/mission-center/growth-ava-operator-workspace-contract"
import {
  GROWTH_AVA_COMPLETED_WORK_QA_MARKER,
  GROWTH_AVA_COMPLETED_WORK_SEQUENCE_GATE_HREF,
} from "@/lib/growth/aios/approvals/ava-completed-work-contract"
import {
  buildNeedsRevisionNote,
  type GrowthAvaCompletedOutreachPackageCard,
} from "@/lib/growth/aios/approvals/ava-completed-work-projection"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { needsApproval, recommends } from "@/lib/workspace/ai-teammate-voice"

type Props = {
  card: GrowthAvaCompletedOutreachPackageCard
  onDecided: () => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  )
}

export function GrowthAvaCompletedOutreachPackageCard({ card, onDecided }: Props) {
  const { teammate } = useAiTeammateIdentity()
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<"approve" | "reject" | "needs_revision" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executionRequest, setExecutionRequest] = useState<GrowthAvaOutreachExecutionRequest | null>(
    null,
  )
  const [decisionMakerLabel, setDecisionMakerLabel] = useState(card.decisionMaker)

  const loadDecisionMaker = useCallback(async () => {
    if (!card.leadId) return
    try {
      const response = await fetch(
        `/api/platform/growth/leads/${encodeURIComponent(card.leadId)}/decision-makers`,
        { cache: "no-store" },
      )
      if (!response.ok) return
      const body = (await response.json()) as {
        decisionMakers?: Array<{ fullName: string; title?: string | null }>
      }
      const first = body.decisionMakers?.[0]
      if (first?.fullName) {
        setDecisionMakerLabel(
          first.title ? `${first.fullName} · ${first.title}` : first.fullName,
        )
      }
    } catch {
      // keep projected label
    }
  }, [card.leadId])

  const submit = useCallback(
    async (decision: "approve" | "reject" | "needs_revision") => {
      if (!card.leadId || !card.packageId) {
        setError("Package identity is incomplete — open the linked review surface.")
        return
      }
      setBusy(decision)
      setError(null)
      try {
        const apiDecision = decision === "needs_revision" ? "reject" : decision
        const body: { decision: "approve" | "reject"; leadId: string; note?: string } = {
          decision: apiDecision,
          leadId: card.leadId,
        }
        if (decision === "needs_revision") {
          body.note = buildNeedsRevisionNote("revise package before resubmit")
        }
        const response = await fetch(buildAvaOperatorPackageActionApiPath(card.packageId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const payload = (await response.json()) as {
          ok?: boolean
          error?: string
          message?: string
          transportBlocked?: boolean
          result?: { executionRequest?: GrowthAvaOutreachExecutionRequest | null }
        }
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? payload.message ?? "Package action failed.")
        }
        if (decision === "approve") {
          setExecutionRequest(payload.result?.executionRequest ?? null)
        }
        onDecided()
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Package action failed.")
      } finally {
        setBusy(null)
      }
    },
    [card.leadId, card.packageId, onDecided],
  )

  const approved = Boolean(executionRequest)

  return (
    <li
      className="rounded-xl border border-border/70 bg-card p-4"
      data-qa-marker={GROWTH_AVA_COMPLETED_WORK_QA_MARKER}
      data-package-id={card.packageId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-foreground">{card.company}</p>
          <p className="text-sm text-muted-foreground">
            {recommends(teammate)} authorizing this outreach package.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{Math.round(card.confidence * 100)}% confidence</Badge>
          <Badge variant="outline">Risk {card.risk}</Badge>
          <Badge variant="outline">{card.currentStage}</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Decision maker" value={decisionMakerLabel} />
        <Field label={`Why ${teammate.name} selected it`} value={card.whySelected} />
        <Field label="Business objective" value={card.businessObjective} />
        <Field label="Mission" value={card.mission} />
        <Field label="Investment state" value={card.investmentState} />
        <Field label="Portfolio priority" value={card.portfolioPriority} />
        <Field label="Personalization summary" value={card.personalizationSummary} />
        <Field label="Expected outcome" value={card.expectedOutcome} />
        <Field label="Time prepared" value={new Date(card.timePrepared).toLocaleString()} />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {needsApproval(teammate)} Approving this package does not send — sequence and
        transport gates remain.
      </p>

      {approved ? (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <Check className="size-4" aria-hidden />
            <p className="text-sm font-semibold">Package authorized</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {teammate.name} created the execution request. Sequence transport still needs your approval before
            anything sends.
          </p>
          <Button asChild size="sm">
            <Link href={GROWTH_AVA_COMPLETED_WORK_SEQUENCE_GATE_HREF}>Review sequence gate</Link>
          </Button>
          <ol className="space-y-1 border-t border-emerald-200/60 pt-2 text-xs text-muted-foreground dark:border-emerald-900/40">
            {GROWTH_AVA_OPERATOR_SUCCESS_PIPELINE_STEPS.map((step) => (
              <li key={step} className="flex items-center gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy !== null || !card.leadId}
            onClick={() => void submit("approve")}
          >
            {busy === "approve" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Authorize
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null || !card.leadId}
            onClick={() => void submit("reject")}
          >
            {busy === "reject" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null || !card.leadId}
            onClick={() => void submit("needs_revision")}
          >
            {busy === "needs_revision" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Needs revision
          </Button>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <div className="mt-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2"
          onClick={() => {
            const next = !expanded
            setExpanded(next)
            if (next) void loadDecisionMaker()
          }}
        >
          <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? `Hide why ${teammate.name} chose this` : "Expand explainability"}
        </Button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
          <Field label="Why I chose this company" value={card.explainability.whyCompany} />
          <Field label="Why now" value={card.explainability.whyNow} />
          <Field label="Why this decision maker" value={card.explainability.whyDecisionMaker} />
          <Field label="Why this sequence" value={card.explainability.whySequence} />
          <Field label="Investment decision" value={card.explainability.investmentDecision} />
          <Field label="Portfolio decision" value={card.explainability.portfolioDecision} />
          <Field label="Knowledge summary" value={card.explainability.knowledgeSummary} />
          {card.explainability.supportingEvidence.length > 0 ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Supporting evidence
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {card.explainability.supportingEvidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {card.draftAssets.length > 0 ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Draft assets</p>
              <ul className="mt-2 space-y-2">
                {card.draftAssets.map((asset) => (
                  <li key={`${asset.channel}-${asset.label}`} className="rounded-md border bg-background/80 p-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{asset.channel}</Badge>
                      <span className="font-medium">{asset.label}</span>
                      {asset.draftOnly ? <Badge variant="outline">draft only</Badge> : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                      {asset.preview}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {card.route ? (
            <Button asChild size="sm" variant="outline">
              <Link href={card.route}>Open full package context</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
