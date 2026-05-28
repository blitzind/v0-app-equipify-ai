"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import {
  GROWTH_CONTACT_CONFLICT_REVIEW_QA_MARKER,
  GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER,
  GROWTH_EVIDENCE_FUSION_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-contact-identity-fusion"
import { formatProspectSearchContactConflictLabel } from "@/lib/growth/prospect-search/prospect-search-contact-identity-operator-review"
import type { ProspectSearchContactIdentityOperatorAction } from "@/lib/growth/prospect-search/prospect-search-contact-identity-types"

function conflictBadgeVariant(
  status: string | null | undefined,
): "default" | "outline" | "destructive" | "secondary" {
  if (!status || status === "no_conflict" || status === "likely_same_person") return "default"
  if (status === "channel_conflict" || status === "likely_different_people") return "destructive"
  if (status === "needs_review" || status === "branch_conflict") return "secondary"
  return "outline"
}

export function ProspectSearchContactIdentityPanel({
  row,
  compact = false,
  onOperatorReview,
}: {
  row: Pick<
    GrowthProspectSearchPeopleResultRow,
    | "contact_identity_key"
    | "identity_confidence"
    | "merge_confidence"
    | "conflict_status"
    | "source_count"
    | "operator_confirmed"
    | "identity_resolution"
  >
  compact?: boolean
  onOperatorReview?: (action: ProspectSearchContactIdentityOperatorAction) => void
}) {
  const resolution = row.identity_resolution
  if (!resolution && !row.contact_identity_key) return null

  const conflicts = resolution?.conflicts ?? []
  const canonical = resolution?.canonical

  return (
    <div
      className={compact ? "space-y-2 text-xs" : "space-y-3 text-xs"}
      data-qa-marker={GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER}
      data-evidence-fusion-marker={GROWTH_EVIDENCE_FUSION_QA_MARKER}
      data-contact-conflict-review-marker={GROWTH_CONTACT_CONFLICT_REVIEW_QA_MARKER}
    >
      <div className="flex flex-wrap gap-2">
        {row.identity_confidence != null ? (
          <Badge variant="outline">
            Identity {Math.round(row.identity_confidence * 100)}%
          </Badge>
        ) : null}
        {row.merge_confidence != null ? (
          <Badge variant="secondary">Merge {Math.round(row.merge_confidence * 100)}%</Badge>
        ) : null}
        {(row.source_count ?? 0) > 0 ? (
          <Badge variant="outline">{row.source_count} source(s)</Badge>
        ) : null}
        {row.conflict_status ? (
          <Badge variant={conflictBadgeVariant(row.conflict_status)}>
            {formatProspectSearchContactConflictLabel(row.conflict_status)}
          </Badge>
        ) : null}
        {row.operator_confirmed ? <Badge>Operator confirmed</Badge> : null}
      </div>

      {canonical ? (
        <div className="rounded-md border border-border p-2">
          <p className="font-medium text-foreground">Canonical snapshot</p>
          <ul className="mt-2 space-y-0.5 text-muted-foreground">
            <li>Name: {canonical.display_name}</li>
            <li>Title: {canonical.best_title ?? "—"}</li>
            <li>Email: {canonical.best_email.value ?? "—"}</li>
            <li>Phone: {canonical.best_phone.value ?? "—"}</li>
            {canonical.best_linkedin.value ? (
              <li>LinkedIn reference: {canonical.best_linkedin.value}</li>
            ) : null}
          </ul>
          {canonical.selection_summary.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {canonical.selection_summary.slice(0, compact ? 3 : 5).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {resolution?.source_records && resolution.source_records.length > 1 ? (
        <div className="rounded-md border border-border p-2">
          <p className="font-medium text-foreground">Merged sources</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {resolution.source_records.slice(0, compact ? 3 : 6).map((record) => (
              <li key={record.contact_id}>
                {record.provider.replace(/_/g, " ")} · {record.full_name}
                {record.title ? ` · ${record.title}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <ul className="space-y-1 text-amber-900">
          {conflicts.slice(0, compact ? 2 : 4).map((conflict) => (
            <li key={conflict.label}>
              {conflict.label}: {conflict.detail}
            </li>
          ))}
        </ul>
      ) : null}

      {resolution?.timeline && resolution.timeline.length > 0 && !compact ? (
        <div className="rounded-md border border-border p-2">
          <p className="font-medium text-foreground">Identity timeline</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {resolution.timeline.slice(0, 6).map((event) => (
              <li key={event.id}>
                {event.label}: {event.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {onOperatorReview && conflicts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onOperatorReview("confirm_same_person")}>
            Confirm same person
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onOperatorReview("keep_separate")}>
            Keep separate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOperatorReview("mark_channel_role_shared")}
          >
            Mark role/shared channel
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function enrichPeopleRowWithIdentityReview(
  row: GrowthProspectSearchPeopleResultRow,
  resolution: GrowthProspectSearchPeopleResultRow["identity_resolution"],
): GrowthProspectSearchPeopleResultRow {
  if (!resolution) return row
  return {
    ...row,
    contact_identity_key: resolution.identity_key,
    identity_confidence: resolution.identity_confidence,
    merge_confidence: resolution.merge_confidence,
    conflict_status: resolution.conflict_status,
    source_count: resolution.source_count,
    operator_confirmed: resolution.operator_confirmed,
    identity_resolution: resolution,
    email: resolution.canonical.best_email.value ?? row.email,
    phone: resolution.canonical.best_phone.value ?? row.phone,
    title: resolution.canonical.best_title ?? row.title,
    linkedin_url: resolution.canonical.best_linkedin.value ?? row.linkedin_url,
  }
}
