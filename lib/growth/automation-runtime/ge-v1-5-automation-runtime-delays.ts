/** GE-v1-5 — Idempotent delay scheduling (client-safe). */

import type {
  GeV15AutomationRuntimeTrigger,
  GeV15DelaySpec,
  GeV15PendingDelay,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

export function resolveGeV15DelayMs(spec: GeV15DelaySpec): number {
  switch (spec.unit) {
    case "minutes":
      return spec.amount * MS_PER_MINUTE
    case "hours":
      return spec.amount * MS_PER_HOUR
    case "days":
      return spec.amount * MS_PER_DAY
    default:
      return 0
  }
}

export function buildGeV15DelayDedupeKey(input: {
  playbookId: string
  trigger: GeV15AutomationRuntimeTrigger
  leadId: string
}): string {
  return `delay:${input.leadId}:${input.playbookId}:${input.trigger}`
}

export function scheduleGeV15Delay(input: {
  playbookId: string
  trigger: GeV15AutomationRuntimeTrigger
  leadId: string
  delay: GeV15DelaySpec
  existing: GeV15PendingDelay[]
  now?: Date
}): { scheduled: GeV15PendingDelay | null; deduped: boolean } {
  const dedupeKey = buildGeV15DelayDedupeKey({
    playbookId: input.playbookId,
    trigger: input.trigger,
    leadId: input.leadId,
  })

  const alreadyPending = input.existing.find(
    (d) => d.dedupeKey === dedupeKey && !d.processedAt,
  )
  if (alreadyPending) {
    return { scheduled: null, deduped: true }
  }

  const now = input.now ?? new Date()
  const dueAt = new Date(now.getTime() + resolveGeV15DelayMs(input.delay)).toISOString()

  const scheduled: GeV15PendingDelay = {
    id: `delay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    playbookId: input.playbookId,
    trigger: input.trigger,
    dueAt,
    dedupeKey,
    createdAt: now.toISOString(),
  }

  return { scheduled, deduped: false }
}

export function getGeV15DueDelays(
  pending: GeV15PendingDelay[],
  now?: Date,
): GeV15PendingDelay[] {
  const ts = (now ?? new Date()).toISOString()
  return pending.filter((d) => !d.processedAt && d.dueAt <= ts)
}

export function markGeV15DelayProcessed(
  pending: GeV15PendingDelay[],
  delayId: string,
  now?: Date,
): GeV15PendingDelay[] {
  const processedAt = (now ?? new Date()).toISOString()
  return pending.map((d) => (d.id === delayId ? { ...d, processedAt } : d))
}
