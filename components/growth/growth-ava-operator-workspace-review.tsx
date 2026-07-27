"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronRight, Copy, Loader2, Mail, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import {
  buildOperatorWorkspaceDiagnostics,
  formatAvaRecommendsContactHeading,
  formatOperatorDecisionPrompt,
  GROWTH_AVA_OPERATOR_WORKSPACE_3A_QA_MARKER,
  projectAvaRecommendationFromGeneration,
} from "@/lib/growth/aios/operator-experience/growth-ava-operator-workspace-3a"
import {
  estimateOperatorReviewTimeLabel,
  GROWTH_AVA_OPERATOR_SECTION_ESTIMATED_REVIEW_TIME,
  GROWTH_AVA_OPERATOR_SECTION_PREPARED_EMAIL,
  GROWTH_AVA_OPERATOR_SECTION_RECOMMENDATION,
  GROWTH_AVA_OPERATOR_SECTION_RECOMMENDATION_STATUS,
  GROWTH_AVA_OPERATOR_SECTION_WHY,
  GROWTH_AVA_OPERATOR_SECTION_YOUR_DECISION,
  GROWTH_AVA_OPERATOR_WORKSPACE_3B_QA_MARKER,
} from "@/lib/growth/aios/operator-experience/growth-ava-operator-workspace-3b"
import {
  isAvaSupervisedOutboundGeneration,
  readAvaSupervisedOutboundApprovalBinding,
  readAvaSupervisedOutboundSendReceipt,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { resolveAvaSupervisedOutboundApprovalPresentation } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { readAvaSupervisedOutboundSendLifecycle } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
import type { GrowthLead } from "@/lib/growth/types"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import type { GrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-types"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-background/90 p-4">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  )
}

function EmailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 border-b border-border/50 py-2 last:border-b-0">
      <p className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  )
}

type Props = {
  lead: GrowthLead
  teammate: AiTeammatePresentation
  generation: GrowthAiCopilotGeneration
  acting: boolean
  approvalError?: string | null
  queueItem: GrowthOutreachQueueItem | null
  onApprove: () => void
  onReject: () => void
  onSend?: () => void
  onQueue?: () => void
  onQueueAndSend?: () => void
}

export function GrowthAvaOperatorWorkspaceReview({
  lead,
  teammate,
  generation,
  acting,
  approvalError = null,
  queueItem,
  onApprove,
  onReject,
  onSend,
  onQueue,
  onQueueAndSend,
}: Props) {
  const recommendation = projectAvaRecommendationFromGeneration({ generation, lead })
  const supervisedOutbound = isAvaSupervisedOutboundGeneration(generation)
  const sendReceipt = useMemo(
    () => readAvaSupervisedOutboundSendReceipt(generation.classification as Record<string, unknown>),
    [generation.classification],
  )
  const sendLifecycle = useMemo(
    () => readAvaSupervisedOutboundSendLifecycle(generation.classification as Record<string, unknown>),
    [generation.classification],
  )
  const approvalBinding = useMemo(
    () => readAvaSupervisedOutboundApprovalBinding(generation.classification as Record<string, unknown>),
    [generation.classification],
  )
  const approvalPresentation = useMemo(
    () => resolveAvaSupervisedOutboundApprovalPresentation(generation),
    [generation],
  )
  const isDraft = generation.status === "draft"
  const isApproved = approvalPresentation.messageApproved
  const isSent = Boolean(generation.sentAt || sendReceipt?.status === "sent")
  const isDeliveryUnknown =
    sendReceipt?.status === "delivery_unknown" || sendLifecycle?.status === "delivery_unknown"
  const sendingFromLabel = useMemo(() => {
    if (!supervisedOutbound) return null
    if (approvalBinding?.senderEmail?.trim()) {
      return approvalBinding.senderEmail.trim()
    }
    if (isDraft) return "Sender assigned when approved"
    return null
  }, [approvalBinding?.senderEmail, isDraft, supervisedOutbound])
  const [editing, setEditing] = useState(false)
  const [editedSubject, setEditedSubject] = useState(generation.generatedSubject ?? "")
  const [editedBody, setEditedBody] = useState(generation.generatedContent)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [signaturePreview, setSignaturePreview] = useState<{
    mode: "loading" | "signature" | "message_only" | "unavailable"
    text: string | null
    message: string | null
  }>({ mode: "loading", text: null, message: null })

  useEffect(() => {
    if (!supervisedOutbound) {
      setSignaturePreview({ mode: "unavailable", text: null, message: null })
      return
    }

    if (!approvalBinding?.senderAccountId) {
      setSignaturePreview({
        mode: "message_only",
        text: null,
        message: "Signature will be applied from the assigned sending mailbox at send time.",
      })
      return
    }

    let cancelled = false
    void fetch(`/api/platform/growth/copilot/generations/${generation.id}/signature-preview`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data: {
        previewMode?: "signature" | "message_only" | "unavailable"
        signatureText?: string | null
        message?: string | null
      }) => {
        if (cancelled) return
        if (data.previewMode === "signature" && data.signatureText?.trim()) {
          setSignaturePreview({
            mode: "signature",
            text: data.signatureText.trim(),
            message: null,
          })
          return
        }
        setSignaturePreview({
          mode: data.previewMode === "message_only" ? "message_only" : "unavailable",
          text: null,
          message: data.message ?? "Signature added when sent",
        })
      })
      .catch(() => {
        if (!cancelled) {
          setSignaturePreview({
            mode: "unavailable",
            text: null,
            message: "Signature added when sent",
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [approvalBinding?.senderAccountId, generation.id, supervisedOutbound])

  const subject = editing ? editedSubject : generation.generatedSubject ?? ""
  const body = editing ? editedBody : generation.generatedContent
  const recipient =
    recommendation.contactEmail ??
    (recommendation.contactName ? recommendation.contactName : "Recipient not identified")
  const recipientLine = recommendation.contactEmail
    ? recommendation.contactName
      ? `${recommendation.contactName} <${recommendation.contactEmail}>`
      : recommendation.contactEmail
    : recipient

  async function copyDraft() {
    const payload = [`To: ${recipientLine}`, subject ? `Subject: ${subject}` : null, "", body]
      .filter((row): row is string => Boolean(row))
      .join("\n")
    await navigator.clipboard.writeText(payload)
  }

  const diagnostics = buildOperatorWorkspaceDiagnostics(generation)
  const estimatedReviewTime = estimateOperatorReviewTimeLabel(generation)

  return (
    <div
      className="space-y-4"
      data-qa-marker-ava-operator-workspace-3a={GROWTH_AVA_OPERATOR_WORKSPACE_3A_QA_MARKER}
      data-qa-marker-ava-operator-workspace-3b={GROWTH_AVA_OPERATOR_WORKSPACE_3B_QA_MARKER}
    >
      <Section title={GROWTH_AVA_OPERATOR_SECTION_RECOMMENDATION}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{formatAvaRecommendsContactHeading(teammate)}</p>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              {recommendation.contactName ?? "Contact pending"}
            </p>
            {recommendation.contactTitle ? (
              <p className="text-sm text-muted-foreground">{recommendation.contactTitle}</p>
            ) : null}
            <p className="text-sm font-medium text-foreground">{recommendation.companyName}</p>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {GROWTH_AVA_OPERATOR_SECTION_ESTIMATED_REVIEW_TIME}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{estimatedReviewTime}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {GROWTH_AVA_OPERATOR_SECTION_RECOMMENDATION_STATUS}
            </p>
            <GrowthBadge label={recommendation.confidenceLabel} tone="healthy" />
            {approvalPresentation.recommendationOperatorApproved ? (
              <GrowthBadge label="Approved" tone="healthy" />
            ) : null}
          </div>
        </div>
      </Section>

      {recommendation.rationale || recommendation.whatStoodOut ? (
        <Section title={GROWTH_AVA_OPERATOR_SECTION_WHY}>
          {recommendation.rationale ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {recommendation.rationale}
            </p>
          ) : null}
          {recommendation.whatStoodOut ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What stood out</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {recommendation.whatStoodOut}
              </p>
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section title={GROWTH_AVA_OPERATOR_SECTION_PREPARED_EMAIL}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <GrowthBadge
            label={approvalPresentation.messageStatusLabel}
            tone={
              approvalPresentation.sendEligible
                ? "healthy"
                : approvalPresentation.unboundApprovedStatus || isDraft
                  ? "warning"
                  : "neutral"
            }
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/10">
          {editing ? (
            <div className="space-y-3 p-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To</p>
                <p className="text-sm text-foreground">{recipientLine}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
                <Textarea
                  value={editedSubject}
                  onChange={(event) => setEditedSubject(event.target.value)}
                  rows={2}
                  className="min-h-[56px] resize-y text-sm"
                  aria-label="Email subject"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Body</p>
                <Textarea
                  value={editedBody}
                  onChange={(event) => setEditedBody(event.target.value)}
                  rows={10}
                  className="min-h-[180px] resize-y text-sm"
                  aria-label="Email body"
                />
              </div>
            </div>
          ) : (
            <div className="px-3 py-1">
              <EmailField label="To" value={recipientLine} />
              {subject ? <EmailField label="Subject" value={subject} /> : null}
              <EmailField label="Body" value={body} />
            </div>
          )}
        </div>
        {supervisedOutbound && sendingFromLabel ? (
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sending from</p>
            <p className="mt-1 text-sm font-medium text-foreground">{sendingFromLabel}</p>
            {approvalBinding?.assignmentSource === "primary_sender" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Primary Ava sender until a sender pool is configured.
              </p>
            ) : null}
          </div>
        ) : null}
        {supervisedOutbound ? (
          <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signature</p>
            {signaturePreview.mode === "loading" ? (
              <p className="mt-1 text-sm text-muted-foreground">Loading signature preview…</p>
            ) : signaturePreview.mode === "signature" && signaturePreview.text ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{signaturePreview.text}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {signaturePreview.message ?? "Signature added when sent"}
              </p>
            )}
          </div>
        ) : null}
      </Section>

      <Section title={GROWTH_AVA_OPERATOR_SECTION_YOUR_DECISION}>
        <p className="text-sm text-muted-foreground">{formatOperatorDecisionPrompt(teammate)}</p>
        <div className="flex flex-wrap gap-2">
          {approvalPresentation.showApproveEmailAction ? (
            <>
              <Button type="button" disabled={acting} onClick={onApprove}>
                {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                {acting ? "Approving..." : "Approve Email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={acting}
                onClick={() => setEditing((value) => !value)}
              >
                <Pencil className="mr-2 size-4" />
                {editing ? "Done editing" : "Edit"}
              </Button>
              <Button type="button" variant="ghost" disabled={acting} onClick={onReject}>
                <X className="mr-2 size-4" />
                Reject
              </Button>
            </>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => void copyDraft()}>
            <Copy className="mr-2 size-4" />
            Copy
          </Button>
        </div>

        {approvalError ? (
          <p className="text-sm text-rose-600" role="alert">
            {approvalError}
          </p>
        ) : null}

        {approvalPresentation.unboundApprovedStatus ? (
          <div className="space-y-2 rounded-lg border border-amber-200/70 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-sm font-medium text-foreground">Prepared email still needs approval</p>
            <p className="text-sm text-muted-foreground">
              The recommendation is marked approved, but this exact email has not been bound for send yet.
              Approve the email to freeze recipient, subject, body, and sender before sending.
            </p>
          </div>
        ) : null}

        {approvalPresentation.showSendEmailAction ? (
          <div className="space-y-2 rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-sm font-medium text-foreground">Email approved — ready to send</p>
            {supervisedOutbound && onSend ? (
              <Button type="button" size="sm" disabled={acting} onClick={onSend}>
                {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
                Send email
              </Button>
            ) : queueItem ? (
              <GrowthBadge label={queueItem.status.replace(/_/g, " ")} tone="healthy" />
            ) : onQueue && onQueueAndSend ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={acting} onClick={onQueue}>
                  Add to send queue
                </Button>
                <Button type="button" size="sm" disabled={acting} onClick={onQueueAndSend}>
                  Queue and send
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {isSent ? (
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <GrowthBadge label="Sent" tone="healthy" />
              {generation.sentAt ? (
                <p className="text-sm text-muted-foreground">
                  {new Date(generation.sentAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <p className="text-sm text-foreground">
              To {sendReceipt?.recipientEmail ?? recipientLine}
            </p>
          </div>
        ) : null}

        {isDeliveryUnknown ? (
          <div className="space-y-2 rounded-lg border border-amber-200/70 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <GrowthBadge label="Delivery unknown" tone="attention" />
            <p className="text-sm text-foreground">
              Provider delivery may have succeeded, but the platform could not finalize the send receipt.
              Reconcile before retrying.
            </p>
            {sendReceipt?.providerMessageId ? (
              <p className="text-xs text-muted-foreground">
                Provider message ID: {sendReceipt.providerMessageId}
              </p>
            ) : null}
          </div>
        ) : null}
      </Section>

      <div className="rounded-lg border border-dashed border-border/70">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
          onClick={() => setDiagnosticsOpen((value) => !value)}
        >
          {diagnosticsOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          Technical details
        </button>
        {diagnosticsOpen ? (
          <dl className="space-y-2 border-t border-border/60 px-3 py-3 text-xs">
            {diagnostics.map((row) => (
              <div key={row.label} className="grid grid-cols-[140px_1fr] gap-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="break-all font-mono text-foreground/90">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  )
}
