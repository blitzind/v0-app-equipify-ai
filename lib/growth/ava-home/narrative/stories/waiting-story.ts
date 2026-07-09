/** GE-AIOS-10A — Deterministic waiting, reply, and meeting story builders. */

import { pluralize } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { AvaNarrativeFact, AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import { resolveStoryPriority } from "@/lib/growth/ava-home/narrative/priorities/prioritize-ava-story"

export function buildReplyStory(fact: AvaNarrativeFact): AvaStoryBlock | null {
  const count = fact.count ?? 0
  if (count <= 0) return null
  return {
    id: `reply:${fact.id}`,
    kind: "reply",
    priority: resolveStoryPriority("reply"),
    text: `I received ${count} customer ${pluralize(count, "reply", "replies")} that need your attention.`,
    href: fact.href ?? null,
  }
}

export function buildMeetingStory(fact: AvaNarrativeFact): AvaStoryBlock | null {
  const count = fact.count ?? 0
  if (count <= 0) return null
  return {
    id: `meeting:${fact.id}`,
    kind: "meeting",
    priority: resolveStoryPriority("meeting"),
    text: `You have ${count} ${pluralize(count, "meeting", "meetings")} booked today.`,
    href: fact.href ?? null,
  }
}

export function buildWaitingStory(fact: AvaNarrativeFact): AvaStoryBlock | null {
  if (fact.label === "inbox_replies") {
    const count = fact.count ?? 0
    if (count <= 0) return null
    return {
      id: `waiting:${fact.id}`,
      kind: "waiting",
      priority: resolveStoryPriority("waiting"),
      text: `${count} ${pluralize(count, "reply is", "replies are")} waiting in your inbox.`,
      href: fact.href ?? null,
    }
  }
  return null
}

export function buildMissionStory(fact: AvaNarrativeFact): AvaStoryBlock | null {
  if (fact.label === "pipeline_mission") {
    return {
      id: `mission:${fact.id}`,
      kind: "mission",
      priority: resolveStoryPriority("mission"),
      text: "I'm continuing to build your pipeline while preparing personalized outreach behind the scenes.",
    }
  }

  const label = fact.label.trim()
  if (!label) return null
  return {
    id: `mission:${fact.id}`,
    kind: "mission",
    priority: resolveStoryPriority("mission"),
    text: label.endsWith(".") ? label : `${label}.`,
  }
}

export function buildResearchStory(researched: number, industry: string | null): AvaStoryBlock | null {
  if (researched <= 0) return null
  return {
    id: "research:metrics",
    kind: "research",
    priority: resolveStoryPriority("research"),
    text: `I researched ${researched} ${pluralize(researched, "company", "companies")}${industry ? ` in ${industry}` : ""}.`,
  }
}
