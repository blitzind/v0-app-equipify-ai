/** Growth Engine A1 — Video workspace route gates (client-safe). */

import {
  GROWTH_VIDEO_FOUNDATION_CONFIRM,
  GROWTH_VIDEO_FOUNDATION_MIGRATION,
  GROWTH_VIDEO_FOUNDATION_QA_MARKER,
  GROWTH_VIDEO_FEATURE_FLAG,
} from "@/lib/growth/videos/growth-video-types"

export { GROWTH_VIDEO_FOUNDATION_CONFIRM }

export const GROWTH_VIDEO_WORKSPACE_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Video workspace is human-gated — no autonomous outreach or enrollment from video surfaces.",
  "Apply migration before enabling persistence routes.",
  `Feature flag ${GROWTH_VIDEO_FEATURE_FLAG} defaults enabled for internal operators.`,
] as const

function readFlag(env: Record<string, string | undefined>, key: string): string | undefined {
  return env[key]?.trim() || undefined
}

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false
  const raw = value.toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

/**
 * Server env: `GROWTH_VIDEO_WORKSPACE_ENABLED`.
 * Defaults to enabled when unset (internal operator rollout).
 */
export function isGrowthVideoWorkspaceEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = readFlag(env, "GROWTH_VIDEO_WORKSPACE_ENABLED")
  if (!raw) return true
  return isTruthyFlag(raw)
}

/**
 * Client env: `NEXT_PUBLIC_GROWTH_VIDEO_WORKSPACE_ENABLED`.
 * Mirrors server flag for nav visibility.
 */
export function isGrowthVideoWorkspaceEnabledClient(): boolean {
  const raw = process.env.NEXT_PUBLIC_GROWTH_VIDEO_WORKSPACE_ENABLED?.trim()
  if (!raw) return true
  return isTruthyFlag(raw)
}

export function buildGrowthVideoWorkspaceReadinessPayload() {
  return {
    qa_marker: GROWTH_VIDEO_FOUNDATION_QA_MARKER,
    migration: GROWTH_VIDEO_FOUNDATION_MIGRATION,
    execute_confirm: GROWTH_VIDEO_FOUNDATION_CONFIRM,
    feature_flag: GROWTH_VIDEO_FEATURE_FLAG,
    workspace_enabled: isGrowthVideoWorkspaceEnabled(),
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    checklist: GROWTH_VIDEO_WORKSPACE_READINESS_CHECKLIST,
  }
}
