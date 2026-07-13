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
import {
  GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
  projectApprovals2AOperatorReviewPacket,
  type Approvals2AOperatorReviewPacket,
} from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
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
  const [busy, setBusy] = useState<"approve" | "reject" | "needs_revision" | "lifecycle" | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [executionRequest, setExecutionRequest] = useState<GrowthAvaOutreachExecutionRequest | null>(
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
        }
        if (!cancelled && body.ok && body.packet) setPacket(body.packet)
      } catch {
        // keep fallback packet
      }
    })()
    return () => {
      cancelled = true
    }
  }, [card.leadId, card.packageId])

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
    [card.leadId, card.packageId, onDecided, onDismiss],
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

  const approved = Boolean(executionRequest)

  return (
    <li
      className="rounded-xl border-2 border-emerald-200/80 bg-card p-5 shadow-sm dark:border-emerald-900/50"
      data-qa-marker={GROWTH_AVA_COMPLETED_WORK_QA_MARKER}
      data-qa-marker-approvals-2a={GROWTH_AIOS_APPROVALS_2A_QA_MARKER}
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
              <Field label="Logo" value={view.company.logoUrl ?? "Not prepared"} />
              <Field label="Company" value={view.company.name} />
              <Field label="Website" value={view.company.website ?? "Not on record"} />
              <Field label="Industry" value={view.company.industry ?? "Not prepared"} />
              <Field label="Location" value={view.company.location ?? "Not on record"} />
              <Field label="Employees" value={view.company.employees ?? "Not on record"} />
              <Field
                label="Revenue estimate"
                value={view.company.revenueEstimate ?? "Not on record"}
              />
              <Field
                label="Equipment serviced"
                value={
                  view.company.equipmentServiced.length
                    ? view.company.equipmentServiced.join(" · ")
                    : "Not prepared"
                }
              />
              <Field
                label="Research confidence"
                value={
                  view.company.researchConfidence != null
                    ? `${Math.round(view.company.researchConfidence * 100)}%`
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
                label="Contact confidence"
                value={
                  view.decisionMaker.contactConfidence != null
                    ? `${Math.round(view.decisionMaker.contactConfidence * 100)}%`
                    : "Not prepared"
                }
              />
              <Field
                label="Verification status"
                value={view.decisionMaker.verificationStatus ?? "Not prepared"}
              />
            </div>
          </Section>

          <Section title={`Why ${teammate.name} selected this company`}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {view.whySelected.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Section>

          <Section title="Personalization">
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {view.personalization.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Section>

          <Section title="Research evidence">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
          </Section>

          <Section title="Sales strategy brief">
            {view.salesStrategy ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {Math.round(view.salesStrategy.confidence * 100)}% strategy confidence
                  </Badge>
                  <Badge variant="outline">{view.salesStrategy.recommendedCta}</Badge>
                  <Badge variant="outline">
                    {view.salesStrategy.relationshipStage ?? "Cold"}
                  </Badge>
                  <Badge variant="outline">{view.salesStrategy.tone || "Consultative"}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Business objective" value={view.salesStrategy.businessObjective} />
                  <Field
                    label="Conversation objective"
                    value={view.salesStrategy.conversationObjective}
                  />
                  <Field label="Primary hook" value={view.salesStrategy.primaryHook} />
                  <Field label="Business value" value={view.salesStrategy.businessValue} />
                </div>
                <Field
                  label="Conversation justification"
                  value={
                    view.salesStrategy.conversationJustification ??
                    view.salesStrategy.primaryHook
                  }
                />
                <div className="space-y-2 rounded-md border bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Seller truth
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {view.knowledgeLayers.sellerTruth.length
                      ? view.knowledgeLayers.sellerTruth.map((line) => (
                          <li key={line}>{line}</li>
                        ))
                      : [
                          <li key="empty">Seller truth not attached on this package</li>,
                        ]}
                  </ul>
                </div>
                <div className="space-y-2 rounded-md border bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Prospect truth
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {view.knowledgeLayers.prospectTruth.length
                      ? view.knowledgeLayers.prospectTruth.map((line) => (
                          <li key={line}>{line}</li>
                        ))
                      : [
                          <li key="empty">Prospect truth not attached on this package</li>,
                        ]}
                  </ul>
                </div>
                <div className="space-y-2 rounded-md border bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Conversation strategy
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {view.knowledgeLayers.conversationStrategy.length
                      ? view.knowledgeLayers.conversationStrategy.map((line) => (
                          <li key={line}>{line}</li>
                        ))
                      : [
                          <li key="empty">Conversation strategy not attached on this package</li>,
                        ]}
                  </ul>
                </div>
                {view.operatorReasoning ? (
                  <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ava reasoning
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Conversation goal"
                        value={view.operatorReasoning.conversationGoal}
                      />
                      <Field
                        label="Business outcome"
                        value={view.operatorReasoning.businessOutcome}
                      />
                      <Field
                        label="Primary insight"
                        value={view.operatorReasoning.primaryInsight ?? "Not enough evidence yet"}
                      />
                      <Field
                        label="Reason for CTA"
                        value={view.operatorReasoning.reasonForCta}
                      />
                    </div>
                    <Field
                      label="Evidence summary"
                      value={view.operatorReasoning.evidenceSummary ?? "Evidence still thin"}
                    />
                    <Field
                      label="Conversation risks"
                      value={
                        view.operatorReasoning.conversationRisks.length
                          ? view.operatorReasoning.conversationRisks.join("\n")
                          : "No elevated risks flagged"
                      }
                    />
                    <Field
                      label="Intentionally avoided"
                      value={
                        view.operatorReasoning.intentionallyAvoided.length
                          ? view.operatorReasoning.intentionallyAvoided.join("\n")
                          : "None listed"
                      }
                    />
                  </div>
                ) : null}
                <Field
                  label="Business problems (evidence-backed)"
                  value={
                    view.salesStrategy.businessProblems.length
                      ? view.salesStrategy.businessProblems.join("\n")
                      : "None listed — evidence still thin"
                  }
                />
                <Field
                  label="Evidence sources"
                  value={
                    view.salesStrategy.evidence.length
                      ? view.salesStrategy.evidence
                          .map((row) => `${row.source}: ${row.detail}`)
                          .join("\n")
                      : "No citations prepared"
                  }
                />
                <Field
                  label="Decision maker analysis"
                  value={[
                    view.salesStrategy.decisionMakerAnalysis.whyThisPerson,
                    view.salesStrategy.decisionMakerAnalysis.whyTheyCare,
                    view.salesStrategy.decisionMakerAnalysis.likelyResponsibilities.length
                      ? `Responsibilities: ${view.salesStrategy.decisionMakerAnalysis.likelyResponsibilities.join("; ")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                />
                <Field
                  label="Trust builders"
                  value={
                    view.salesStrategy.trustBuilders.length
                      ? view.salesStrategy.trustBuilders.join("\n")
                      : "None listed"
                  }
                />
                <Field
                  label="Objections"
                  value={view.salesStrategy.objections
                    .map((row) => `${row.objection} → ${row.response}`)
                    .join("\n")}
                />
                <Field
                  label="Missing personalization opportunities"
                  value={
                    view.salesStrategy.missingPersonalizationOpportunities.length
                      ? view.salesStrategy.missingPersonalizationOpportunities.join(" · ")
                      : "None listed"
                  }
                />
                <EditableBlock
                  label="Strategy (editable)"
                  value={strategyEdit}
                  onChange={setStrategyEdit}
                  rows={8}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Strategy brief was not attached to this package. Review drafts carefully before
                authorizing.
              </p>
            )}
          </Section>

          <Section title="Drafts">
            <div className="grid gap-3">
              {view.drafts.map((draft) => (
                <div key={draft.channel} className="rounded-md border bg-background/80 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{draft.label}</span>
                    {!draft.prepared ? <Badge variant="outline">Not prepared</Badge> : null}
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
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Not prepared</p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Explainability">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={`Why ${teammate.name} believes this account is worth pursuing`}
                value={view.explainability.whyPursue}
              />
              <Field label="Why this contact was selected" value={view.explainability.whyContact} />
              <Field label="Why this messaging was chosen" value={view.explainability.whyMessaging} />
              <Field label="Why this timing was selected" value={view.explainability.whyTiming} />
              <Field
                label="Confidence"
                value={`${Math.round(view.explainability.confidence * 100)}%`}
              />
              <Field
                label="Unknown assumptions"
                value={
                  view.explainability.unknownAssumptions.length
                    ? view.explainability.unknownAssumptions.join(" · ")
                    : "None listed"
                }
              />
            </div>
            {view.explainability.supportingEvidence.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {view.explainability.supportingEvidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
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

          <Section title="Transparency">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Generated"
                value={new Date(view.transparency.generatedAt).toLocaleString()}
              />
              <Field
                label="Last updated"
                value={
                  view.transparency.lastUpdatedAt
                    ? new Date(view.transparency.lastUpdatedAt).toLocaleString()
                    : "Not prepared"
                }
              />
              <Field label="Research age" value={view.transparency.researchAge ?? "Not prepared"} />
              <Field
                label="Decision maker age"
                value={view.transparency.decisionMakerAge ?? "Not prepared"}
              />
              <Field
                label="Contact source"
                value={view.transparency.contactSource ?? "Not prepared"}
              />
              <Field label="Package version" value={view.transparency.packageVersion} />
              <Field label="Preparation" value={view.transparency.preparationLabel} />
            </div>
          </Section>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Loading complete review packet…</p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {needsApproval(teammate)} Approving this package does not send — sequence and transport gates
        remain.
      </p>

      {approved ? (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <Check className="size-4" aria-hidden />
            <p className="text-sm font-semibold">Package authorized</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Execution request created. Sequence transport still needs your approval before anything
            sends.
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
