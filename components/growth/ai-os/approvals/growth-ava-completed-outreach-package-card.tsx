"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Loader2, MoreHorizontal } from "lucide-react"
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
  buildAvaOperatorPackageDraftsApiPath,
  buildAvaOperatorExecutionRequestRetryApiPath,
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
import type { AvaOutreachPackageReadiness } from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"
import { GrowthAvaPackageProgressiveReviewLayout } from "@/components/growth/ai-os/approvals/growth-ava-package-progressive-review-layout"
import {
  projectOperatorPackageDecisionSummary,
} from "@/lib/growth/workspace/ux-2a/review/growth-operator-package-progressive-review-2a"
import {
  GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_OPERATOR_LAYOUT_QA_MARKER,
  projectApprovals2AOperatorReviewPacket,
  type Approvals2AOperatorReviewPacket,
} from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PRE_ACTION,
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_READY_DETAIL,
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_READY_HEADLINE,
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS,
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS_PENDING_EXECUTION,
  GROWTH_OPERATOR_PACKAGE_INCOMPLETE_BLOCK_PREFIX,
  GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_DETAIL,
  GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_TITLE,
  GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_STEPS,
  GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_TITLE,
  resolvePackageAuthorizationReadiness,
} from "@/lib/growth/workspace/ux-1a/review/growth-operator-package-review-copy-1a"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { recommends } from "@/lib/workspace/ai-teammate-voice"

type Props = {
  card: GrowthAvaCompletedOutreachPackageCard
  packageBody?: GrowthAutonomousOutreachApprovalPackage | null
  onDecided: () => void
  onDismiss?: () => void
}

export function GrowthAvaCompletedOutreachPackageCard({
  card,
  packageBody,
  onDecided,
  onDismiss,
}: Props) {
  const { teammate } = useAiTeammateIdentity()
  const [packet, setPacket] = useState<Approvals2AOperatorReviewPacket | null>(null)
  const [busy, setBusy] = useState<"approve" | "reject" | "needs_revision" | "lifecycle" | "save" | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [executionRequest, setExecutionRequest] = useState<GrowthAvaOutreachExecutionRequest | null>(
    null,
  )
  const [executionReadiness, setExecutionReadiness] = useState<AvaOutreachPackageReadiness | null>(
    null,
  )
  const [strategyEdit, setStrategyEdit] = useState("")
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({})

  const fallbackPacket = packageBody
    ? projectApprovals2AOperatorReviewPacket({
        pkg: packageBody,
        teammateName: teammate.name,
      })
    : null

  const view = packet ?? fallbackPacket

  useEffect(() => {
    if (!view) return
    setStrategyEdit(
      view.salesStrategy
        ? [
            view.salesStrategy.executiveSummary,
            "",
            `Primary hook: ${view.salesStrategy.primaryHook}`,
            `Conversation justification: ${view.salesStrategy.conversationJustification ?? view.salesStrategy.primaryHook}`,
            `Business objective: ${view.salesStrategy.businessObjective}`,
            `Conversation objective: ${view.salesStrategy.conversationObjective}`,
            `Recommended CTA: ${view.salesStrategy.recommendedCta}`,
            `Relationship stage: ${view.salesStrategy.relationshipStage ?? "Cold"}`,
          ].join("\n")
        : "",
    )
    const next: Record<string, string> = {}
    for (const draft of view.drafts) {
      next[draft.channel] = draft.preview ?? ""
    }
    setDraftEdits(next)
  }, [packet, fallbackPacket?.packageId, Boolean(view?.salesStrategy)])

  useEffect(() => {
    if (!card.leadId || !card.packageId) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(
          `/api/platform/growth/ai-os/completed-work/packages/${encodeURIComponent(card.packageId)}?leadId=${encodeURIComponent(card.leadId)}`,
          { cache: "no-store" },
        )
        if (!response.ok) return
        const body = (await response.json()) as {
          ok?: boolean
          packet?: Approvals2AOperatorReviewPacket
          executionReadiness?: AvaOutreachPackageReadiness
          executionRequest?: GrowthAvaOutreachExecutionRequest | null
        }
        if (!cancelled && body.ok && body.packet) setPacket(body.packet)
        if (!cancelled && body.ok && body.executionReadiness) {
          setExecutionReadiness(body.executionReadiness)
        }
        if (!cancelled && body.ok && body.executionRequest) {
          setExecutionRequest(body.executionRequest)
        }
      } catch {
        // keep fallback packet
      }
    })()
    return () => {
      cancelled = true
    }
  }, [card.leadId, card.packageId])

  const saveDrafts = useCallback(async () => {
    if (!card.leadId || !card.packageId) {
      setError("Package identity is incomplete.")
      return
    }
    setBusy("save")
    setError(null)
    try {
      const response = await fetch(buildAvaOperatorPackageDraftsApiPath(card.packageId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: card.leadId,
          draftEdits,
        }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        error?: string
        message?: string
        packet?: Approvals2AOperatorReviewPacket
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "Failed to save draft edits.")
      }
      if (payload.packet) setPacket(payload.packet)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save draft edits.")
    } finally {
      setBusy(null)
    }
  }, [card.leadId, card.packageId, draftEdits])

  const submit = useCallback(
    async (decision: "approve" | "reject" | "needs_revision") => {
      if (!card.leadId || !card.packageId) {
        setError("Package identity is incomplete.")
        return
      }
      setBusy(decision)
      setError(null)
      try {
        const apiDecision = decision === "needs_revision" ? "reject" : decision
        const body: {
          decision: "approve" | "reject"
          leadId: string
          note?: string
          draftEdits?: Record<string, string>
        } = {
          decision: apiDecision,
          leadId: card.leadId,
        }
        if (decision === "needs_revision") {
          body.note = buildNeedsRevisionNote("revise package before resubmit")
        }
        if (decision === "approve" && Object.keys(draftEdits).length > 0) {
          body.draftEdits = draftEdits
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
          result?: { executionRequest?: GrowthAvaOutreachExecutionRequest | null }
        }
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? payload.message ?? "Package action failed.")
        }
        if (decision === "approve") {
          setExecutionRequest(payload.result?.executionRequest ?? null)
        }
        if (decision === "reject" || decision === "needs_revision") {
          // APPROVALS-2A — reject/needs-revision also pauses autonomous progression.
          await fetch("/api/platform/growth/ai-os/completed-work/lifecycle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "cancel_work",
              leadId: card.leadId,
              packageId: card.packageId,
            }),
          }).catch(() => undefined)
        }
        onDecided()
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Package action failed.")
      } finally {
        setBusy(null)
      }
    },
    [card.leadId, card.packageId, draftEdits, onDecided, onDismiss],
  )

  const runLifecycle = useCallback(
    async (
      action: "cancel_work" | "archive_account" | "pause_autonomy" | "delete_permanently" | "dismiss",
    ) => {
      if (!card.leadId) return
      if (action === "dismiss") {
        onDismiss?.()
        onDecided()
        return
      }
      if (action === "cancel_work" || action === "pause_autonomy") {
        const ok = window.confirm(
          action === "pause_autonomy"
            ? "Pause autonomy for this account?\n\nPending package work will stop. Nothing will send. History remains."
            : "Cancel this work?\n\nActive package/workflow will stop. Nothing will send. History remains. The account stays active unless you archive it separately.",
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
        const company = view?.company.name ?? card.company
        const typed = window.prompt(
          `Delete permanently (archives + stops AI work; hard delete disabled).\nType: DELETE ${company}`,
        )
        if (!typed) return
        setBusy("lifecycle")
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
            action: action === "pause_autonomy" ? "cancel_work" : action,
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
    [card.company, card.leadId, card.packageId, onDecided, view?.company.name],
  )

  const retryFulfillment = useCallback(async () => {
    if (!card.leadId || !executionRequest?.requestId) return
    setBusy("approve")
    setError(null)
    try {
      const response = await fetch(
        buildAvaOperatorExecutionRequestRetryApiPath(executionRequest.requestId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: card.leadId }),
        },
      )
      const payload = (await response.json()) as {
        ok?: boolean
        error?: string
        message?: string
        executionRequest?: GrowthAvaOutreachExecutionRequest
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "Retry failed.")
      }
      setExecutionRequest(payload.executionRequest ?? null)
      onDecided()
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry failed.")
    } finally {
      setBusy(null)
    }
  }, [card.leadId, executionRequest?.requestId, onDecided])

  const approved = Boolean(
    executionRequest || packageBody?.packageApprovalDecision === "approved",
  )
  const packageAuthorization = resolvePackageAuthorizationReadiness({
    packageId: card.packageId,
    leadId: card.leadId,
    generatedAssetCount:
      packageBody?.generatedAssets?.length ?? card.draftAssets?.length ?? 0,
    packageApprovalDecision: packageBody?.packageApprovalDecision ?? null,
  })
  const authorizeBlocked = !packageAuthorization.ready && !approved
  const transportExecutionReady = executionReadiness?.executionReady === true
  const authorizedWithoutExecutionRequest =
    approved && !executionRequest && packageBody?.packageApprovalDecision === "approved"

  const decisionSummary = useMemo(
    () =>
      view
        ? projectOperatorPackageDecisionSummary({
            packet: view,
            transportExecutionReady: transportExecutionReady,
          })
        : null,
    [view, transportExecutionReady],
  )

  return (
    <li
      className="rounded-xl border-2 border-emerald-200/80 bg-card p-5 shadow-sm dark:border-emerald-900/50"
      data-qa-marker={GROWTH_AVA_COMPLETED_WORK_QA_MARKER}
      data-qa-marker-approvals-2a={GROWTH_AIOS_APPROVALS_2A_QA_MARKER}
      data-qa-marker-conversation-intelligence-2b={GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_OPERATOR_LAYOUT_QA_MARKER}
      data-qa-marker-outreach-quality-1a={GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER}
      data-package-id={card.packageId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Outreach package
          </p>
          <p className="text-xl font-semibold text-foreground">
            {view?.company.name ?? card.company}
          </p>
          <p className="text-sm text-muted-foreground">
            {recommends(teammate)} authorizing this complete sales packet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {decisionSummary?.confidenceLabel ??
              `${Math.round((view?.risk.overallConfidence ?? card.confidence) * 100)}% confidence`}
          </Badge>
          {approved ? <Badge variant="outline">Authorized</Badge> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="size-8" disabled={busy !== null}>
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {view ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={view.links.leadHref}>View lead</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={view.links.researchHref}>Open research</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={view.links.companyHref}>Open company</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={view.links.contactHref}>Open contact</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem onClick={() => void submit("needs_revision")}>
                Needs revision
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void submit("reject")}>Reject</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runLifecycle("pause_autonomy")}>
                Pause autonomy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runLifecycle("archive_account")}>
                Archive lead
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runLifecycle("dismiss")}>
                Dismiss from Completed Work
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

      {view && decisionSummary ? (
        <GrowthAvaPackageProgressiveReviewLayout
          view={view}
          summary={decisionSummary}
          teammateName={teammate.name}
          packageId={card.packageId}
          leadId={card.leadId}
          draftEdits={draftEdits}
          onDraftChange={(channel, next) =>
            setDraftEdits((prev) => ({ ...prev, [channel]: next }))
          }
          strategyEdit={strategyEdit}
          onStrategyEdit={setStrategyEdit}
          busy={busy !== null}
          onSaveDrafts={() => void saveDrafts()}
          onMemoryUpdated={(rows) =>
            setPacket((current) => (current ? { ...current, memoryReview: rows } : current))
          }
        />
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Loading complete review packet…</p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">{GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PRE_ACTION}</p>

      <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
        <p className="font-medium text-foreground">{GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_TITLE}</p>
        <ol className="mt-2 space-y-2">
          {GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_STEPS.map((step, index) => (
            <li key={step.id} className="flex gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Outbound transport is currently blocked. Step 2 applies only when sending is enabled.
        </p>
      </div>

      {executionReadiness ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/30 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="font-medium text-foreground">{GROWTH_OPERATOR_PACKAGE_AUTHORIZE_READY_HEADLINE}</p>
            <p className="mt-1 text-muted-foreground">{GROWTH_OPERATOR_PACKAGE_AUTHORIZE_READY_DETAIL}</p>
          </div>
          {transportExecutionReady ? (
            <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
              <p className="font-medium text-foreground">Transport execution ready</p>
              <p className="mt-1 text-muted-foreground">
                {executionReadiness.confidenceSource === "lead_sequence_intelligence"
                  ? "Canonical lead sequence recommendation is ready for enrollment."
                  : `Approved package cadence (${executionReadiness.recommendedCadence ?? card.recommendedSequence}) maps to sequence pattern ${executionReadiness.resolvedPatternKey ?? "catalog"}.`}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200/70 bg-amber-50/30 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="font-medium text-foreground">
                {GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_TITLE}
              </p>
              <p className="mt-1 text-muted-foreground">
                {executionReadiness.blockReason ??
                  GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_DETAIL}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {approved ? (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <Check className="size-4" aria-hidden />
            <p className="text-sm font-semibold">Package authorized</p>
          </div>
          {executionRequest?.executionStatus === "failed" ? (
            <div className="space-y-2 rounded-md border border-amber-300/80 bg-amber-50/70 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Fulfillment failed: {executionRequest.fulfillmentError ?? "unknown_error"}
              </p>
              <p className="text-muted-foreground">
                Operator approval and frozen assets are preserved. Retry fulfillment after sequence
                readiness is repaired — no re-approval required.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null || !executionRequest.requestId}
                onClick={() => void retryFulfillment()}
              >
                {busy === "approve" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                Retry fulfillment
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {authorizedWithoutExecutionRequest
                  ? GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS_PENDING_EXECUTION
                  : GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS}
              </p>
              {executionRequest ? (
                <Button asChild size="sm">
                  <Link href={GROWTH_AVA_COMPLETED_WORK_SEQUENCE_GATE_HREF}>Review transport approval</Link>
                </Button>
              ) : authorizedWithoutExecutionRequest && !transportExecutionReady ? (
                <p className="text-xs text-muted-foreground">
                  {GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_DETAIL}
                </p>
              ) : null}
            </>
          )}
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
            disabled={busy !== null || !card.leadId || authorizeBlocked}
            onClick={() => void submit("approve")}
          >
            {busy === "approve" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Authorize
          </Button>
          {authorizeBlocked ? (
            <p className="w-full text-xs text-amber-700 dark:text-amber-300">
              {GROWTH_OPERATOR_PACKAGE_INCOMPLETE_BLOCK_PREFIX}{" "}
              {packageAuthorization.blockReason ?? "required package information is missing"}.
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null || !card.leadId}
            onClick={() => void submit("needs_revision")}
          >
            Needs revision
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null || !card.leadId}
            onClick={() => void submit("reject")}
          >
            Reject
          </Button>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </li>
  )
}
