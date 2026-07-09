/** GE-AIOS-14A — Specialist → Narrative bridge (Ava remains the single voice). */

import type { AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaSpecialistContribution, AvaSpecialistOrchestratorResult } from "@/lib/growth/specialists/types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

function possessiveSpecialistName(name: string): string {
  return name.endsWith(" Specialist") ? `my ${name}` : `my ${name} Specialist`
}

export function buildSpecialistContributionLine(contribution: AvaSpecialistContribution, item: AvaWorkItem | null): string {
  const specialist = possessiveSpecialistName(contribution.specialist_name)

  if (contribution.stub) {
    return `I've routed ${item?.title.toLowerCase() ?? "this work"} to ${specialist}, but that capability is not yet implemented.`
  }

  if (item?.type === "research") {
    return `Today I asked ${specialist} to continue researching ${item.company_name ?? "target companies"}.`
  }
  if (item?.type === "outreach") {
    return `Today I asked ${specialist} to prepare outreach${item.company_name ? ` for ${item.company_name}` : ""}.`
  }
  if (item?.type === "qualification") {
    return `Today I asked ${specialist} to continue qualification work.`
  }
  if (item?.type === "meeting") {
    return `Today I asked ${specialist} to prepare for upcoming meetings.`
  }
  if (item?.type === "reply") {
    return `Today I asked ${specialist} to follow up on customer replies.`
  }

  if (/campaign|marketing|social|content|audience/i.test(item?.title ?? contribution.summary)) {
    return `${capitalizeSpecialist(contribution.specialist_name)} has started identifying campaign opportunities.`
  }
  if (/invoice|payment|collection|forecast/i.test(item?.title ?? contribution.summary)) {
    return `Today I asked ${specialist} to follow up on invoices and payments.`
  }

  return `Today I asked ${specialist} to ${item?.title.toLowerCase() ?? "continue this work"}.`
}

function capitalizeSpecialist(name: string): string {
  return `My ${name}`
}

export function buildSpecialistNarrativeLines(result: AvaSpecialistOrchestratorResult | null | undefined): string[] {
  if (!result || result.assignments.length === 0) return []

  const lines: string[] = []
  const seen = new Set<string>()

  for (const assignment of result.assignments) {
    const item = result.routed_work_items.find((row) => row.id === assignment.work_item_id) ?? null
    const line = buildSpecialistContributionLine(assignment, item)
    if (seen.has(line)) continue
    seen.add(line)
    lines.push(line.endsWith(".") ? line : `${line}.`)
    if (lines.length >= 3) break
  }

  return lines
}

export function buildSpecialistStoryBlocks(result: AvaSpecialistOrchestratorResult | null | undefined): AvaStoryBlock[] {
  return buildSpecialistNarrativeLines(result).map((text, index) => ({
    id: `specialist-narrative:${index}`,
    kind: "general",
    priority: 88 - index,
    text,
    href: null,
  }))
}

export function buildSpecialistNarrativeSummary(result: AvaSpecialistOrchestratorResult | null | undefined): string {
  return buildSpecialistNarrativeLines(result).slice(0, 2).join(" ")
}
