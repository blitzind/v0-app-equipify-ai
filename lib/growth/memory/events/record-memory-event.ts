/** GE-AIOS-12A — Record memory events from workspace signals (deterministic). */

import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeTimelinePeriod,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { AvaNarrativeContext } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/types"
import type {
  AvaMemoryEvent,
  AvaOrganizationalPreference,
  MemoryEngineAdapterInput,
} from "@/lib/growth/memory/types"

export type RecordMemoryEventsInput = {
  organizationId: string
  generatedAt: string
  workspaceSummary: Pick<
    GrowthHomeWorkspaceSummaryPayload,
    "kpis" | "meetings" | "inbox" | "operatorTasks" | "avaConsole" | "dashboard"
  >
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  dailyWorkQueue: GrowthHomeDailyWorkQueueItem[]
  accomplishments: GrowthHomeAccomplishmentGroup[]
  timeline: GrowthHomeTimelinePeriod[]
  narrativeContext: AvaNarrativeContext
  adapters?: MemoryEngineAdapterInput
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)
}

function buildEvent(
  input: RecordMemoryEventsInput,
  partial: Omit<AvaMemoryEvent, "organizationId" | "timestamp"> & { timestamp?: string },
): AvaMemoryEvent {
  return {
    organizationId: input.organizationId,
    timestamp: partial.timestamp ?? input.generatedAt,
    ...partial,
  }
}

function eventsFromWaitingOnYou(input: RecordMemoryEventsInput): AvaMemoryEvent[] {
  return input.waitingOnYou.map((item) =>
    buildEvent(input, {
      id: `approval:${item.id}`,
      category: /approve|draft|outreach/i.test(item.label) ? "approval" : "decision",
      importance: Math.min(5, item.severity ?? 3),
      entityType: "approval",
      entityId: item.id,
      source: "waiting_on_you",
      summary: item.label.trim(),
      metadata: { detail: item.detail ?? null, href: item.href ?? null },
    }),
  )
}

function eventsFromDailyWorkQueue(input: RecordMemoryEventsInput): AvaMemoryEvent[] {
  return input.dailyWorkQueue.map((item) => {
    const action = item.actionLabel.toLowerCase()
    const category = /outreach|prepare|draft/.test(action)
      ? "outreach"
      : /qualif/.test(action)
        ? "opportunity"
        : /research/.test(action)
          ? "lead"
          : "mission"
    return buildEvent(input, {
      id: `queue:${item.id}`,
      category,
      importance: item.priority === "critical" ? 5 : item.priority === "high" ? 4 : 3,
      entityType: "lead",
      entityId: item.id,
      source: "daily_work_queue",
      summary: `${item.actionLabel} — ${item.companyName}`,
      metadata: {
        companyName: item.companyName,
        confidencePercent: item.confidencePercent ?? null,
        requiresHumanApproval: item.requiresHumanApproval ?? false,
      },
    })
  })
}

function eventsFromAccomplishments(input: RecordMemoryEventsInput): AvaMemoryEvent[] {
  const events: AvaMemoryEvent[] = []
  for (const group of input.accomplishments) {
    for (const item of group.items) {
      const trimmed = item.trim()
      if (!trimmed) continue
      const lower = trimmed.toLowerCase()
      const category = /meeting|booked/.test(lower)
        ? "meeting"
        : /approv/.test(lower)
          ? "approval"
          : /qualif/.test(lower)
            ? "win"
            : /research/.test(lower)
              ? "learning"
              : /outreach|draft/.test(lower)
                ? "outreach"
                : /reply/.test(lower)
                  ? "reply"
                  : "learning"
      events.push(
        buildEvent(input, {
          id: `accomplishment:${group.id}:${slug(trimmed)}`,
          category,
          importance: /meeting|approv|qualif/.test(lower) ? 4 : 3,
          entityType: "organization",
          entityId: group.id,
          source: "accomplishment",
          summary: trimmed,
          metadata: { groupTitle: group.title },
        }),
      )
    }
  }
  return events
}

function eventsFromTimeline(input: RecordMemoryEventsInput): AvaMemoryEvent[] {
  const events: AvaMemoryEvent[] = []
  for (const period of input.timeline) {
    for (const item of period.items) {
      const trimmed = item.trim()
      if (!trimmed) continue
      events.push(
        buildEvent(input, {
          id: `timeline:${period.id}:${slug(trimmed)}`,
          category: /risk|block/i.test(trimmed) ? "risk" : "learning",
          importance: 2,
          entityType: "organization",
          entityId: period.id,
          source: "timeline",
          summary: trimmed,
          metadata: { periodLabel: period.label },
        }),
      )
    }
  }
  return events
}

function eventsFromResearchLoop(input: RecordMemoryEventsInput): AvaMemoryEvent[] {
  const research = input.workspaceSummary.avaConsole.researchLoopSummary
  if (!research) return []

  const events: AvaMemoryEvent[] = [
    buildEvent(input, {
      id: `research-loop:${research.runId}`,
      category: "learning",
      importance: 4,
      entityType: "organization",
      entityId: research.runId,
      source: "research_loop",
      summary: research.narrative.trim() || `Reviewed ${research.companiesReviewed} companies.`,
      metadata: {
        companiesReviewed: research.companiesReviewed,
        researchCompleted: research.researchCompleted,
        readyForOutreachReview: research.readyForOutreachReview,
      },
    }),
  ]

  for (const lead of research.leadResults ?? []) {
    if (!lead.companyName) continue
    const category = lead.readyForOutreachReview
      ? "win"
      : lead.qualificationStatus === "completed"
        ? "opportunity"
        : "lead"
    events.push(
      buildEvent(input, {
        id: `research-lead:${lead.leadId}`,
        category,
        importance: lead.readyForOutreachReview ? 5 : 3,
        entityType: "lead",
        entityId: lead.leadId,
        source: "research_loop",
        summary: lead.readyForOutreachReview
          ? `Research completed for ${lead.companyName}.`
          : `Researched ${lead.companyName}.`,
        metadata: {
          companyName: lead.companyName,
          hasBuyingSignals: lead.hasBuyingSignals ?? false,
          industry: inferIndustry(lead.companyName),
        },
      }),
    )
  }

  return events
}

function eventsFromNarrativeSnapshot(
  input: RecordMemoryEventsInput,
  snapshot: AvaNarrativeMetricsSnapshot | null | undefined,
): AvaMemoryEvent[] {
  if (!snapshot) return []
  return [
    buildEvent(input, {
      id: `snapshot:${snapshot.capturedAt}`,
      category: "learning",
      importance: 2,
      entityType: "organization",
      entityId: "metrics-snapshot",
      source: "narrative_snapshot",
      summary: `Prior session: ${snapshot.researched} researched, ${snapshot.qualified} qualified, ${snapshot.meetingsToday} meetings.`,
      metadata: {
        researched: snapshot.researched,
        qualified: snapshot.qualified,
        readyForReview: snapshot.readyForReview,
        repliesToday: snapshot.repliesToday,
        meetingsToday: snapshot.meetingsToday,
      },
      timestamp: snapshot.capturedAt,
    }),
  ]
}

function eventsFromOperatingRhythmMemory(
  input: RecordMemoryEventsInput,
  memory: AvaOperatingRhythmMemory | null | undefined,
): AvaMemoryEvent[] {
  if (!memory) return []
  const events: AvaMemoryEvent[] = []

  for (const accomplishment of memory.accomplishments) {
    events.push(
      buildEvent(input, {
        id: `rhythm-accomplishment:${slug(accomplishment)}`,
        category: "win",
        importance: 3,
        entityType: "organization",
        entityId: "operating-rhythm",
        source: "operating_rhythm",
        summary: accomplishment,
        metadata: {},
        timestamp: memory.capturedAt,
      }),
    )
  }

  for (const risk of memory.risks) {
    events.push(
      buildEvent(input, {
        id: `rhythm-risk:${slug(risk)}`,
        category: "risk",
        importance: 4,
        entityType: "organization",
        entityId: "operating-rhythm",
        source: "operating_rhythm",
        summary: risk,
        metadata: {},
        timestamp: memory.capturedAt,
      }),
    )
  }

  return events
}

function eventsFromMeetings(input: RecordMemoryEventsInput): AvaMemoryEvent[] {
  const count = input.workspaceSummary.meetings.today
  if (count <= 0) return []
  return [
    buildEvent(input, {
      id: `meeting:today:${input.generatedAt.slice(0, 10)}`,
      category: "meeting",
      importance: 4,
      entityType: "meeting",
      entityId: "today",
      source: "workspace_summary",
      summary: `${count} ${count === 1 ? "meeting" : "meetings"} scheduled today.`,
      metadata: { count },
    }),
  ]
}

function eventsFromReplies(input: RecordMemoryEventsInput): AvaMemoryEvent[] {
  const count = Math.max(
    input.workspaceSummary.inbox.repliesNeedingAttention,
    input.workspaceSummary.kpis.repliesToday,
  )
  if (count <= 0) return []
  return [
    buildEvent(input, {
      id: `reply:today:${input.generatedAt.slice(0, 10)}`,
      category: "reply",
      importance: 4,
      entityType: "reply",
      entityId: "inbox",
      source: "workspace_summary",
      summary: `${count} ${count === 1 ? "reply needs" : "replies need"} attention.`,
      metadata: { count },
    }),
  ]
}

export function inferIndustry(text: string): string {
  const lower = text.toLowerCase()
  if (/medical|biomedical|hospital|health|clinical|equipment|device/.test(lower)) return "medical_equipment"
  if (/hvac|heating|cooling|air/.test(lower)) return "hvac"
  if (/software|saas|platform|tech/.test(lower)) return "software"
  return "general"
}

export function recordMemoryEvents(input: RecordMemoryEventsInput): {
  events: AvaMemoryEvent[]
  preferences: AvaOrganizationalPreference[]
} {
  const events = [
    ...eventsFromWaitingOnYou(input),
    ...eventsFromDailyWorkQueue(input),
    ...eventsFromAccomplishments(input),
    ...eventsFromTimeline(input),
    ...eventsFromResearchLoop(input),
    ...eventsFromMeetings(input),
    ...eventsFromReplies(input),
    ...eventsFromNarrativeSnapshot(input, input.adapters?.previousSnapshot),
    ...eventsFromOperatingRhythmMemory(input, input.adapters?.operatingRhythmMemory),
  ]

  const unique = new Map<string, AvaMemoryEvent>()
  for (const event of events) {
    unique.set(event.id, event)
  }

  return {
    events: [...unique.values()],
    preferences: [],
  }
}

export function buildMemoryStoreFromEvents(input: {
  organizationId: string
  generatedAt: string
  events: AvaMemoryEvent[]
  preferences: AvaOrganizationalPreference[]
  existingPreferences?: AvaOrganizationalPreference[]
}): import("@/lib/growth/memory/types").AvaOrganizationalMemoryStore {
  return {
    capturedAt: input.generatedAt,
    organizationId: input.organizationId,
    events: input.events,
    preferences: input.existingPreferences?.length
      ? input.existingPreferences
      : input.preferences,
  }
}
