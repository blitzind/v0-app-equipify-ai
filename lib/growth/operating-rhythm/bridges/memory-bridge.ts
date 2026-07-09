/** GE-AIOS-13A — Client-side operating rhythm memory (no schema). */

import type { AvaOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/types"
import type { AvaOperatingRhythm } from "@/lib/growth/operating-rhythm/types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export const AVA_OPERATING_RHYTHM_MEMORY_KEY = "equipify:ava-operating-rhythm:memory/v1" as const

export function readOperatingRhythmMemory(): AvaOperatingRhythmMemory | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(AVA_OPERATING_RHYTHM_MEMORY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AvaOperatingRhythmMemory
  } catch {
    return null
  }
}

export function writeOperatingRhythmMemory(memory: AvaOperatingRhythmMemory): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AVA_OPERATING_RHYTHM_MEMORY_KEY, JSON.stringify(memory))
  } catch {
    // ignore
  }
}

export function buildOperatingRhythmMemory(input: {
  rhythm: AvaOperatingRhythm
  workResult: AvaWorkManagerResult
  risks: string[]
  wins: string[]
}): AvaOperatingRhythmMemory {
  return {
    capturedAt: new Date().toISOString(),
    accomplishments: input.workResult.completed_today.map((item) => item.title),
    interruptions: input.rhythm.interruptions,
    approvals: input.rhythm.waiting_on_operator,
    wins: input.wins,
    risks: input.risks,
    unfinished_work: input.workResult.work_plan
      .filter((entry) => entry.status === "ready" || entry.status === "working")
      .map((entry) => entry.title),
    tomorrow_plan: input.rhythm.today_plan.slice(0, 3),
  }
}
