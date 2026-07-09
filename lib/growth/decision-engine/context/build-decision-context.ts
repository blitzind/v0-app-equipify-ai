/** GE-AIOS-10B — Normalize workspace signals into decision context (no new fetches). */

import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeTimelinePeriod,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  buildAvaNarrativeContext,
  type BuildAvaNarrativeContextInput,
} from "@/lib/growth/ava-home/narrative/context/build-ava-narrative-context"
import type { AvaNarrativeContext } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { DecisionCandidate, DecisionContext } from "@/lib/growth/decision-engine/types"

export type BuildDecisionContextInput = {
  workspaceSummary: Pick<
    GrowthHomeWorkspaceSummaryPayload,
    "kpis" | "meetings" | "inbox" | "operatorTasks" | "avaConsole" | "dashboard"
  >
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  dailyWorkQueue: GrowthHomeDailyWorkQueueItem[]
  accomplishments: GrowthHomeAccomplishmentGroup[]
  timeline: GrowthHomeTimelinePeriod[]
  narrativeContext?: AvaNarrativeContext
  memorySummary?: import("@/lib/growth/memory/types").AvaMemorySummary | null
}

function inferActionKind(actionLabel: string): DecisionCandidate["kind"] {
  const label = actionLabel.toLowerCase()
  if (/qualif/.test(label)) return "continue_qualification"
  if (/outreach|prepare|draft/.test(label)) return "prepare_outreach"
  if (/research/.test(label)) return "research_company"
  if (/reply|inbox/.test(label)) return "review_reply"
  if (/meeting/.test(label)) return "meeting_prep"
  if (/approve|review/.test(label)) return "review_approval"
  return "continue_mission"
}

function candidateFromWaiting(item: GrowthHomeWaitingOnYouItem): DecisionCandidate {
  const label = item.label.toLowerCase()
  const kind: DecisionCandidate["kind"] = /approve|review|draft|outreach|research|qualif/i.test(label)
    ? "review_approval"
    : /reply|inbox/i.test(label)
      ? "review_reply"
      : "review_approval"

  return {
    id: item.id,
    kind,
    title: item.label,
    detail: item.detail ?? null,
    href: item.href,
    source: "waiting_on_you",
    severity: item.severity,
    requiresHumanApproval: true,
    blocked: false,
  }
}

function candidateFromQueueItem(item: GrowthHomeDailyWorkQueueItem): DecisionCandidate {
  const kind = inferActionKind(item.actionLabel)
  return {
    id: item.id,
    kind,
    title: `${item.actionLabel} — ${item.companyName}`,
    detail: item.reason ?? null,
    href: item.href,
    companyName: item.companyName,
    source: "daily_work_queue",
    queuePriority: item.priority,
    requiresHumanApproval: item.requiresHumanApproval ?? kind === "prepare_outreach",
    confidencePercent: item.confidencePercent,
    estimatedMinutes: item.estimatedMinutes ?? null,
    readyForOutreach: /outreach|prepare|draft/i.test(item.actionLabel),
    qualificationComplete: /qualif/i.test(item.actionLabel),
    hotCompany: item.priority === "critical" || item.priority === "high",
    blocked: item.requiresHumanApproval === true && kind === "prepare_outreach",
    blockedBy: item.requiresHumanApproval ? ["operator_approval"] : [],
  }
}

function buildResearchCandidates(input: BuildDecisionContextInput): DecisionCandidate[] {
  const research = input.workspaceSummary.avaConsole.researchLoopSummary
  if (!research) return []

  return (research.leadResults ?? [])
    .filter((row) => row.outcome === "completed" && row.companyName)
    .slice(0, 5)
    .map((row) => {
      const ready = row.readyForOutreachReview === true
      const qualified = row.qualificationStatus === "completed"
      return {
        id: `research:${row.leadId}`,
        kind: ready ? "prepare_outreach" : qualified ? "continue_qualification" : "research_company",
        title: ready
          ? `Prepare outreach — ${row.companyName}`
          : qualified
            ? `Continue qualification — ${row.companyName}`
            : `Research company — ${row.companyName}`,
        detail: row.skipReason ?? null,
        href: null,
        companyName: row.companyName,
        source: "research_loop" as const,
        confidencePercent: qualified ? 85 : row.hasBuyingSignals ? 72 : 58,
        readyForOutreach: ready,
        qualificationComplete: qualified,
        hotCompany: row.hasBuyingSignals === true,
        blocked: ready && research.humanApprovalRequired,
        blockedBy: ready && research.humanApprovalRequired ? ["operator_approval"] : [],
        requiresHumanApproval: ready,
      }
    })
}

function buildMissionCandidates(input: BuildDecisionContextInput): DecisionCandidate[] {
  const suggested = input.workspaceSummary.avaConsole.suggestedNextAction?.trim()
  if (input.dailyWorkQueue.length > 0) {
    return [
      {
        id: "mission:pipeline",
        kind: "continue_mission",
        title: "Continue mission — build pipeline",
        detail: `${input.dailyWorkQueue.length} companies in today's queue`,
        href: null,
        source: "mission",
        queuePriority: "high",
      },
    ]
  }
  if (!suggested) return []
  const kind: DecisionCandidate["kind"] = /business|profile|understanding/i.test(suggested)
    ? "request_business_clarification"
    : "continue_mission"
  return [
    {
      id: "mission:suggested",
      kind,
      title: suggested,
      detail: null,
      href: null,
      source: "mission",
    },
  ]
}

function buildInboxCandidates(input: BuildDecisionContextInput): DecisionCandidate[] {
  const { inbox, kpis } = input.workspaceSummary
  const count = Math.max(inbox.repliesNeedingAttention, kpis.repliesToday)
  if (count <= 0) return []
  return [
    {
      id: "inbox:replies",
      kind: "review_reply",
      title: `Review ${count} ${count === 1 ? "reply" : "replies"}`,
      detail: null,
      href: null,
      source: "inbox",
      severity: Math.min(5, count),
      requiresHumanApproval: true,
    },
  ]
}

function buildMeetingCandidates(input: BuildDecisionContextInput): DecisionCandidate[] {
  const count = input.workspaceSummary.meetings.today
  if (count <= 0) return []
  return [
    {
      id: "meetings:today",
      kind: "meeting_prep",
      title: `Meeting prep — ${count} ${count === 1 ? "meeting" : "meetings"} today`,
      detail: null,
      href: null,
      source: "meeting",
      queuePriority: "high",
    },
  ]
}

function buildBusinessClarificationCandidate(
  businessUnderstanding: AvaNarrativeContext["businessUnderstanding"],
): DecisionCandidate[] {
  if (!businessUnderstanding.profileIncomplete) return []
  return [
    {
      id: "business:clarification",
      kind: "request_business_clarification",
      title: "Request business clarification",
      detail: "Business understanding incomplete",
      href: null,
      source: "mission",
      requiresHumanApproval: true,
    },
    {
      id: "business:refresh_bi",
      kind: "refresh_bi",
      title: "Refresh business understanding",
      detail: "Research business profile",
      href: null,
      source: "mission",
    },
  ]
}

export function buildDecisionContext(input: BuildDecisionContextInput): DecisionContext {
  const narrativeInput: BuildAvaNarrativeContextInput = {
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
  }
  const narrative = input.narrativeContext ?? buildAvaNarrativeContext(narrativeInput)

  const approvals = input.waitingOnYou.map(candidateFromWaiting)
  const opportunities = input.dailyWorkQueue.map(candidateFromQueueItem)
  const research = buildResearchCandidates(input)
  const missions = buildMissionCandidates(input)
  const inbox = buildInboxCandidates(input)
  const meetings = buildMeetingCandidates(input)
  const businessCandidates = buildBusinessClarificationCandidate(narrative.businessUnderstanding)

  return {
    opportunities: [...opportunities, ...research.filter((row) => row.kind === "prepare_outreach")],
    approvals,
    missions: [...missions, ...businessCandidates.filter((row) => row.kind === "continue_mission")],
    inbox: [...inbox, ...approvals.filter((row) => row.kind === "review_reply")],
    research: [...research, ...businessCandidates.filter((row) => row.kind !== "continue_mission")],
    meetings,
    businessUnderstanding: narrative.businessUnderstanding,
    evidenceConfidence: narrative.businessUnderstanding.hasBusinessResearch ? 78 : null,
    memorySummary: input.memorySummary ?? null,
  }
}

export function flattenDecisionCandidates(context: DecisionContext): DecisionCandidate[] {
  const seen = new Set<string>()
  const all = [
    ...context.approvals,
    ...context.inbox,
    ...context.meetings,
    ...context.opportunities,
    ...context.research,
    ...context.missions,
  ]

  const unique: DecisionCandidate[] = []
  for (const candidate of all) {
    const key = `${candidate.kind}:${candidate.id}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(candidate)
  }

  if (unique.length === 0) {
    unique.push({
      id: "wait:idle",
      kind: "wait",
      title: "Wait — no urgent actions",
      detail: null,
      href: null,
      source: "mission",
    })
  }

  return unique
}
