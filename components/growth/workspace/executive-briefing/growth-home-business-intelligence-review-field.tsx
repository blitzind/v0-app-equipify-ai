"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthHomeConfidenceBadge } from "@/components/growth/workspace/executive-briefing/growth-home-confidence-badge"
import type { BusinessIntelligenceEvidenceSummary } from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import {
  reviewDecisionLabel,
  type BusinessIntelligenceReviewDecisionSummary,
  type BusinessIntelligenceReviewDecisionType,
  type BusinessIntelligenceReviewFieldKey,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import type { BusinessIntelligenceReportField } from "@/lib/growth/business-intelligence"
import { isUnknownField } from "@/lib/growth/business-intelligence"

function confidencePercent(value: number): number {
  return Math.round(value <= 1 ? value * 100 : value)
}

function formatFieldValue(value: string | string[] | null): React.ReactNode {
  if (value == null) return null
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  return <p>{value}</p>
}

function EvidenceList({
  evidenceIds,
  evidenceById,
}: {
  evidenceIds: string[]
  evidenceById: Record<string, BusinessIntelligenceEvidenceSummary>
}) {
  if (evidenceIds.length === 0) {
    return <p className="text-xs text-muted-foreground">No linked evidence items.</p>
  }

  return (
    <ul className="space-y-2">
      {evidenceIds.map((evidenceId) => {
        const evidence = evidenceById[evidenceId]
        if (!evidence) {
          return (
            <li key={evidenceId} className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
              Evidence {evidenceId} (details unavailable)
            </li>
          )
        }

        return (
          <li key={evidenceId} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{evidence.provider.replaceAll("_", " ")}</span>
              <GrowthHomeConfidenceBadge percent={confidencePercent(evidence.confidence)} />
            </div>
            {evidence.page_title ? <p className="mt-1 font-medium">{evidence.page_title}</p> : null}
            {evidence.source_url ? (
              <a
                href={evidence.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-primary underline-offset-2 hover:underline"
              >
                {evidence.source_url}
              </a>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function valueToEditableText(value: string | string[] | null): string {
  if (value == null) return ""
  return Array.isArray(value) ? value.join("\n") : value
}

function editableTextToValue(text: string, isList: boolean): string | string[] {
  if (!isList) return text.trim()
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export function GrowthHomeBusinessIntelligenceReviewField({
  fieldKey,
  title,
  field,
  evidenceById,
  decision,
  requiresReview = false,
  busy = false,
  onDecision,
}: {
  fieldKey: BusinessIntelligenceReviewFieldKey
  title: string
  field: BusinessIntelligenceReportField
  evidenceById: Record<string, BusinessIntelligenceEvidenceSummary>
  decision?: BusinessIntelligenceReviewDecisionSummary
  requiresReview?: boolean
  busy?: boolean
  onDecision: (input: {
    fieldKey: BusinessIntelligenceReviewFieldKey
    decision: BusinessIntelligenceReviewDecisionType
    approvedValue?: string | string[] | null
  }) => Promise<void>
}) {
  const unknown = isUnknownField(field)
  const isList = Array.isArray(field.value)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(valueToEditableText(field.value))

  const displayValue = useMemo(() => {
    if (!decision) return field.value
    if (decision.decision === "dismissed" || decision.decision === "marked_unknown") return null
    return decision.approved_value_json ?? field.value
  }, [decision, field.value])

  return (
    <div className="rounded-lg border border-border/70 p-3" data-qa-review-field={fieldKey}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <div className="flex flex-wrap items-center gap-2">
          {decision ? (
            <GrowthBadge label={reviewDecisionLabel(decision.decision)} tone="status" />
          ) : unknown ? (
            <GrowthBadge label="Not yet known" tone="neutral" />
          ) : (
            <GrowthHomeConfidenceBadge percent={confidencePercent(field.confidence)} />
          )}
          {requiresReview && !decision ? (
            <GrowthBadge label="Review required" tone="attention" />
          ) : null}
        </div>
      </div>

      {unknown && !decision ? (
        <p className="mt-2 text-sm text-muted-foreground">{field.explanation}</p>
      ) : (
        <div className="mt-2 space-y-2 text-sm">{formatFieldValue(displayValue)}</div>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            rows={isList ? 4 : 3}
            placeholder={isList ? "One item per line" : "Enter corrected value"}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() =>
                void onDecision({
                  fieldKey,
                  decision: "edited",
                  approvedValue: editableTextToValue(editText, isList),
                }).then(() => setEditing(false))
              }
            >
              Save edit
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || unknown}
            onClick={() => void onDecision({ fieldKey, decision: "approved" })}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setEditText(valueToEditableText(displayValue))
              setEditing(true)
            }}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void onDecision({ fieldKey, decision: "dismissed" })}
          >
            Dismiss
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void onDecision({ fieldKey, decision: "marked_unknown" })}
          >
            Mark unknown
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void onDecision({ fieldKey, decision: "needs_more_info" })}
          >
            Needs more info
          </Button>
          {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
        </div>
      )}

      <Accordion type="single" collapsible className="mt-3">
        <AccordionItem value="evidence" className="border-none">
          <AccordionTrigger className="py-1 text-xs font-medium hover:no-underline">
            View evidence ({field.supporting_evidence_ids.length})
          </AccordionTrigger>
          <AccordionContent>
            <EvidenceList evidenceIds={field.supporting_evidence_ids} evidenceById={evidenceById} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
