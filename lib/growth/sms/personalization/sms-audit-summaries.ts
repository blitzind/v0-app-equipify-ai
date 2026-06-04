/** SMS audit summary helpers (Phase 5.3). Client-safe. */

import { listAvailableContextSources } from "@/lib/growth/outreach/personalization/context-utilization"
import { listAvailableMemorySignals } from "@/lib/growth/outreach/personalization/memory-utilization"
import { summarizeSmsMemoryContinuity } from "@/lib/growth/sms/personalization/sms-memory-awareness"
import type { SmsPersonalizationAudit } from "@/lib/growth/sms/personalization/sms-personalization-types"

export function summarizeSmsContextUsed(audit: SmsPersonalizationAudit): string[] {
  const packet = audit.context.packet
  const available = listAvailableContextSources(packet)
  const used = new Set<string>()

  if (audit.openingHook.evidenceSource) used.add(audit.openingHook.evidenceSource)
  if (audit.cta.evidenceSource) used.add(audit.cta.evidenceSource)
  for (const key of audit.contextQuality?.contextSourcesUsed ?? []) used.add(key)

  const labels = [...used].filter(Boolean)
  if (labels.length === 0 && available.length > 0) {
    return available.slice(0, 4)
  }
  return labels
}

export function summarizeSmsMemoryUsed(audit: SmsPersonalizationAudit): string[] {
  const packet = audit.context.packet
  const memorySignals = audit.memoryQuality?.memorySignalsUsed ?? []
  const continuity = summarizeSmsMemoryContinuity(packet)

  if (memorySignals.length > 0) {
    return [...memorySignals, ...continuity].slice(0, 6)
  }

  const available = listAvailableMemorySignals(packet)
  if (available.length === 0) return []
  return continuity.length > 0 ? continuity : available.slice(0, 3)
}
