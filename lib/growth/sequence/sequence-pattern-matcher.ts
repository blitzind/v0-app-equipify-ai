import type { GrowthSequenceTouch } from "@/lib/growth/sequence-types"

const MS_DAY = 24 * 60 * 60 * 1000

export function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / MS_DAY
}

export function matchPatternTouches(
  touches: GrowthSequenceTouch[],
  steps: Array<{
    channel: string
    delayDaysMin: number
    delayDaysMax: number
    generationType: string | null
  }>,
): GrowthSequenceTouch[][] {
  const sorted = [...touches].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
  const matches: GrowthSequenceTouch[][] = []

  for (let i = 0; i < sorted.length; i += 1) {
    const first = sorted[i]
    if (!touchMatchesStep(first, steps[0])) continue

    const matched: GrowthSequenceTouch[] = [first]
    let cursor = first.occurredAt

    for (let stepIdx = 1; stepIdx < steps.length; stepIdx += 1) {
      const step = steps[stepIdx]
      const candidate = sorted
        .slice(i + 1)
        .find((touch) => {
          if (!touchMatchesStep(touch, step)) return false
          const delay = daysBetween(cursor, touch.occurredAt)
          return delay >= step.delayDaysMin && delay <= step.delayDaysMax
        })
      if (!candidate) break
      matched.push(candidate)
      cursor = candidate.occurredAt
    }

    if (matched.length === steps.length) {
      matches.push(matched)
    }
  }

  return matches
}

function touchMatchesStep(
  touch: GrowthSequenceTouch,
  step: { channel: string; generationType: string | null },
): boolean {
  if (touch.channel !== step.channel) return false
  if (step.generationType && touch.generationType !== step.generationType) return false
  return true
}

export function detectReplyAfterTouches(
  touches: GrowthSequenceTouch[],
  afterIso: string,
  withinDays: number,
): GrowthSequenceTouch | null {
  const deadline = Date.parse(afterIso) + withinDays * MS_DAY
  return (
    touches.find(
      (touch) =>
        touch.channel === "reply" &&
        Date.parse(touch.occurredAt) >= Date.parse(afterIso) &&
        Date.parse(touch.occurredAt) <= deadline,
    ) ?? null
  )
}

export function countRecentTouches(touches: GrowthSequenceTouch[], sinceDays: number, now: Date): number {
  const sinceMs = now.getTime() - sinceDays * MS_DAY
  return touches.filter((touch) => Date.parse(touch.occurredAt) >= sinceMs).length
}
