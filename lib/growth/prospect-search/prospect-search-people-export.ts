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
    "verification_status",
    "email_eligibility",
    "call_eligibility",
    "sms_eligibility",
    "outreach_ready",
    "call_ready",
    "sms_ready",
    "call_block_reason",
    "sms_block_reason",
    "compliance_status",
    "last_checked_at",
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
        csvEscape(row.verification_status),
        csvEscape(row.email_eligibility),
        csvEscape(row.call_eligibility),
        csvEscape(row.sms_eligibility),
        csvEscape(row.outreach_ready ? "true" : "false"),
        csvEscape(row.call_ready ? "true" : "false"),
        csvEscape(row.sms_ready ? "true" : "false"),
        csvEscape(row.call_block_reason),
        csvEscape(row.sms_block_reason),
        csvEscape(row.compliance_status),
        csvEscape(row.last_checked_at),
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
