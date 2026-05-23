import type { NormalizedImportRow } from "@/lib/growth/import/types"

const WEIGHTS = {
  email: 25,
  phone: 35,
  website: 10,
  linkedin: 10,
  title: 10,
  company: 10,
} as const

export function computeContactabilityScore(row: NormalizedImportRow): number {
  let score = 0
  if (row.email) score += WEIGHTS.email
  if (row.phone) score += WEIGHTS.phone
  if (row.website) score += WEIGHTS.website
  if (row.linkedinUrl) score += WEIGHTS.linkedin
  if (row.title?.trim()) score += WEIGHTS.title
  if (row.companyName.trim()) score += WEIGHTS.company
  return Math.min(100, score)
}

export function computeBatchContactabilityAverage(rows: NormalizedImportRow[]): number {
  if (rows.length === 0) return 0
  const total = rows.reduce((sum, row) => sum + computeContactabilityScore(row), 0)
  return Math.round((total / rows.length) * 100) / 100
}

/** Callable lead estimate: company + phone, no blocking validation errors, would be imported. */
export function isEstimatedCallReadyLead(input: {
  row: NormalizedImportRow
  hasError: boolean
  proposedAction: "create_new" | "merge" | "skip"
}): boolean {
  if (input.hasError) return false
  if (input.proposedAction === "skip") return false
  if (!input.row.companyName.trim()) return false
  if (!input.row.phone) return false
  return true
}

export function countEstimatedCallReadyLeads(
  previews: Array<{
    normalized: NormalizedImportRow
    issues: { severity: string }[]
    proposedAction: "create_new" | "merge" | "skip"
  }>,
): number {
  return previews.filter((preview) =>
    isEstimatedCallReadyLead({
      row: preview.normalized,
      hasError: preview.issues.some((issue) => issue.severity === "error"),
      proposedAction: preview.proposedAction,
    }),
  ).length
}
