"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronRight, Copy, Loader2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import {
  buildOperatorWorkspaceDiagnostics,
  formatAvaRecommendsContactHeading,
  formatOperatorDecisionPrompt,
  formatOperatorGenerationStatusLabel,
  formatOperatorGenerationTypeLabel,
  GROWTH_AVA_OPERATOR_WORKSPACE_3A_QA_MARKER,
  projectAvaRecommendationFromGeneration,
} from "@/lib/growth/aios/operator-experience/growth-ava-operator-workspace-3a"
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
  queueItem: GrowthOutreachQueueItem | null
  onApprove: () => void
  onReject: () => void
  onQueue?: () => void
  onQueueAndSend?: () => void
}

export function GrowthAvaOperatorWorkspaceReview({
  lead,
  teammate,
  generation,
  acting,
  queueItem,
  onApprove,
  onReject,
  onQueue,
  onQueueAndSend,
}: Props) {
  const recommendation = projectAvaRecommendationFromGeneration({ generation, lead })
  const [editing, setEditing] = useState(false)
  const [editedSubject, setEditedSubject] = useState(generation.generatedSubject ?? "")
  const [editedBody, setEditedBody] = useState(generation.generatedContent)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

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

  const isDraft = generation.status === "draft"
  const isApproved = generation.status === "approved"
  const diagnostics = buildOperatorWorkspaceDiagnostics(generation)

  return (
    <div
      className="space-y-4"
      data-qa-marker-ava-operator-workspace-3a={GROWTH_AVA_OPERATOR_WORKSPACE_3A_QA_MARKER}
    >
      <Section title="Recommendation">
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

          {recommendation.rationale ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {recommendation.rationale}
              </p>
            </div>
          ) : null}

          {recommendation.whatStoodOut ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What stood out</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {recommendation.whatStoodOut}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confidence</p>
            <GrowthBadge label={recommendation.confidenceLabel} tone="healthy" />
            <GrowthBadge
              label={formatOperatorGenerationStatusLabel(generation.status)}
              tone={isDraft ? "warning" : isApproved ? "healthy" : "neutral"}
            />
            <GrowthBadge
              label={formatOperatorGenerationTypeLabel(generation.generationType)}
              tone="neutral"
            />
          </div>
        </div>
      </Section>

      <Section title="Email">
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
      </Section>

      <Section title="Decision">
        <p className="text-sm text-muted-foreground">{formatOperatorDecisionPrompt(teammate)}</p>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <>
              <Button type="button" disabled={acting} onClick={onApprove}>
                {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                Approve
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

        {isApproved ? (
          <div className="space-y-2 rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-sm font-medium text-foreground">Approved — ready for the next step</p>
            {queueItem ? (
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
