"use client"

import { useEffect, useMemo, useState } from "react"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { GrowthCanonicalOrganizationTrainingProjection } from "@/lib/growth/training/growth-canonical-organization-training-projection-types"
import type { GrowthHomeLaunchMissionSetupViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import { synthesizeGrowthHomeLaunchMissionSetup } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import { GROWTH_MISSION_CENTER_API_PATH } from "@/lib/growth/mission-center/growth-mission-center-api-contract"
import type { GrowthMissionCenterSourcesPayload } from "@/lib/growth/mission-center/growth-mission-center-types"
import { GROWTH_HOME_STARTUP_API_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import type { GrowthAutonomyApprovalPolicies } from "@/lib/growth/autonomy/growth-autonomy-types"
import type { GrowthOperatorSetupHealthPayload } from "@/lib/growth/operational/ge-v1-2-operator-setup-health-types"
import { areStartupAutonomyGuardrailsConfigured } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

type AiTeammateApiResponse = {
  ok?: boolean
  identity?: { onboardingCompleted?: boolean }
}

type AutonomyApiResponse = {
  ok?: boolean
  viewModel?: {
    settings?: {
      approvalPolicies?: GrowthAutonomyApprovalPolicies
    }
  }
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; payload: T | null }> {
  try {
    const response = await fetch(url, { cache: "no-store" })
    const payload = (await response.json()) as T
    return { ok: response.ok, payload }
  } catch {
    return { ok: false, payload: null }
  }
}

function resolveSetupHealthSignals(payload: GrowthOperatorSetupHealthPayload | null): {
  connectedMailboxes: number
  calendarConnected: boolean
  bookingPagesCount: number
} {
  const items = payload?.items ?? []
  const mailboxItem = items.find((row) => row.id === "connected-mailboxes")
  const calendarItem = items.find((row) => row.id === "google-calendar")
  const bookingItem = items.find((row) => row.id === "booking-pages")
  const connectedMailboxes =
    typeof mailboxItem?.value === "number" ? mailboxItem.value : Number(mailboxItem?.value ?? 0) || 0
  const bookingPagesCount =
    typeof bookingItem?.value === "number" ? bookingItem.value : Number(bookingItem?.value ?? 0) || 0
  const calendarConnected =
    calendarItem?.status === "ok" || String(calendarItem?.value ?? "").toLowerCase() === "connected"

  return { connectedMailboxes, calendarConnected, bookingPagesCount }
}

export function useGrowthTrainingOverviewData(input: {
  dashboard: GrowthWorkspaceDashboardViewModel | null
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload | null
  canonicalOrganizationTraining?: GrowthCanonicalOrganizationTrainingProjection | null
}) {
  const canonicalTraining = input.canonicalOrganizationTraining ?? null
  const [loading, setLoading] = useState(!canonicalTraining)
  const [activeApproved, setActiveApproved] = useState<BusinessProfileRecord | null>(
    canonicalTraining?.activeApproved ?? null,
  )
  const [latestDraft, setLatestDraft] = useState<BusinessProfileRecord | null>(
    canonicalTraining?.latestDraft ?? null,
  )
  const [launchSetup, setLaunchSetup] = useState<GrowthHomeLaunchMissionSetupViewModel | null>(
    canonicalTraining?.launchSetup ?? null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (canonicalTraining) {
      setActiveApproved(canonicalTraining.activeApproved)
      setLatestDraft(canonicalTraining.latestDraft)
      setLaunchSetup(canonicalTraining.launchSetup)
      setLoading(false)
    }
  }, [canonicalTraining])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      if (canonicalTraining) {
        setLoading(false)
      } else {
        setLoading(true)
      }

      const [profileResult, missionResult, aiTeammateResult, autonomyResult, setupHealthResult] =
        await Promise.all([
          fetchJson<GrowthBusinessProfileApiResponse>(GROWTH_BUSINESS_PROFILE_API_PATH),
          fetchJson<GrowthMissionCenterSourcesPayload>(GROWTH_MISSION_CENTER_API_PATH),
          fetchJson<AiTeammateApiResponse>(GROWTH_HOME_STARTUP_API_PATHS.aiTeammate),
          fetchJson<AutonomyApiResponse>(GROWTH_HOME_STARTUP_API_PATHS.autonomy),
          fetchJson<GrowthOperatorSetupHealthPayload & { ok?: boolean }>(
            GROWTH_HOME_STARTUP_API_PATHS.operatorSetupHealth,
          ),
        ])

      if (cancelled) return

      const profilePayload = profileResult.payload
      if (profileResult.ok && profilePayload?.ok) {
        setActiveApproved(profilePayload.activeApproved ?? null)
        setLatestDraft(profilePayload.latestDraft ?? null)
      }

      const missionPayload = missionResult.payload
      const objectives = missionPayload?.objectiveDashboard?.objectives ?? []
      const setupHealthPayload = setupHealthResult.payload
      const setupSignals = resolveSetupHealthSignals(
        setupHealthResult.ok && setupHealthPayload?.qaMarker ? setupHealthPayload : null,
      )

      const aiTeammatePayload = aiTeammateResult.payload
      const autonomyPayload = autonomyResult.payload

      const setup = synthesizeGrowthHomeLaunchMissionSetup({
        businessProfileApproved: Boolean(profilePayload?.activeApproved ?? canonicalTraining?.activeApproved),
        hasBusinessProfileDraft: Boolean(profilePayload?.latestDraft ?? canonicalTraining?.latestDraft),
        objectives,
        mailboxWarnings: input.dashboard?.briefing?.mailbox.warnings ?? 0,
        expiredMailboxes: input.dashboard?.briefing?.mailbox.expired_mailboxes ?? 0,
        connectedMailboxes: setupSignals.connectedMailboxes,
        aiTeammateOnboardingCompleted: Boolean(aiTeammatePayload?.identity?.onboardingCompleted),
        autonomyGuardrailsConfigured: areStartupAutonomyGuardrailsConfigured({
          approvalPolicies: autonomyPayload?.viewModel?.settings?.approvalPolicies ?? {},
        }),
        calendarConnected: setupSignals.calendarConnected,
        bookingPagesCount: setupSignals.bookingPagesCount,
      })

      setLaunchSetup(setup)
      if (!cancelled) setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    canonicalTraining,
    input.dashboard?.briefing?.mailbox.expired_mailboxes,
    input.dashboard?.briefing?.mailbox.warnings,
  ])

  const organizationalKnowledge =
    canonicalTraining?.organizationalKnowledge ?? input.organizationalKnowledge

  return useMemo(
    () => ({
      loading,
      activeApproved,
      latestDraft,
      launchSetup,
      organizationalKnowledge,
      error,
      diagnostic: canonicalTraining?.diagnostic ?? null,
    }),
    [
      activeApproved,
      canonicalTraining?.diagnostic,
      error,
      latestDraft,
      launchSetup,
      loading,
      organizationalKnowledge,
    ],
  )
}
