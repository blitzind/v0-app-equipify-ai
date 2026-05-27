/** Deterministic warmup schedule generation — no sending. Client-safe. */

export type WarmupMilestone = {
  day: number
  volume: number
}

export const DEFAULT_WARMUP_MILESTONES: WarmupMilestone[] = [
  { day: 1, volume: 10 },
  { day: 3, volume: 20 },
  { day: 7, volume: 40 },
  { day: 14, volume: 80 },
  { day: 21, volume: 120 },
  { day: 30, volume: 150 },
]

export type WarmupScheduleDayDraft = {
  day_number: number
  planned_volume: number
}

function clampDay(dayNumber: number): number {
  return Math.max(1, Math.round(dayNumber))
}

export function interpolateWarmupVolume(
  dayNumber: number,
  milestones: WarmupMilestone[] = DEFAULT_WARMUP_MILESTONES,
): number {
  const day = clampDay(dayNumber)
  if (milestones.length === 0) return 0

  const sorted = [...milestones].sort((a, b) => a.day - b.day)
  if (day <= sorted[0].day) return sorted[0].volume
  if (day >= sorted[sorted.length - 1].day) return sorted[sorted.length - 1].volume

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index]
    const right = sorted[index + 1]
    if (day >= left.day && day <= right.day) {
      const span = right.day - left.day
      if (span <= 0) return right.volume
      const ratio = (day - left.day) / span
      return Math.round(left.volume + (right.volume - left.volume) * ratio)
    }
  }

  return sorted[sorted.length - 1].volume
}

export function generateWarmupScheduleDays(
  warmupDays: number,
  milestones: WarmupMilestone[] = DEFAULT_WARMUP_MILESTONES,
): WarmupScheduleDayDraft[] {
  const totalDays = Math.max(1, Math.round(warmupDays))
  return Array.from({ length: totalDays }, (_, index) => {
    const day_number = index + 1
    return {
      day_number,
      planned_volume: interpolateWarmupVolume(day_number, milestones),
    }
  })
}

export function computeDailyIncrement(schedule: WarmupScheduleDayDraft[]): number {
  if (schedule.length < 2) return 0
  const first = schedule[0].planned_volume
  const second = schedule[1].planned_volume
  return Math.max(0, second - first)
}

export function computeTargetDailyVolume(
  warmupDays: number,
  milestones: WarmupMilestone[] = DEFAULT_WARMUP_MILESTONES,
): number {
  return interpolateWarmupVolume(warmupDays, milestones)
}

export function getPlannedVolumeForDay(
  schedule: WarmupScheduleDayDraft[],
  dayNumber: number,
): number {
  const match = schedule.find((row) => row.day_number === dayNumber)
  return match?.planned_volume ?? interpolateWarmupVolume(dayNumber)
}
