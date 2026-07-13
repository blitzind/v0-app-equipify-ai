"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Loader2, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { needsApproval, recommends } from "@/lib/workspace/ai-teammate-voice"
import { GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER } from "@/lib/growth/aios/approvals/completed-work-operator-ux"

type Props = {
  card: GrowthAvaCompletedOutreachPackageCard
  packageBody?: GrowthAutonomousOutreachApprovalPackage | null
  onDecided: () => void
}

const CHANNEL_ORDER = ["email", "follow_up", "linkedin", "call", "sms", "sendr"] as const

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function channelLabel(channel: string): string {
  switch (channel) {
    case "email":
      return "Initial email"
    case "follow_up":
      return "Follow-up"
    case "linkedin":
      return "LinkedIn message"
    case "call":
      return "Call opener"
    case "sms":
      return "SMS draft"
    case "sendr":
      return "SENDR / video"
    default:
      return channel
  }
}

function DraftChannelBlock({
  channel,
  preview,
}: {
  channel: string
  preview: string | null
}) {
  return (
    <div className="rounded-md border bg-background/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{channel}</Badge>
        <span className="text-sm font-medium">{channelLabel(channel)}</span>
        {!preview ? <Badge variant="outline">Not prepared</Badge> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
        {preview?.trim() ? preview : "Not prepared"}
      </p>
    </div>
  )
}

export function GrowthAvaCompletedOutreachPackageCard({
  card,
  packageBody,
  onDecided,
}: Props) {
  const { teammate } = useAiTeammateIdentity()
  const [expanded, setExpanded] = useState(true)
  const [busy, setBusy] = useState<"approve" | "reject" | "needs_revision" | "lifecycle" | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [executionRequest, setExecutionRequest] = useState<GrowthAvaOutreachExecutionRequest | null>(
    null,
  )
  const [decisionMakerLabel, setDecisionMakerLabel] = useState(card.decisionMaker)
  const [contactEmail, setContactEmail] = useState<string | null>(null)
  const [contactPhone, setContactPhone] = useState<string | null>(null)

  const loadDecisionMaker = useCallback(async () => {
    if (!card.leadId) return
    try {
      const [dmResponse, leadResponse] = await Promise.all([
        fetch(`/api/platform/growth/leads/${encodeURIComponent(card.leadId)}/decision-makers`, {
          cache: "no-store",
        }),
        fetch(`/api/platform/growth/leads/${encodeURIComponent(card.leadId)}`, {
          cache: "no-store",
        }),
      ])
      if (dmResponse.ok) {
        const body = (await dmResponse.json()) as {
          decisionMakers?: Array<{ fullName: string; title?: string | null }>
        }
        const first = body.decisionMakers?.[0]
        if (first?.fullName) {
          setDecisionMakerLabel(
            first.title ? `${first.fullName} · ${first.title}` : first.fullName,
          )
        }
      }
      if (leadResponse.ok) {
        const body = (await leadResponse.json()) as {
          lead?: { contactEmail?: string | null; contactPhone?: string | null }
        }
        setContactEmail(body.lead?.contactEmail ?? null)
        setContactPhone(body.lead?.contactPhone ?? null)
      }
    } catch {
      // keep projected label
    }
  }, [card.leadId])

  useEffect(() => {
    void loadDecisionMaker()
  }, [loadDecisionMaker])

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

  const runLifecycle = useCallback(
    async (action: "cancel_work" | "archive_account" | "delete_permanently") => {
      if (!card.leadId) return
      if (action === "cancel_work") {
        const ok = window.confirm(
          "Cancel this work?\n\nActive package/workflow will stop. Nothing will send. History remains. The account stays active unless you archive it separately.",
        )
        if (!ok) return
      }
      if (action === "archive_account") {
        const ok = window.confirm(
          "Archive this account?\n\nIt leaves active workflows. Pending AI work stops. Historical data remains and the account may be restorable.",
        )
        if (!ok) return
      }
      if (action === "delete_permanently") {
        const typed = window.prompt(
          `Delete permanently (archives + stops AI work; hard delete disabled).\nType: DELETE ${card.company}`,
        )
        if (!typed) return
        setBusy("lifecycle")
        setError(null)
        try {
          const response = await fetch("/api/platform/growth/ai-os/completed-work/lifecycle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete_permanently",
              leadId: card.leadId,
              packageId: card.packageId,
              confirmation: typed,
            }),
          })
          const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string }
          if (!response.ok || !payload.ok) {
            throw new Error(payload.message ?? payload.error ?? "Delete failed")
          }
          onDecided()
        } catch (err) {
          setError(err instanceof Error ? err.message : "Delete failed")
        } finally {
          setBusy(null)
        }
        return
      }

      setBusy("lifecycle")
      setError(null)
      try {
        const response = await fetch("/api/platform/growth/ai-os/completed-work/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            leadId: card.leadId,
            packageId: card.packageId,
          }),
        })
        const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string }
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? payload.error ?? "Lifecycle action failed")
        }
        onDecided()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lifecycle action failed")
      } finally {
        setBusy(null)
      }
    },
    [card.company, card.leadId, card.packageId, onDecided],
  )

  const approved = Boolean(executionRequest)
  const assetsByChannel = new Map(
    (packageBody?.generatedAssets ?? card.draftAssets).map((asset) => [asset.channel, asset.preview]),
  )

  return (
    <li
      className="rounded-xl border-2 border-emerald-200/80 bg-card p-5 shadow-sm dark:border-emerald-900/50"
      data-qa-marker={GROWTH_AVA_COMPLETED_WORK_QA_MARKER}
      data-qa-marker-operator-ux={GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER}
      data-package-id={card.packageId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-lg font-semibold text-foreground">{card.company}</p>
          <p className="text-sm text-muted-foreground">
            {recommends(teammate)} authorizing this outreach package.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{Math.round(card.confidence * 100)}% confidence</Badge>
          <Badge variant="outline">Risk {card.risk}</Badge>
          <Badge variant="outline">{card.currentStage}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="size-8" disabled={busy !== null}>
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {card.leadId ? (
                <DropdownMenuItem asChild>
                  <Link href={`/growth/leads/${card.leadId}`}>Open account</Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => void submit("needs_revision")}>
                Needs revision
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void submit("reject")}>Reject</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runLifecycle("cancel_work")}>
                Cancel work
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runLifecycle("archive_account")}>
                Archive account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => void runLifecycle("delete_permanently")}
              >
                Delete permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Decision maker" value={decisionMakerLabel} />
        <Field label="Email" value={contactEmail ?? "Not on lead record"} />
        <Field label="Phone" value={contactPhone ?? "Not on lead record"} />
        <Field label={`Why ${teammate.name} selected it`} value={card.whySelected} />
        <Field label="Why now" value={card.explainability.whyNow} />
        <Field label="Expected outcome" value={card.expectedOutcome} />
        <Field label="Personalization" value={card.personalizationSummary} />
        <Field label="Recommended channel" value={card.recommendedChannel} />
        <Field label="Sequence" value={card.recommendedSequence} />
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">Prepared drafts</p>
        <div className="grid gap-2">
          {CHANNEL_ORDER.map((channel) => (
            <DraftChannelBlock
              key={channel}
              channel={channel}
              preview={assetsByChannel.get(channel) ?? null}
            />
          ))}
        </div>
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null || !card.leadId}
            onClick={() => void runLifecycle("cancel_work")}
          >
            Cancel work
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
          {expanded ? "Hide evidence" : "Show evidence & rationale"}
        </Button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
          <Field label="Why I chose this company" value={card.explainability.whyCompany} />
          <Field label="Why this decision maker" value={card.explainability.whyDecisionMaker} />
          <Field label="Why this sequence" value={card.explainability.whySequence} />
          <Field label="Investment decision" value={card.explainability.investmentDecision} />
          <Field label="Portfolio decision" value={card.explainability.portfolioDecision} />
          <Field label="Knowledge summary" value={card.explainability.knowledgeSummary} />
          {(packageBody?.supportingResearch ?? card.explainability.supportingEvidence).length > 0 ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Supporting evidence
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {(packageBody?.supportingResearch ?? card.explainability.supportingEvidence).map(
                  (line) => (
                    <li key={line}>{line}</li>
                  ),
                )}
              </ul>
            </div>
          ) : null}
          {packageBody?.approvalRequirements?.length ? (
            <Field
              label="Approval requirements"
              value={packageBody.approvalRequirements.join(" · ")}
            />
          ) : null}
          {card.leadId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/growth/leads/${card.leadId}`}>Open account</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
