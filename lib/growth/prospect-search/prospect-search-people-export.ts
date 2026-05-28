/** CSV export for Prospect Search people rows. Client-safe builder + server audit hook. */

import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

function csvEscape(value: string | null | undefined): string {
  const text = (value ?? "").replace(/"/g, '""')
  return `"${text}"`
}

export function buildProspectSearchPeopleCsv(
  rows: GrowthProspectSearchPeopleResultRow[],
): string {
  const headers = [
    "full_name",
    "title",
    "company_name",
    "email",
    "phone",
    "linkedin_url",
    "source_label",
    "source_page_url",
    "confidence",
    "confidence_label",
    "confidence_reason",
    "verification_status",
    "email_verification_depth",
    "phone_verification_depth",
    "freshness_status",
    "last_checked_at",
    "last_verified_at",
    "discovered_at",
    "verification_expires_at",
    "email_eligibility",
    "call_eligibility",
    "sms_eligibility",
    "outreach_ready",
    "call_ready",
    "sms_ready",
    "call_block_reason",
    "sms_block_reason",
    "compliance_status",
    "stale_warning",
    "persona_type",
    "persona_label",
    "persona_icp_relevance",
    "persona_buying_influence",
    "outreach_rank_score",
    "priority_tier",
    "ranking_reasons",
    "ranking_risks",
    "recommended_next_action",
    "is_recommended_contact",
    "is_secondary_contact",
    "contact_identity_key",
    "identity_confidence",
    "merge_confidence",
    "conflict_status",
    "source_count",
    "operator_confirmed",
    "conflict_warnings",
  ]

  const lines = [headers.join(",")]
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.full_name),
        csvEscape(row.title ?? row.role),
        csvEscape(row.company_name),
        csvEscape(row.email),
        csvEscape(row.phone),
        csvEscape(row.linkedin_url ?? null),
        csvEscape(row.source_label),
        csvEscape(row.source_page_url),
        csvEscape(String(Math.round(row.confidence * 100))),
        csvEscape(row.confidence_label ?? null),
        csvEscape(row.confidence_reason ?? null),
        csvEscape(row.verification_status),
        csvEscape(row.email_verification_depth ?? null),
        csvEscape(row.phone_verification_depth ?? null),
        csvEscape(row.freshness_status ?? null),
        csvEscape(row.last_checked_at),
        csvEscape(row.last_verified_at ?? null),
        csvEscape(row.discovered_at ?? null),
        csvEscape(row.verification_expires_at ?? null),
        csvEscape(row.email_eligibility),
        csvEscape(row.call_eligibility),
        csvEscape(row.sms_eligibility),
        csvEscape(row.outreach_ready ? "true" : "false"),
        csvEscape(row.call_ready ? "true" : "false"),
        csvEscape(row.sms_ready ? "true" : "false"),
        csvEscape(row.call_block_reason),
        csvEscape(row.sms_block_reason),
        csvEscape(row.compliance_status),
        csvEscape(row.stale_warning),
        csvEscape(row.persona_type ?? "unknown"),
        csvEscape(row.persona_label ?? ""),
        csvEscape(String(Math.round((row.persona_icp_relevance ?? 0) * 100))),
        csvEscape(String(Math.round((row.persona_buying_influence ?? 0) * 100))),
        csvEscape(String(Math.round((row.outreach_rank_score ?? 0) * 100))),
        csvEscape(row.priority_tier ?? "review"),
        csvEscape((row.ranking_reasons ?? []).join("; ")),
        csvEscape((row.ranking_risks ?? []).join("; ")),
        csvEscape(row.recommended_next_action ?? ""),
        csvEscape(row.is_recommended_contact ? "true" : "false"),
        csvEscape(row.is_secondary_contact ? "true" : "false"),
        csvEscape(row.contact_identity_key),
        csvEscape(row.identity_confidence != null ? String(Math.round(row.identity_confidence * 100)) : null),
        csvEscape(row.merge_confidence != null ? String(Math.round(row.merge_confidence * 100)) : null),
        csvEscape(row.conflict_status),
        csvEscape(row.source_count != null ? String(row.source_count) : null),
        csvEscape(row.operator_confirmed ? "true" : "false"),
        csvEscape((row.identity_resolution?.conflict_flags ?? []).join("; ")),
      ].join(","),
    )
  }
  return lines.join("\n")
}

export function prospectSearchPeopleExportFilename(count: number): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `prospect-search-people-${count}-${stamp}.csv`
}

export function logProspectSearchPeopleExport(input: {
  userId?: string | null
  count: number
  scope: "selected" | "filtered" | "visible"
}): void {
  console.info(
    JSON.stringify({
      source: "growth-prospect-search",
      event: "people_csv_export",
      ts: new Date().toISOString(),
      user_id: input.userId ?? null,
      count: input.count,
      scope: input.scope,
    }),
  )
}
