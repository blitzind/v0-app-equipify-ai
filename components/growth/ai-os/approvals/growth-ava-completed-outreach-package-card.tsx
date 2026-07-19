"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Check, Loader2, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
import { GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
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
import { GrowthAvaMemoryReviewSection } from "@/components/growth/ai-os/approvals/growth-ava-memory-review-section"
import { GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_OPERATOR_LAYOUT_QA_MARKER,
  projectApprovals2AOperatorReviewPacket,
  type Approvals2AOperatorReviewPacket,
} from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PRE_ACTION,
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS,
  GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_STEPS,
  GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_TITLE,
} from "@/lib/growth/workspace/ux-1a/review/growth-operator-package-review-copy-1a"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { needsApproval, recommends } from "@/lib/workspace/ai-teammate-voice"

type Props = {
  card: GrowthAvaCompletedOutreachPackageCard
  packageBody?: GrowthAutonomousOutreachApprovalPackage | null
  onDecided: () => void
  onDismiss?: () => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

function BulletList({ lines }: { lines: string[] }) {
  if (!lines.length) return <p className="text-sm text-muted-foreground">Not prepared</p>
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

function EditableBlock({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="min-h-[88px] resize-y text-sm"
      />
    </div>
  )
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
  const authorizeBlocked =
    executionReadiness != null && !executionReadiness.executionReady && !approved

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
            {Math.round((view?.risk.overallConfidence ?? card.confidence) * 100)}% confidence
          </Badge>
          <Badge variant="outline">Risk {card.risk}</Badge>
          <Badge variant="outline">Transport blocked</Badge>
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

      {view ? (
        <div className="mt-5 space-y-4">
          <Section title="Company summary">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Company" value={view.company.name} />
              <Field label="Website" value={view.company.website ?? "Not on record"} />
              <Field label="Industry" value={view.company.industry ?? "Not prepared"} />
              <Field label="Location" value={view.company.location ?? "Not on record"} />
              <Field
                label="Equipment serviced"
                value={
                  view.company.equipmentServiced.length
                    ? view.company.equipmentServiced.join(" · ")
                    : "Not prepared"
                }
              />
            </div>
          </Section>

          <Section title="Decision maker">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Name" value={view.decisionMaker.name ?? "Not prepared"} />
              <Field label="Title" value={view.decisionMaker.title ?? "Not prepared"} />
              <Field label="Email" value={view.decisionMaker.email ?? "Not prepared"} />
              <Field label="Phone" value={view.decisionMaker.phone ?? "Not prepared"} />
              <Field label="LinkedIn" value={view.decisionMaker.linkedIn ?? "Not prepared"} />
              <Field
                label="Verification status"
                value={view.decisionMaker.verificationStatus ?? "Not prepared"}
              />
            </div>
          </Section>

          <Section title={`Why ${teammate.name} chose this account`}>
            <BulletList lines={view.whySelected} />
          </Section>

          {view.memoryReview.length ? (
            <GrowthAvaMemoryReviewSection
              leadId={card.leadId}
              packageId={card.packageId}
              rows={view.memoryReview}
              onUpdated={(rows) =>
                setPacket((current) => (current ? { ...current, memoryReview: rows } : current))
              }
            />
          ) : null}

          {view.operatorReviewLayout.canonicalDecisionEssentials.length ? (
            <Section title="Why this package exists">
              <BulletList lines={view.operatorReviewLayout.canonicalDecisionEssentials} />
            </Section>
          ) : null}

          {view.operatorReviewLayout.canonicalDecisionEnforcementEssentials.length ? (
            <Section title="Enforcement status">
              <BulletList lines={view.operatorReviewLayout.canonicalDecisionEnforcementEssentials} />
            </Section>
          ) : null}

          {view.operatorReviewLayout.relationshipStrategyEssentials.length ? (
            <Section title="Relationship strategy">
              <BulletList lines={view.operatorReviewLayout.relationshipStrategyEssentials} />
            </Section>
          ) : null}

          {view.operatorReviewLayout.revenueStrategyEssentials.length ? (
            <Section title="Sales recommendation">
              <BulletList lines={view.operatorReviewLayout.revenueStrategyEssentials} />
            </Section>
          ) : null}

          {view.operatorReviewLayout.consultantDiscoveryEssentials.length ? (
            <Section title="Consultant discovery">
              <BulletList lines={view.operatorReviewLayout.consultantDiscoveryEssentials} />
            </Section>
          ) : null}

          <Section title="Conversation strategy">
            <BulletList lines={view.operatorReviewLayout.conversationStrategyEssentials} />
            {view.operatorReviewLayout.sellerTruthEssentials.length ? (
              <div className="mt-3 space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Seller guidance
                </p>
                <BulletList lines={view.operatorReviewLayout.sellerTruthEssentials.slice(0, 5)} />
              </div>
            ) : null}
          </Section>

          <Section title="Drafts">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null || !card.leadId}
                onClick={() => void saveDrafts()}
              >
                {busy === "save" ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                Save draft edits
              </Button>
              <span className="text-xs text-muted-foreground" data-qa={GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER}>
                Persist edits before authorize — transport sends the saved version.
              </span>
            </div>
            <div className="grid gap-3">
              {view.drafts.map((draft) => (
                <div key={draft.channel} className="rounded-md border bg-background/80 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{draft.label}</span>
                    {!draft.prepared ? <Badge variant="outline">Not prepared</Badge> : null}
                    {draft.versionStatus === "approved" ? (
                      <Badge variant="default">Approved</Badge>
                    ) : draft.versionStatus === "edited" ? (
                      <Badge variant="secondary">Edited</Badge>
                    ) : draft.prepared ? (
                      <Badge variant="outline">Generated</Badge>
                    ) : null}
                    {draft.editedByOperator ? (
                      <Badge variant="outline">Edited by operator</Badge>
                    ) : null}
                    {draft.wordCount != null ? (
                      <Badge variant="outline">{draft.wordCount} words</Badge>
                    ) : null}
                    {draft.readTimeSeconds != null ? (
                      <Badge variant="outline">~{draft.readTimeSeconds}s read</Badge>
                    ) : null}
                    {draft.characterCount != null ? (
                      <Badge variant="outline">{draft.characterCount} chars</Badge>
                    ) : null}
                  </div>
                  {draft.prepared ? (
                    <div className="mt-2">
                      <EditableBlock
                        label={`${draft.label} (editable)`}
                        value={draftEdits[draft.channel] ?? draft.preview ?? ""}
                        onChange={(next) =>
                          setDraftEdits((prev) => ({ ...prev, [draft.channel]: next }))
                        }
                        rows={draft.channel === "sms" || draft.channel === "linkedin" ? 3 : 6}
                      />
                      {draft.constitutionWarnings?.length ? (
                        <div className="mt-2 rounded-md border border-amber-300/70 bg-amber-50/50 p-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                          <p className="font-medium">Constitution warnings (you decide)</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {draft.constitutionWarnings.slice(0, 4).map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Not prepared</p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Risk panel">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Overall confidence"
                value={`${Math.round(view.risk.overallConfidence * 100)}%`}
              />
              <Field label="Spam risk" value={view.risk.spamRisk} />
              <Field label="Bounce risk" value={view.risk.bounceRisk} />
              <Field
                label="Relationship strength"
                value={view.risk.relationshipStrength ?? "Not prepared"}
              />
              <Field label="Research completeness" value={view.risk.researchCompleteness} />
              <Field label="Contact verification" value={view.risk.contactVerification} />
              <Field
                label="Unknown fields"
                value={
                  view.risk.unknownFields.length
                    ? view.risk.unknownFields.join(", ")
                    : "None listed"
                }
              />
              <Field
                label="Blocking autonomous send"
                value={view.risk.autonomousSendBlockedReasons.join(" · ")}
              />
            </div>
          </Section>

          <GrowthCollapsibleEngineCard
            title="Research summary"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-research-${card.packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.researchSummary} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {view.evidenceCards.map((evidence) => (
                <div
                  key={evidence.id}
                  className="rounded-md border bg-background/80 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{evidence.present ? "✓" : "○"}</span>
                    <span className="font-medium">{evidence.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {evidence.present
                      ? evidence.detail ?? "Evidence present"
                      : "Not prepared"}
                  </p>
                </div>
              ))}
            </div>
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Seller truth detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-seller-${card.packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.sellerTruthDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Prospect truth detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-prospect-${card.packageId}`}
          >
            <BulletList lines={view.knowledgeLayers.prospectTruth} />
            {view.operatorReviewLayout.expandable.prospectTruthDetail.length ? (
              <div className="mt-3">
                <BulletList lines={view.operatorReviewLayout.expandable.prospectTruthDetail} />
              </div>
            ) : null}
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Relationship strategy detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-relationship-strategy-${card.packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.relationshipStrategyDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Sales strategy detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-revenue-strategy-${card.packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.revenueStrategyDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Consultant reasoning detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-consultant-${card.packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.consultantDiscoveryDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Observation intelligence"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-observations-${card.packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.observationIntelligence} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Explainability"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-explain-${card.packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.explainabilityDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Strategy detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-strategy-${card.packageId}`}
          >
            {view.salesStrategy ? (
              <div className="space-y-3">
                <BulletList lines={view.operatorReviewLayout.expandable.strategyDetail} />
                <EditableBlock
                  label="Strategy (editable)"
                  value={strategyEdit}
                  onChange={setStrategyEdit}
                  rows={8}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Strategy brief was not attached to this package.
              </p>
            )}
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Transparency & metadata"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-transparency-${card.packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.transparencyDetail} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Employees" value={view.company.employees ?? "Not on record"} />
              <Field
                label="Revenue estimate"
                value={view.company.revenueEstimate ?? "Not on record"}
              />
              <Field
                label="Research confidence"
                value={
                  view.company.researchConfidence != null
                    ? `${Math.round(view.company.researchConfidence * 100)}%`
                    : "Not prepared"
                }
              />
              <Field
                label="Contact confidence"
                value={
                  view.decisionMaker.contactConfidence != null
                    ? `${Math.round(view.decisionMaker.contactConfidence * 100)}%`
                    : "Not prepared"
                }
              />
            </div>
            {view.operatorReviewLayout.expandable.personalizationDetail.length ? (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Personalization signals
                </p>
                <BulletList lines={view.operatorReviewLayout.expandable.personalizationDetail} />
              </div>
            ) : null}
          </GrowthCollapsibleEngineCard>
        </div>
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
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
          <p className="font-medium text-foreground">
            {executionReadiness.executionReady ? "Execution-ready" : "Review-ready only"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {executionReadiness.executionReady
              ? executionReadiness.confidenceSource === "lead_sequence_intelligence"
                ? "Canonical lead sequence recommendation is ready for enrollment."
                : `Approved package cadence (${executionReadiness.recommendedCadence ?? card.recommendedSequence}) maps to sequence pattern ${executionReadiness.resolvedPatternKey ?? "catalog"}.`
              : (executionReadiness.blockReason ??
                "Sequence enrollment is not ready — Authorize would fail fulfillment preflight.")}
          </p>
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
              <p className="text-sm text-muted-foreground">{GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS}</p>
              <Button asChild size="sm">
                <Link href={GROWTH_AVA_COMPLETED_WORK_SEQUENCE_GATE_HREF}>Review transport approval</Link>
              </Button>
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
              Authorize is blocked until sequence enrollment readiness is satisfied.
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null || !card.leadId}
            onClick={() => void runLifecycle("archive_account")}
          >
            Archive lead
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null || !card.leadId}
            onClick={() => void runLifecycle("pause_autonomy")}
          >
            Pause autonomy
          </Button>
          {view ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={view.links.leadHref}>View lead</Link>
            </Button>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </li>
  )
}
