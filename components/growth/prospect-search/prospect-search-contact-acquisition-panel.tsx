"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import {
  formatWebsiteEvidenceQualityLabel,
  formatWebsitePageTypeLabel,
  GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER,
  GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER,
  GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
} from "@/lib/growth/contact-discovery/website-acquisition-metadata-bridge"
import type { WebsiteExtractionDiagnosticsSnapshot } from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"

function evidenceBadgeVariant(
  label: string | null | undefined,
): "default" | "outline" | "destructive" | "secondary" {
  if (label === "strong_public_evidence" || label === "moderate_public_evidence") return "default"
  if (label === "invalid") return "destructive"
  if (label === "weak_public_evidence") return "secondary"
  return "outline"
}

function formatClassificationLabel(value: string | null | undefined): string {
  if (!value) return "Unknown"
  return value.replace(/_/g, " ")
}

export function ProspectSearchContactAcquisitionPanel({
  row,
  diagnostics,
  compact = false,
}: {
  row: Pick<
    GrowthProspectSearchPeopleResultRow,
    | "source_page_type"
    | "source_page_url"
    | "email_classification"
    | "phone_classification"
    | "evidence_quality_score"
    | "evidence_quality_label"
    | "evidence_quality_reasons"
    | "extraction_risks"
    | "branch_name"
    | "branch_city"
    | "branch_state"
    | "branch_phone"
    | "location_confidence"
    | "linkedin_company_url"
    | "linkedin_reference_label"
  >
  diagnostics?: WebsiteExtractionDiagnosticsSnapshot | null
  compact?: boolean
}) {
  const hasAcquisition =
    row.source_page_type ||
    row.email_classification ||
    row.phone_classification ||
    row.evidence_quality_label ||
    row.linkedin_reference_label ||
    row.branch_name ||
    diagnostics

  if (!hasAcquisition) return null

  return (
    <div
      className={compact ? "space-y-2 text-xs" : "space-y-3 text-xs"}
      data-qa-marker={GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER}
      data-website-extraction-quality-marker={GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER}
      data-public-profile-reference-marker={GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER}
    >
      <div className="flex flex-wrap gap-2">
        {row.evidence_quality_label ? (
          <Badge variant={evidenceBadgeVariant(row.evidence_quality_label)}>
            {formatWebsiteEvidenceQualityLabel(row.evidence_quality_label)}
          </Badge>
        ) : null}
        {row.source_page_type ? (
          <Badge variant="outline">{formatWebsitePageTypeLabel(row.source_page_type)}</Badge>
        ) : null}
        {row.email_classification ? (
          <Badge variant="secondary">Email: {formatClassificationLabel(row.email_classification)}</Badge>
        ) : null}
        {row.phone_classification ? (
          <Badge variant="secondary">Phone: {formatClassificationLabel(row.phone_classification)}</Badge>
        ) : null}
      </div>

      {row.evidence_quality_score != null ? (
        <p className="text-muted-foreground">
          Evidence quality score {Math.round(row.evidence_quality_score)}
        </p>
      ) : null}

      {row.evidence_quality_reasons.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
          {row.evidence_quality_reasons.slice(0, compact ? 3 : 6).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {row.extraction_risks.length > 0 ? (
        <ul className="space-y-0.5 text-amber-900">
          {row.extraction_risks.slice(0, compact ? 2 : 4).map((risk) => (
            <li key={risk}>Risk: {risk}</li>
          ))}
        </ul>
      ) : null}

      {row.branch_name || row.branch_city ? (
        <p className="text-muted-foreground">
          Branch: {[row.branch_name, row.branch_city, row.branch_state].filter(Boolean).join(" · ")}
          {row.branch_phone ? ` · ${row.branch_phone}` : ""}
          {row.location_confidence != null
            ? ` (${Math.round(row.location_confidence * 100)}% location confidence)`
            : ""}
        </p>
      ) : null}

      {row.linkedin_reference_label ? (
        <p className="text-muted-foreground" data-public-profile-reference-marker={GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER}>
          {row.linkedin_reference_label}
        </p>
      ) : null}

      {diagnostics ? (
        <div className="rounded-md border border-border p-2">
          <p className="font-medium text-foreground">Website extraction diagnostics</p>
          <ul className="mt-2 space-y-0.5 text-muted-foreground">
            <li>
              Pages crawled: {diagnostics.pages_crawled.length} · skipped: {diagnostics.pages_skipped.length}
              {diagnostics.pages_failed.length > 0
                ? ` · failed: ${diagnostics.pages_failed.length}`
                : ""}
            </li>
            <li>
              Contacts {diagnostics.contacts_found} · emails {diagnostics.emails_found} · phones{" "}
              {diagnostics.phones_found} · LinkedIn refs {diagnostics.linkedin_references_found}
            </li>
            {diagnostics.summary ? <li>{diagnostics.summary}</li> : null}
            {diagnostics.failure_reason ? <li>Failure: {diagnostics.failure_reason}</li> : null}
            {diagnostics.unreachable ? <li>Website unreachable</li> : null}
            {diagnostics.robots_or_blocked ? <li>Robots or blocked response detected</li> : null}
            {diagnostics.extraction_warnings.slice(0, 3).map((warning) => (
              <li key={warning}>Warning: {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function resolvePeopleRowAcquisitionEmptyHint(
  row: GrowthProspectSearchPeopleResultRow,
): string | null {
  const diagnostics = row.company.contact_intelligence?.website_extraction_diagnostics
  if (diagnostics?.summary) return diagnostics.summary
  if (diagnostics?.unreachable) return "Website unreachable — could not crawl public pages"
  if (diagnostics?.contacts_found === 0 && (diagnostics?.pages_crawled.length ?? 0) > 0) {
    return "Website crawl found no team/contact pages"
  }
  if (row.email_classification === "generic_info_email" && !row.title) {
    return "Only generic role emails found"
  }
  if (row.phone_classification && !row.title) {
    return "Phone found on contact page, no named decision maker"
  }
  if (row.linkedin_company_url && !row.linkedin_reference_label) {
    return "LinkedIn company page found, no public staff links found"
  }
  return null
}
