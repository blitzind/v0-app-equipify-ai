/** Deterministic evidence packaging for Signal Copilot — no raw payloads. */

import {
  buildCompanySignalRollup,
  formatSignalTypeLabel,
  type GrowthCompanySignalRollupInput,
} from "@/lib/growth/signals/company-signal-rollup"
import { readPersonSignalMetadata } from "@/lib/growth/signals/person-signal-metadata"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import {
  GROWTH_SIGNAL_COPILOT_QA_MARKER,
  type SignalCopilotCompanyEvidencePacket,
  type SignalCopilotEvidenceSignal,
} from "@/lib/growth/signals/ai/signal-copilot-types"

const INTERNAL_METADATA_KEYS = new Set([
  "raw_payload",
  "person_external_id",
  "people_provider",
  "provider_debug",
  "ingestion_cursor",
  "dedupe_hash",
])

function safeSummary(signal: GrowthSignalRow): string {
  const excerpt = signal.evidence_summary?.trim()
  if (excerpt) return excerpt.slice(0, 240)
  if (signal.title?.trim()) return signal.title.trim().slice(0, 240)
  return `${formatSignalTypeLabel(signal.signal_type)} activity`
}

function toEvidenceSignal(signal: GrowthSignalRow): SignalCopilotEvidenceSignal {
  return {
    signal_id: signal.id,
    type: signal.signal_type,
    summary: safeSummary(signal),
    score: signal.signal_score,
    occurred_at: signal.occurred_at ?? null,
    category: signal.category?.trim() || null,
    urgency: signal.urgency ?? null,
  }
}

export function stripInternalSignalMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (INTERNAL_METADATA_KEYS.has(key)) continue
    if (key.startsWith("_")) continue
    out[key] = value
  }
  return out
}

export function buildSignalCopilotCompanyEvidencePacket(
  input: GrowthCompanySignalRollupInput & {
    territory_alignment?: string | null
    max_recent_signals?: number
  },
): SignalCopilotCompanyEvidencePacket {
  const rollupInput: GrowthCompanySignalRollupInput = {
    domain: input.domain,
    company_id: input.company_id,
    company_name: input.company_name,
    organization_id: input.organization_id,
    signals: input.signals,
    watchlist_matches: input.watchlist_matches,
    now: input.now,
  }

  const rollup = buildCompanySignalRollup(rollupInput)
  const matched = input.signals.filter(
    (signal) =>
      signal.suppression_state === "active" &&
      rollup.signal_ids.includes(signal.id),
  )

  const sorted = [...matched].sort(
    (a, b) => Date.parse(b.occurred_at ?? "") - Date.parse(a.occurred_at ?? ""),
  )

  const maxRecent = input.max_recent_signals ?? 8
  const recent_signals = sorted.slice(0, maxRecent).map(toEvidenceSignal)

  const company =
    input.company_name?.trim() ||
    input.domain?.trim() ||
    sorted[0]?.company_name?.trim() ||
    "Unknown company"

  return {
    qa_marker: GROWTH_SIGNAL_COPILOT_QA_MARKER,
    company,
    domain: input.domain?.trim() || sorted[0]?.domain?.trim() || null,
    momentum_label: rollup.momentum_label,
    momentum_score: rollup.momentum_score,
    recent_signals,
    watchlist_matches: rollup.watchlist_matches.map((row) => row.watchlist_name),
    territory_alignment: input.territory_alignment?.trim() || null,
    signal_counts: {
      news: rollup.news_count,
      jobs: rollup.job_posting_count,
      hiring: rollup.hiring_signal_count,
      job_changes: rollup.job_change_count,
      promotions: rollup.promotion_count,
    },
  }
}

export function buildSignalCopilotEvidencePacketJson(
  packet: SignalCopilotCompanyEvidencePacket,
): Record<string, unknown> {
  return {
    qa_marker: packet.qa_marker,
    company: packet.company,
    domain: packet.domain,
    momentum_label: packet.momentum_label,
    momentum_score: packet.momentum_score,
    recent_signals: packet.recent_signals.map((signal) => ({
      type: signal.type,
      summary: signal.summary,
      score: signal.score,
      occurred_at: signal.occurred_at,
      category: signal.category,
    })),
    watchlist_matches: packet.watchlist_matches,
    territory_alignment: packet.territory_alignment,
    signal_counts: packet.signal_counts,
  }
}

export function personSignalDisplayLabel(signal: GrowthSignalRow): string | null {
  const meta = readPersonSignalMetadata(signal)
  return meta.person_name?.trim() || signal.contact_display_label?.trim() || null
}
