/** GE-AIOS-13A — Phase-aware narrative bridge (consumes Operating Rhythm, not Decision Engine). */

import type { AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaOperatingPhaseId, AvaOperatingRhythm } from "@/lib/growth/operating-rhythm/types"
import { buildWorkManagerNarrativeLines, mapWorkItemTypeToStoryKind } from "@/lib/growth/work-manager/bridges/narrative-bridge"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import { resolveHomeDayPart } from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function buildPhaseAwareNarrativeLine(rhythm: AvaOperatingRhythm, hour: number): string {
  const dayPart = resolveHomeDayPart(hour)
  const waiting = rhythm.waiting_on_operator.length
  const approvalCount = rhythm.waiting_on_operator.length

  if (dayPart === "morning" && rhythm.current_phase === "morning_planning") {
    return "I reviewed what changed overnight and built today's plan."
  }

  if (dayPart === "morning" || (dayPart === "afternoon" && rhythm.current_phase === "research_cycle")) {
    if (rhythm.completed_phases.includes("research_cycle")) {
      return "I've been researching companies and preparing outreach."
    }
    return "I've been researching companies that match your business."
  }

  if (dayPart === "afternoon" && waiting > 0) {
    return `Most planned work is complete. I'm waiting on your approval before continuing.`
  }

  if (dayPart === "evening") {
    const completed = rhythm.completed_phases.length
    if (completed > 0) {
      return `Here's what I accomplished today and what I'll begin tomorrow.`
    }
    return rhythm.end_of_day_summary ?? "I'm wrapping up today's work and planning tomorrow."
  }

  if (approvalCount > 0) {
    return `I'm currently waiting for approval on ${approvalCount} outreach ${pluralize(approvalCount, "draft", "drafts")}, so while those are pending I've continued researching new opportunities.`
  }

  const active = rhythm.active_cycle
  if (active?.summary) return active.summary

  return "I'm continuing through today's operating plan."
}

export function buildOperatingRhythmNarrativeLines(
  rhythm: AvaOperatingRhythm,
  workResult: AvaWorkManagerResult,
  hour: number,
): string[] {
  const phaseLine = buildPhaseAwareNarrativeLine(rhythm, hour)
  const workLines = buildWorkManagerNarrativeLines(workResult).filter((line) => line !== phaseLine)

  const lines = [phaseLine]
  for (const line of workLines) {
    if (!lines.includes(line)) lines.push(line)
    if (lines.length >= 5) break
  }

  if (rhythm.end_of_day_summary && hour >= 17 && !lines.includes(rhythm.end_of_day_summary)) {
    lines.push(rhythm.end_of_day_summary)
  }

  return lines.slice(0, 5)
}

export function buildOperatingRhythmStoryBlocks(
  rhythm: AvaOperatingRhythm,
  workResult: AvaWorkManagerResult,
  hour: number,
): AvaStoryBlock[] {
  const lines = buildOperatingRhythmNarrativeLines(rhythm, workResult, hour)
  return lines.map((text, index) => {
    const phase: AvaOperatingPhaseId = index === 0 ? rhythm.current_phase : rhythm.next_phase ?? rhythm.current_phase
    const activeItem = workResult.active_work
    return {
      id: `rhythm-narrative:${phase}:${index}`,
      kind: activeItem ? mapWorkItemTypeToStoryKind(activeItem.type) : "mission",
      priority: 100 - index,
      text,
      href: index === 0 ? activeItem?.href ?? null : null,
    }
  })
}

export function buildEndOfDaySummary(rhythm: AvaOperatingRhythm, workResult: AvaWorkManagerResult): string | null {
  if (rhythm.current_phase !== "reflection" && !rhythm.completed_phases.includes("reflection")) {
    return null
  }

  const completed = workResult.completed_today.length
  const unfinished = workResult.work_plan.filter((entry) => entry.status === "ready").length
  const waiting = rhythm.waiting_on_operator.length

  const parts: string[] = []
  if (completed > 0) {
    parts.push(`Completed ${completed} ${pluralize(completed, "item", "items")} today.`)
  }
  if (unfinished > 0) {
    parts.push(`${unfinished} ${pluralize(unfinished, "item", "items")} carry forward to tomorrow.`)
  }
  if (waiting > 0) {
    parts.push(`${waiting} ${pluralize(waiting, "decision", "decisions")} still waiting on you.`)
  }

  return parts.length > 0 ? parts.join(" ") : null
}
