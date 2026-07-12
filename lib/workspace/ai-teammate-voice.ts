/**
 * GE-AI-UX-3A / GE-AIOS-IDENTITY-1B — AI Teammate product voice helpers (client-safe).
 * Customer-visible copy must use these builders — never hardcode the default name.
 */

import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"

export function teammateHomeIntro(teammate: AiTeammatePresentation): string {
  return `${teammate.name} handled most of the work while you were away.`
}

export function teammateHandledRest(teammate: AiTeammatePresentation): string {
  return `Nothing needs your review right now — ${teammate.name} handled the rest.`
}

export function teammateExceptionSummary(teammate: AiTeammatePresentation, count: number): string {
  if (count <= 0) return teammateHandledRest(teammate)
  const noun = count === 1 ? "item" : "items"
  return `${teammate.subjectPronoun} only needs your approval on ${count} ${noun}.`
}

/** Prefix outcome action lines with teammate pronoun — "Researched 46 companies." → "She researched 46 companies." */
export function teammateAttributeOutcomes(
  teammate: AiTeammatePresentation,
  actionLines: string[],
): string[] {
  return actionLines.map((line) => {
    if (line.startsWith(`${teammate.name} `)) return line
    const lower = line.charAt(0).toLowerCase() + line.slice(1)
    return `${teammate.subjectPronoun} ${lower}`
  })
}

export function teammatePresenceLabel(
  teammate: AiTeammatePresentation,
  activity: string,
): string {
  const trimmed = activity.trim()
  if (!trimmed) return `${teammate.name} is working`
  const lowerFirst = trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
  return `${teammate.name} is ${lowerFirst}`
}

export function teammateWaitingForApproval(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is waiting for your approval`
}

export function teammatePreparedSummary(teammate: AiTeammatePresentation, count: number, noun: string): string {
  const plural = count === 1 ? noun : `${noun}s`
  return `${count} ${plural} ${teammate.name} prepared but cannot complete alone.`
}

export function teammateActivitySummary(
  teammate: AiTeammatePresentation,
  verbPhrase: string,
): string {
  return `${teammate.name} is ${verbPhrase}`
}

export function teammateTimelineAction(teammate: AiTeammatePresentation, action: string): string {
  const lower = action.charAt(0).toLowerCase() + action.slice(1)
  return `${teammate.name} ${lower}`
}

export function teammateHealthHandledLabel(teammate: AiTeammatePresentation): string {
  return `${teammate.name} handled most of the work`
}

export function teammateIdleMonitoring(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is monitoring your market and inbox for the next opportunity.`
}

export function teammateWorkInProgressSubtitle(teammate: AiTeammatePresentation): string {
  return `Work ${teammate.name} is handling while you focus on exceptions.`
}

export function teammateImprovementsSubtitle(teammate: AiTeammatePresentation): string {
  return `How ${teammate.name} is getting smarter from your recent outcomes.`
}

export function defaultTeammatePresentation(): AiTeammatePresentation {
  return resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME)
}

/** GE-AIOS-19C-2F — first-person introduction for About Your AI (dynamic name). */
export function buildTeammateAboutIntroduction(teammate: AiTeammatePresentation): string {
  return `Hi, I'm ${teammate.name}.\n\nI help your business find opportunities, prepare outreach, keep your pipeline organized, and continuously learn how your company operates.`
}

/** GE-AIOS-19C-2A — first-person possessive for customer surfaces. */
export function teammatePossessive(teammate: AiTeammatePresentation): string {
  return teammate.subjectPronoun === "I" ? "my" : `${teammate.name}'s`
}

export function teammateHomePageDescription(teammate: AiTeammatePresentation): string {
  return `${teammatePossessive(teammate)} daily briefing — what I'm working on, what I've learned, and what I need from you.`
}

export function teammateOperationsPageDescription(teammate: AiTeammatePresentation): string {
  return `What I'm doing, why I chose it, and what comes next.`
}

/* —— GE-AIOS-IDENTITY-1B — reusable customer voice templates —— */

export function completedWorkTitle(teammate: AiTeammatePresentation): string {
  return `${teammate.name} completed work`
}

export function completedWorkNavLabel(teammate: AiTeammatePresentation): string {
  return `${teammatePossessive(teammate)} Work`
}

export function completedWorkDescription(teammate: AiTeammatePresentation): string {
  return `${teammate.name} finished these tasks and is waiting for your authorization. Nothing sends until you authorize here — sequence and transport gates remain.`
}

export function completedWorkHeroEmpty(teammate: AiTeammatePresentation): string {
  return `${teammate.name} has no completed work waiting right now.`
}

export function completedWorkHeroWaiting(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is waiting for your authorization before anything sends.`
}

export function completedTasks(teammate: AiTeammatePresentation, count: number): string {
  return `${teammate.name} completed ${count} task${count === 1 ? "" : "s"}.`
}

export function reviewCompletedWork(teammate: AiTeammatePresentation): string {
  return `Review ${teammatePossessive(teammate)} work`
}

export function reviewCompletedWorkFull(teammate: AiTeammatePresentation): string {
  return `Review ${teammatePossessive(teammate)} completed work`
}

export function openCompletedWork(teammate: AiTeammatePresentation): string {
  return `Open ${teammatePossessive(teammate)} completed work`
}

export function recommends(teammate: AiTeammatePresentation): string {
  return `${teammate.name} recommends`
}

export function recommendsNext(teammate: AiTeammatePresentation): string {
  return `The highest-impact move ${teammate.name} recommends next.`
}

export function recommendsOutcome(teammate: AiTeammatePresentation): string {
  return `The highest-impact outcome ${teammate.name} recommends next.`
}

export function recommendsDoingNext(teammate: AiTeammatePresentation): string {
  return `What ${teammate.name} recommends doing next`
}

export function needsApproval(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is waiting for your approval.`
}

export function isWorking(teammate: AiTeammatePresentation, activity?: string | null): string {
  if (activity?.trim()) {
    const cleaned = activity.trim().replace(new RegExp(`^${teammate.name}\\s+`, "i"), "").replace(/\.$/, "")
    return `${teammate.name} is ${cleaned}.`
  }
  return `${teammate.name} is actively monitoring your pipeline.`
}

export function isStandingBy(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is standing by`
}

export function isCurrently(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is currently`
}

export function completedTodaysWork(teammate: AiTeammatePresentation): string {
  return `${teammate.name} completed today's work.`
}

export function whatTeammateNeeds(teammate: AiTeammatePresentation): string {
  return `What ${teammate.name} Needs`
}

export function whyTeammateStops(teammate: AiTeammatePresentation): string {
  return `Why ${teammate.name} stops here`
}

export function confidenceLabel(teammate: AiTeammatePresentation): string {
  return `${teammatePossessive(teammate)} confidence`
}

export function workInProgressTitle(teammate: AiTeammatePresentation): string {
  return `Work ${teammate.name} Is Handling`
}

export function improvementsFromTeammate(teammate: AiTeammatePresentation): string {
  return `Improvements from ${teammate.name}`
}

export function viewWorkSummary(teammate: AiTeammatePresentation): string {
  return `View ${teammatePossessive(teammate)} Work Summary`
}

export function exceptionsSubtitle(teammate: AiTeammatePresentation): string {
  return `${teammate.name} completed everything else — these items need your judgment.`
}

export function replyWithTeammate(teammate: AiTeammatePresentation): string {
  return `Reply with ${teammate.name}`
}

export function callAssistTitle(teammate: AiTeammatePresentation): string {
  return `${teammate.name} · Call assist`
}

export function meetingPrepFromTeammate(teammate: AiTeammatePresentation): string {
  return `Meeting prep from ${teammate.name}`
}

export function whatTeammateNoticed(teammate: AiTeammatePresentation): string {
  return `What ${teammate.name} noticed`
}

export function draftPreparedByTeammate(teammate: AiTeammatePresentation): string {
  return `Draft prepared by ${teammate.name}`
}

export function personalizationFromTeammate(teammate: AiTeammatePresentation): string {
  return `Personalization from ${teammate.name}`
}

export function followUpFromTeammate(teammate: AiTeammatePresentation): string {
  return `Follow-up from ${teammate.name}`
}

export function emptyRecommendations(teammate: AiTeammatePresentation): string {
  return `${teammate.name} doesn't have any recommendations yet.`
}

export function emptySummary(teammate: AiTeammatePresentation): string {
  return `${teammate.name} will summarize activity as it comes in.`
}

export function emptyThreadGuidance(teammate: AiTeammatePresentation): string {
  return `Select a thread to see guidance from ${teammate.name}.`
}

export function emptyReplyDrafts(teammate: AiTeammatePresentation): string {
  return `Select a thread for ${teammate.name} to prepare reply drafts.`
}

export function assistUnavailable(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is unavailable for this thread right now.`
}

export function statusReady(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is ready`
}

export function statusUnavailable(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is unavailable`
}

export function statusLearning(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is learning from your workspace`
}

export function statusOperating(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is operating normally`
}

export function preferencesTitle(teammate: AiTeammatePresentation): string {
  return `${teammate.name} preferences`
}

export function callAssistanceTitle(teammate: AiTeammatePresentation): string {
  return `Call assistance from ${teammate.name}`
}

export function assistFromTeammate(teammate: AiTeammatePresentation): string {
  return `Assist from ${teammate.name}`
}

export function loadingTeammate(teammate: AiTeammatePresentation): string {
  return `Loading ${teammate.name}…`
}

export function askTeammateToPrepare(teammate: AiTeammatePresentation): string {
  return `Ask ${teammate.name} to prepare`
}

export function runTeammate(teammate: AiTeammatePresentation): string {
  return `Run ${teammate.name}`
}

export function meetTeammate(teammate: AiTeammatePresentation): string {
  return `Meet ${teammate.name}`
}

export function launchTeammate(teammate: AiTeammatePresentation): string {
  return `Launch ${teammate.name}`
}

export function askTeammateTab(teammate: AiTeammatePresentation): string {
  return `Ask ${teammate.name}`
}

export function askTeammatePlaceholder(teammate: AiTeammatePresentation): string {
  return `Tell ${teammate.name} what kind of customers to find...`
}

export function importRecommendations(teammate: AiTeammatePresentation): string {
  return `Import ${teammatePossessive(teammate)} Recommendations`
}

export function researchingCompany(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is researching this company…`
}

export function willResearchAutomatically(teammate: AiTeammatePresentation): string {
  return `${teammate.name} will research this company automatically.`
}

export function needsWebsiteForResearch(teammate: AiTeammatePresentation): string {
  return `Add a company website so ${teammate.name} can gather public intelligence.`
}

export function researchCanRetry(teammate: AiTeammatePresentation): string {
  return `Research did not complete — ${teammate.name} can retry automatically.`
}

export function researchWillRefresh(teammate: AiTeammatePresentation): string {
  return `Research is aging — ${teammate.name} will refresh when queued.`
}

export function completedWorkUpdated(teammate: AiTeammatePresentation): string {
  return `${teammate.name} completed work updated.`
}

export function nothingNeededFromYou(teammate: AiTeammatePresentation): string {
  return `${teammate.name} doesn't need anything from you right now.`
}

export function resolveTeammatePresentation(name?: string | null): AiTeammatePresentation {
  return resolveAiTeammatePresentation(name)
}
