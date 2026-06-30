"use client"

import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthPersonalizationDraftBodyPreview } from "@/components/growth/personalization/growth-personalization-draft-body-preview"
import { GROWTH_AVA_DRAFT_PREVIEW_TITLE } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import type { GrowthPersonalizationOriginalAiDraftSnapshot } from "@/lib/growth/personalization/growth-personalization-stack-b-metadata"
import {
  personalizationStatusLabel,
  type GrowthPersonalizationGenerationView,
} from "@/lib/growth/personalization/personalization-types"
import {
  GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER,
  GROWTH_SEQUENCE_SEND_REVIEW_CONTROL_PLANE_LABELS,
  GROWTH_SEQUENCE_SEND_REVIEW_HREF,
  GROWTH_SEQUENCE_SEND_REVIEW_LABEL,
} from "@/lib/growth/operator-ux/growth-operator-primary-actions-7a2"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  rejected: "neutral",
  sent: "healthy",
  archived: "neutral",
  blocked: "blocked",
}

const RISK_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  low: "healthy",
  medium: "attention",
  high: "critical",
  critical: "blocked",
}

type Props = {
  generation: GrowthPersonalizationGenerationView
  originalAiDraft: GrowthPersonalizationOriginalAiDraftSnapshot
  editSubject: string
  editBody: string
  disabled?: boolean
  actionId?: string | null
  onEditSubject: (value: string) => void
  onEditBody: (value: string) => void
  onResetToAiDraft: () => void
  onSaveDraft: () => void
  onApprove: () => void
  onReject: () => void
  onRegenerate: () => void
}

export function GrowthPersonalizationDraftEditor({
  generation,
  originalAiDraft,
  editSubject,
  editBody,
  disabled = false,
  actionId = null,
  onEditSubject,
  onEditBody,
  onResetToAiDraft,
  onSaveDraft,
  onApprove,
  onReject,
  onRegenerate,
}: Props) {
  const readOnly = generation.status === "blocked" || generation.status === "approved"
  const hasEdits =
    editSubject.trim() !== originalAiDraft.subject.trim() ||
    editBody.trim() !== originalAiDraft.body.trim()

  return (
    <section
      aria-labelledby="personalization-draft-heading"
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      data-growth-ops-click-reduction={GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER}
    >
      <header className="shrink-0 border-b border-border/60 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="personalization-draft-heading" className="text-sm font-semibold">
              Preview & Review
            </h2>
            <p className="text-xs text-muted-foreground">{generation.leadLabel}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <GrowthBadge
              label={personalizationStatusLabel(generation.status)}
              tone={STATUS_TONE[generation.status] ?? "neutral"}
            />
            <GrowthBadge label={`Risk ${generation.riskLevel}`} tone={RISK_TONE[generation.riskLevel] ?? "neutral"} />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {generation.blockedReason ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            Blocked: {generation.blockedReason}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{GROWTH_AVA_DRAFT_PREVIEW_TITLE}</p>
            {hasEdits ? (
              <span className="text-xs text-violet-700">Original preserved below edits</span>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
              <p className="mt-1 font-medium">{originalAiDraft.subject.trim() || "—"}</p>
              <GrowthPersonalizationDraftBodyPreview body={originalAiDraft.body} className="mt-4" />
            </div>
          </div>
        </div>

        {hasEdits ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">My Edits Preview</p>
            <div className="rounded-lg border border-violet-200/80 bg-violet-50/20 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
              <p className="mt-1 font-medium">{editSubject.trim() || "—"}</p>
              <GrowthPersonalizationDraftBodyPreview body={editBody} className="mt-4" />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Editable Subject</label>
          <Input
            value={editSubject}
            onChange={(event) => onEditSubject(event.target.value)}
            disabled={readOnly || disabled}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">My Edits</p>
            {!readOnly ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={onResetToAiDraft}
                disabled={disabled || !hasEdits}
              >
                <RotateCcw className="mr-1 size-3" />
                Reset to Ava&apos;s draft
              </Button>
            ) : null}
          </div>
          <Textarea
            value={editBody}
            onChange={(event) => onEditBody(event.target.value)}
            rows={8}
            disabled={readOnly || disabled}
            className="min-h-[160px] resize-y font-mono text-sm leading-relaxed"
          />
        </div>
      </div>

      {generation.status === "draft" ? (
        <footer className="sticky bottom-0 shrink-0 border-t border-border/60 bg-card/95 px-3 py-2.5 backdrop-blur-sm">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onSaveDraft} disabled={disabled || actionId === "edit"}>
              Save Draft
            </Button>
            <Button size="sm" onClick={onApprove} disabled={disabled || actionId === "approve"}>
              Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject} disabled={disabled || actionId === "reject"}>
              Reject
            </Button>
            <Button size="sm" variant="outline" onClick={onRegenerate} disabled={disabled || actionId === "generate"}>
              Regenerate
            </Button>
          </div>
        </footer>
      ) : null}

      {generation.status === "approved" ? (
        <footer className="shrink-0 space-y-2 border-t border-border/60 bg-emerald-50/60 px-3 py-3 text-xs text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100">
          <p>Approved — queue for operator send review. AI output is never auto-sent.</p>
          <Button size="sm" asChild>
            <Link href={GROWTH_SEQUENCE_SEND_REVIEW_HREF}>{GROWTH_SEQUENCE_SEND_REVIEW_LABEL}</Link>
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {GROWTH_SEQUENCE_SEND_REVIEW_CONTROL_PLANE_LABELS.join(" · ")}
          </p>
        </footer>
      ) : null}
    </section>
  )
}
