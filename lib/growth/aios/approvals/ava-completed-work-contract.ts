/** GE-AIOS-SV1-6B / GE-AIOS-IDENTITY-1B — Completed Work presentation contract (client-safe). */

import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { GROWTH_AVA_OPERATOR_SEQUENCE_APPROVAL_HREF } from "@/lib/growth/mission-center/growth-ava-operator-workspace-contract"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import {
  completedWorkDescription,
  completedWorkHeroEmpty,
  completedWorkHeroWaiting,
  completedWorkNavLabel,
  completedWorkTitle,
} from "@/lib/workspace/ai-teammate-voice"

export const GROWTH_AVA_COMPLETED_WORK_PHASE = "GE-AIOS-SV1-6B" as const

export const GROWTH_AVA_COMPLETED_WORK_QA_MARKER = "ge-aios-sv1-6b-ava-completed-work-v1" as const

export const GROWTH_AVA_COMPLETED_WORK_RULE =
  "Completed Work is a thin projection over Human Approval Center + Growth 5F packages — no new approval engine, storage, or send path." as const

export const GROWTH_AVA_COMPLETED_WORK_HREF = GROWTH_HOME_STARTUP_STEP_PATHS.approvals

export const GROWTH_AVA_COMPLETED_WORK_SEQUENCE_GATE_HREF = GROWTH_AVA_OPERATOR_SEQUENCE_APPROVAL_HREF

export function resolveCompletedWorkNavLabel(teammate: AiTeammatePresentation): string {
  return completedWorkNavLabel(teammate)
}

export function resolveCompletedWorkTitle(teammate: AiTeammatePresentation): string {
  return completedWorkTitle(teammate)
}

export function resolveCompletedWorkDescription(teammate: AiTeammatePresentation): string {
  return completedWorkDescription(teammate)
}

export function resolveCompletedWorkHeroEmpty(teammate: AiTeammatePresentation): string {
  return completedWorkHeroEmpty(teammate)
}

export function resolveCompletedWorkHeroWaiting(teammate: AiTeammatePresentation): string {
  return completedWorkHeroWaiting(teammate)
}

export const GROWTH_AVA_COMPLETED_WORK_NEEDS_REVISION_NOTE_PREFIX = "needs_revision:" as const

export const GROWTH_AVA_COMPLETED_WORK_CATEGORY_ORDER = [
  "outreach_packages",
  "meeting_preparations",
  "follow_up_recommendations",
  "accounts_need_review",
  "other",
] as const

export type GrowthAvaCompletedWorkCategoryId =
  (typeof GROWTH_AVA_COMPLETED_WORK_CATEGORY_ORDER)[number]

export const GROWTH_AVA_COMPLETED_WORK_CATEGORY_LABELS: Record<
  GrowthAvaCompletedWorkCategoryId,
  string
> = {
  outreach_packages: "Outreach Packages",
  meeting_preparations: "Meeting Preparations",
  follow_up_recommendations: "Follow-up Recommendations",
  accounts_need_review: "Accounts Need Review",
  other: "Other completed work",
}
