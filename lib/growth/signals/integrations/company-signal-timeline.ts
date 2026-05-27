/** Chronological Intent Signals timeline for company/domain views. Client-safe. */

import {
  filterSignalsForCompanyRollup,
  formatSignalTypeLabel,
  type GrowthCompanySignalRollupInput,
} from "@/lib/growth/signals/company-signal-rollup"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"

export type GrowthCompanySignalTimelineEntry = {
  id: string
  signal_type: GrowthSignalRow["signal_type"]
  signal_type_label: string
  title: string
  evidence_summary: string
  source_label: string
  signal_score: number
  urgency: GrowthSignalRow["urgency"]
  occurred_at: string
}

export type GrowthCompanySignalTimelineDay = {
  date: string
  entries: GrowthCompanySignalTimelineEntry[]
}

export type GrowthCompanySignalTimeline = {
  domain: string | null
  company_name: string | null
  total_entries: number
  days: GrowthCompanySignalTimelineDay[]
}

function dayKey(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return "unknown"
  return new Date(ms).toISOString().slice(0, 10)
}

function sourceLabelForSignal(signal: GrowthSignalRow): string {
  const publisher = signal.metadata?.publisher
  if (typeof publisher === "string" && publisher.trim()) return publisher.trim()
  return signal.provider_key.replace(/_/g, " ")
}

export function buildCompanySignalTimeline(input: {
  domain?: string | null
  company_id?: string | null
  company_name?: string | null
  signals: GrowthSignalRow[]
}): GrowthCompanySignalTimeline {
  const target: GrowthCompanySignalRollupInput = {
    domain: input.domain,
    company_id: input.company_id,
    company_name: input.company_name,
    signals: input.signals,
  }

  const matched = filterSignalsForCompanyRollup(input.signals, target)
    .filter((signal) => signal.suppression_state === "active")
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))

  const byDay = new Map<string, GrowthCompanySignalTimelineEntry[]>()

  for (const signal of matched) {
    const key = dayKey(signal.occurred_at)
    const entries = byDay.get(key) ?? []
    entries.push({
      id: signal.id,
      signal_type: signal.signal_type,
      signal_type_label: formatSignalTypeLabel(signal.signal_type),
      title: signal.title?.trim() || signal.evidence_summary?.trim() || formatSignalTypeLabel(signal.signal_type),
      evidence_summary: signal.evidence_summary?.trim() || "—",
      source_label: sourceLabelForSignal(signal),
      signal_score: signal.signal_score,
      urgency: signal.urgency,
      occurred_at: signal.occurred_at,
    })
    byDay.set(key, entries)
  }

  const days = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, entries]) => ({ date, entries }))

  return {
    domain: input.domain ?? null,
    company_name: input.company_name ?? null,
    total_entries: matched.length,
    days,
  }
}
