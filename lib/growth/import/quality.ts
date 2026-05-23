import type { ImportPipelineSummary, NormalizedImportRow } from "@/lib/growth/import/types"

function percentFilled(rows: NormalizedImportRow[], pick: (row: NormalizedImportRow) => boolean): number {
  if (rows.length === 0) return 0
  const filled = rows.filter(pick).length
  return Math.round((filled / rows.length) * 10000) / 100
}

export function computeImportFillMetrics(rows: NormalizedImportRow[]): Pick<
  ImportPipelineSummary,
  "emailFillPercent" | "phoneFillPercent" | "websiteFillPercent" | "decisionMakerFillPercent"
> {
  return {
    emailFillPercent: percentFilled(rows, (row) => Boolean(row.email)),
    phoneFillPercent: percentFilled(rows, (row) => Boolean(row.phone)),
    websiteFillPercent: percentFilled(rows, (row) => Boolean(row.website)),
    decisionMakerFillPercent: percentFilled(rows, (row) => Boolean(row.contactName || row.firstName)),
  }
}

export function computeImportQualityScore(input: {
  emailFillPercent: number
  phoneFillPercent: number
  websiteFillPercent: number
  decisionMakerFillPercent: number
  errorRate: number
}): number {
  const fillScore =
    input.emailFillPercent * 0.25 +
    input.phoneFillPercent * 0.25 +
    input.websiteFillPercent * 0.25 +
    input.decisionMakerFillPercent * 0.25
  const penalty = Math.min(100, input.errorRate * 100)
  return Math.max(0, Math.min(100, Math.round(fillScore - penalty * 0.5)))
}

export function computeImportPipelineSummary(input: {
  rows: NormalizedImportRow[]
  imported: number
  updated: number
  skipped: number
  duplicate: number
  error: number
}): ImportPipelineSummary {
  const fill = computeImportFillMetrics(input.rows)
  const total = input.rows.length || 1
  const errorRate = input.error / total
  return {
    imported: input.imported,
    updated: input.updated,
    skipped: input.skipped,
    duplicate: input.duplicate,
    error: input.error,
    ...fill,
    importQualityScore: computeImportQualityScore({ ...fill, errorRate }),
  }
}

export type BatchLeadOutcomeCounts = {
  researchCompletedCount: number
  callReadyCount: number
  decisionMakerConfirmedCount: number
  interestedCount: number
  convertedCount: number
}

export function computeBatchLeadOutcomeCounts(
  leads: Array<{
    status: string
    lastResearchedAt: string | null
    decisionMakerStatus: string | null
    callDisposition: string | null
  }>,
): BatchLeadOutcomeCounts {
  return {
    researchCompletedCount: leads.filter((l) => Boolean(l.lastResearchedAt)).length,
    callReadyCount: leads.filter((l) => l.status === "call_ready").length,
    decisionMakerConfirmedCount: leads.filter((l) => l.decisionMakerStatus === "confirmed").length,
    interestedCount: leads.filter((l) => l.callDisposition === "interested").length,
    convertedCount: leads.filter((l) => l.status === "converted").length,
  }
}
