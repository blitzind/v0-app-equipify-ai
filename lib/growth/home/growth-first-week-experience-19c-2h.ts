/** GE-AIOS-19C-2H — First-week guided experience (client-safe, no new runtime). */

import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { GROWTH_SALES_OPERATIONS_CENTER_ROUTE } from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import {
  GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
  GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
  GROWTH_TRAINING_LEARNED_ROUTE,
} from "@/lib/growth/training/growth-training-workspace-types"
import type { GrowthHomeWaitingOnYouItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export const GROWTH_FIRST_WEEK_EXPERIENCE_19C_2H_QA_MARKER =
  "ge-aios-19c-2h-first-week-experience-v1" as const

export const GROWTH_FIRST_WEEK_EXPERIENCE_STORAGE_KEY =
  "equipify:growth:first-week-experience/v1" as const

export const GROWTH_FIRST_WEEK_DURATION_DAYS = 7 as const

export type GrowthFirstWeekStepId =
  | "company_profile"
  | "watch_operations"
  | "approve_outreach"
  | "business_strategy"
  | "review_learned"

export type GrowthFirstWeekStepStatus = "complete" | "recommended" | "upcoming"

export type GrowthFirstWeekStepDefinition = {
  id: GrowthFirstWeekStepId
  day: number
  title: string
  description: string
  href: string
}

export const GROWTH_FIRST_WEEK_STEP_DEFINITIONS: GrowthFirstWeekStepDefinition[] = [
  {
    id: "company_profile",
    day: 1,
    title: "Review Company Profile",
    description: "Make sure I understand your business facts before I research and prepare outreach.",
    href: GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
  },
  {
    id: "watch_operations",
    day: 2,
    title: "Watch work in Operations",
    description: "See why I chose today's plan and what I'm working through next.",
    href: GROWTH_SALES_OPERATIONS_CENTER_ROUTE,
  },
  {
    id: "approve_outreach",
    day: 3,
    title: "Approve first outreach drafts",
    description: "Review what I prepared and decide what can go out under your guardrails.",
    href: GROWTH_HOME_STARTUP_STEP_PATHS.approvals,
  },
  {
    id: "business_strategy",
    day: 4,
    title: "Add Business Strategy guidance",
    description: "Teach me how you want me to think, prioritize, and communicate.",
    href: GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
  },
  {
    id: "review_learned",
    day: 5,
    title: "Review What I've Learned",
    description: "See validated conclusions I've earned from outcomes so far.",
    href: GROWTH_TRAINING_LEARNED_ROUTE,
  },
]

export type GrowthFirstWeekStepRow = GrowthFirstWeekStepDefinition & {
  status: GrowthFirstWeekStepStatus
}

export type GrowthFirstWeekExperienceReadModel = {
  qaMarker: typeof GROWTH_FIRST_WEEK_EXPERIENCE_19C_2H_QA_MARKER
  visible: boolean
  headline: string
  subheadline: string | null
  recommendedStep: GrowthFirstWeekStepRow | null
  steps: GrowthFirstWeekStepRow[]
  dayOfWeek: number | null
  dismissible: boolean
}

export type GrowthFirstWeekExperienceStorage = {
  startedAt: string
  dismissedAt?: string | null
}

export type BuildGrowthFirstWeekExperienceInput = {
  now?: Date
  onboardingCompleted: boolean
  setupIncomplete: boolean
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  workManager: AvaWorkManagerResult | null
  pendingApprovals: number
  emailsSentToday: number
  outreachPreparedToday: number
  organizationalKnowledgeCount: number
  learnedTodayCount: number
  storage: GrowthFirstWeekExperienceStorage | null
}

function waitingMentionsBusinessProfile(items: GrowthHomeWaitingOnYouItem[]): boolean {
  const combined = items.map((row) => `${row.label} ${row.detail ?? ""}`).join(" ").toLowerCase()
  return /business profile|business understanding|company profile|growth profile/i.test(combined)
}

function resolveStepCompletion(
  id: GrowthFirstWeekStepId,
  input: BuildGrowthFirstWeekExperienceInput,
): boolean {
  if (id === "company_profile") {
    return input.onboardingCompleted && !input.setupIncomplete && !waitingMentionsBusinessProfile(input.waitingOnYou)
  }
  if (id === "watch_operations") {
    const wm = input.workManager
    return Boolean(
      (wm?.all_work_items.length ?? 0) > 0 ||
        (wm?.completed_today.length ?? 0) > 0 ||
        (wm?.active_work != null),
    )
  }
  if (id === "approve_outreach") {
    return (
      input.emailsSentToday > 0 ||
      input.outreachPreparedToday > 0 ||
      (input.workManager?.completed_today.some((row) => row.type === "outreach" || row.type === "approval") ??
        false)
    )
  }
  if (id === "business_strategy") {
    // No reliable business-strategy signal on Home without profile payload — degrade to recommended step.
    return false
  }
  if (id === "review_learned") {
    return input.organizationalKnowledgeCount > 0 || input.learnedTodayCount > 0
  }
  return false
}

function resolveElapsedDay(startedAt: string | null, now: Date): number | null {
  if (!startedAt) return null
  const start = Date.parse(startedAt)
  if (Number.isNaN(start)) return null
  return Math.floor((now.getTime() - start) / 86_400_000) + 1
}

function isWithinFirstWeek(startedAt: string | null, now: Date): boolean {
  const day = resolveElapsedDay(startedAt, now)
  return day != null && day >= 1 && day <= GROWTH_FIRST_WEEK_DURATION_DAYS
}

function resolveDayOfWeekLabel(startedAt: string | null, now: Date): number | null {
  const day = resolveElapsedDay(startedAt, now)
  if (day == null || day < 1) return null
  return Math.min(GROWTH_FIRST_WEEK_DURATION_DAYS, day)
}

export function readGrowthFirstWeekExperienceStorage(): GrowthFirstWeekExperienceStorage | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(GROWTH_FIRST_WEEK_EXPERIENCE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GrowthFirstWeekExperienceStorage
    if (!parsed?.startedAt) return null
    return parsed
  } catch {
    return null
  }
}

export function writeGrowthFirstWeekExperienceStorage(value: GrowthFirstWeekExperienceStorage): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_FIRST_WEEK_EXPERIENCE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore quota / privacy mode
  }
}

export function dismissGrowthFirstWeekExperience(now = new Date()): GrowthFirstWeekExperienceStorage {
  const existing = readGrowthFirstWeekExperienceStorage()
  const next: GrowthFirstWeekExperienceStorage = {
    startedAt: existing?.startedAt ?? now.toISOString(),
    dismissedAt: now.toISOString(),
  }
  writeGrowthFirstWeekExperienceStorage(next)
  return next
}

export function ensureGrowthFirstWeekExperienceStarted(now = new Date()): GrowthFirstWeekExperienceStorage {
  const existing = readGrowthFirstWeekExperienceStorage()
  if (existing?.startedAt) return existing
  const next = { startedAt: now.toISOString() }
  writeGrowthFirstWeekExperienceStorage(next)
  return next
}

export function buildGrowthFirstWeekExperienceReadModel(
  input: BuildGrowthFirstWeekExperienceInput,
): GrowthFirstWeekExperienceReadModel {
  const now = input.now ?? new Date()
  const launchReady = input.onboardingCompleted && !input.setupIncomplete
  const storage = input.storage
  const dismissed = Boolean(storage?.dismissedAt)
  const withinWeek = isWithinFirstWeek(storage?.startedAt ?? null, now)

  const completionById = new Map<GrowthFirstWeekStepId, boolean>()
  for (const def of GROWTH_FIRST_WEEK_STEP_DEFINITIONS) {
    completionById.set(def.id, resolveStepCompletion(def.id, input))
  }

  const firstIncompleteIndex = GROWTH_FIRST_WEEK_STEP_DEFINITIONS.findIndex(
    (def) => !completionById.get(def.id),
  )
  const allComplete = firstIncompleteIndex === -1

  const steps: GrowthFirstWeekStepRow[] = GROWTH_FIRST_WEEK_STEP_DEFINITIONS.map((def, index) => {
    const complete = completionById.get(def.id) ?? false
    let status: GrowthFirstWeekStepStatus = "upcoming"
    if (complete) status = "complete"
    else if (index === firstIncompleteIndex) status = "recommended"
    return { ...def, status }
  })

  const recommendedStep = steps.find((row) => row.status === "recommended") ?? null
  const visible = launchReady && withinWeek && !dismissed && !allComplete

  return {
    qaMarker: GROWTH_FIRST_WEEK_EXPERIENCE_19C_2H_QA_MARKER,
    visible,
    headline: "Your first week with me",
    subheadline: recommendedStep
      ? `Recommended next: ${recommendedStep.title}`
      : "Keep exploring how we work together.",
    recommendedStep,
    steps,
    dayOfWeek: resolveDayOfWeekLabel(storage?.startedAt ?? null, now),
    dismissible: true,
  }
}
