/** GE-AIOS-10A — Story priority ordering (deterministic). */

import type { AvaNarrativeContext, AvaPrioritizedStory, AvaStoryKind } from "@/lib/growth/ava-home/narrative/narrative-types"

const STORY_PRIORITY: Record<AvaStoryKind, number> = {
  approval: 100,
  reply: 90,
  meeting: 80,
  opportunity: 70,
  discovery: 60,
  research: 55,
  accomplishment: 50,
  risk: 45,
  mission: 40,
  waiting: 35,
  general: 30,
}

export function prioritizeAvaStories(context: AvaNarrativeContext): AvaPrioritizedStory[] {
  const candidates: AvaPrioritizedStory[] = []

  for (const fact of context.approvalsWaiting) {
    candidates.push({ kind: "approval", priority: STORY_PRIORITY.approval, factId: fact.id })
  }
  for (const fact of context.repliesReceived) {
    candidates.push({ kind: "reply", priority: STORY_PRIORITY.reply, factId: fact.id })
  }
  for (const fact of context.meetingsBooked) {
    candidates.push({ kind: "meeting", priority: STORY_PRIORITY.meeting, factId: fact.id })
  }
  for (const fact of context.opportunities) {
    candidates.push({ kind: "opportunity", priority: STORY_PRIORITY.opportunity, factId: fact.id })
  }
  for (const fact of context.discoveries) {
    candidates.push({ kind: "discovery", priority: STORY_PRIORITY.discovery, factId: fact.id })
  }
  if (context.metrics.researched > 0 && !context.discoveries.some((row) => row.label === "researched_companies")) {
    candidates.push({
      kind: "research",
      priority: STORY_PRIORITY.research,
      factId: "metrics:researched",
    })
  }
  for (const fact of context.missionsRunning) {
    candidates.push({ kind: "mission", priority: STORY_PRIORITY.mission, factId: fact.id })
  }
  for (const fact of context.inboxWaiting) {
    candidates.push({ kind: "waiting", priority: STORY_PRIORITY.waiting, factId: fact.id })
  }

  return candidates.sort((left, right) => right.priority - left.priority)
}

export function resolveStoryPriority(kind: AvaStoryKind): number {
  return STORY_PRIORITY[kind] ?? 30
}
