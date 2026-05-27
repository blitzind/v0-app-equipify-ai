import { createHash } from "node:crypto"
import type { GrowthCompanySignalCategory } from "@/lib/growth/company-signals/company-signal-types"

export function buildCompanySignalDedupeHash(input: {
  company_candidate_id: string
  signal_category: GrowthCompanySignalCategory
  signal_type: string
}): string {
  const key = [
    input.company_candidate_id,
    input.signal_category,
    input.signal_type.toLowerCase(),
  ].join("|")
  return createHash("sha256").update(key).digest("hex").slice(0, 40)
}

export type NormalizedCompanySignal = {
  signal_category: GrowthCompanySignalCategory
  signal_type: string
  signal_value: string
  confidence: number
  evidence: import("@/lib/growth/company-signals/company-signal-types").GrowthCompanySignalEvidence[]
  source_attribution: import("@/lib/growth/company-signals/company-signal-types").GrowthCompanySignalAttribution[]
  observed_at: string
  dedupe_hash: string
  metadata: Record<string, unknown>
}

export function dedupeCompanySignals(rows: NormalizedCompanySignal[]): NormalizedCompanySignal[] {
  const byHash = new Map<string, NormalizedCompanySignal>()
  for (const row of rows) {
    const existing = byHash.get(row.dedupe_hash)
    if (!existing || row.confidence > existing.confidence) {
      byHash.set(row.dedupe_hash, row)
    }
  }
  return [...byHash.values()]
}
