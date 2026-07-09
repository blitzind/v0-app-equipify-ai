"use client"

import { useEffect, useMemo, useState } from "react"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
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
}) {
  const [loading, setLoading] = useState(true)
  const [activeApproved, setActiveApproved] = useState<BusinessProfileRecord | null>(null)
  const [latestDraft, setLatestDraft] = useState<BusinessProfileRecord | null>(null)
  const [launchSetup, setLaunchSetup] = useState<GrowthHomeLaunchMissionSetupViewModel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      try {
        const [profileRes, missionRes, aiTeammateRes, autonomyRes, setupHealthRes] = await Promise.all([
          fetch(GROWTH_BUSINESS_PROFILE_API_PATH, { cache: "no-store" }),
          fetch(GROWTH_MISSION_CENTER_API_PATH, { cache: "no-store" }),
          fetch(GROWTH_HOME_STARTUP_API_PATHS.aiTeammate, { cache: "no-store" }),
          fetch(GROWTH_HOME_STARTUP_API_PATHS.autonomy, { cache: "no-store" }),
          fetch(GROWTH_HOME_STARTUP_API_PATHS.operatorSetupHealth, { cache: "no-store" }),
        ])

        const profilePayload = (await profileRes.json()) as GrowthBusinessProfileApiResponse
        const missionPayload = (await missionRes.json()) as GrowthMissionCenterSourcesPayload
        const aiTeammatePayload = (await aiTeammateRes.json()) as AiTeammateApiResponse
        const autonomyPayload = (await autonomyRes.json()) as AutonomyApiResponse
        const setupHealthPayload = (await setupHealthRes.json()) as GrowthOperatorSetupHealthPayload & {
          ok?: boolean
        }

        if (cancelled) return

        if (profileRes.ok && profilePayload.ok) {
          setActiveApproved(profilePayload.activeApproved ?? null)
          setLatestDraft(profilePayload.latestDraft ?? null)
        }

        const objectives = missionPayload.objectiveDashboard?.objectives ?? []
        const setupSignals = resolveSetupHealthSignals(
          setupHealthRes.ok && setupHealthPayload.qaMarker ? setupHealthPayload : null,
        )

        const setup = synthesizeGrowthHomeLaunchMissionSetup({
          businessProfileApproved: Boolean(profilePayload.activeApproved),
          hasBusinessProfileDraft: Boolean(profilePayload.latestDraft),
          objectives,
          mailboxWarnings: input.dashboard?.briefing?.mailbox.warnings ?? 0,
          expiredMailboxes: input.dashboard?.briefing?.mailbox.expired_mailboxes ?? 0,
          connectedMailboxes: setupSignals.connectedMailboxes,
          aiTeammateOnboardingCompleted: Boolean(aiTeammatePayload.identity?.onboardingCompleted),
          autonomyGuardrailsConfigured: areStartupAutonomyGuardrailsConfigured({
            approvalPolicies: autonomyPayload.viewModel?.settings?.approvalPolicies ?? {},
          }),
          calendarConnected: setupSignals.calendarConnected,
          bookingPagesCount: setupSignals.bookingPagesCount,
        })

        setLaunchSetup(setup)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load training overview.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [input.dashboard?.briefing?.mailbox.expired_mailboxes, input.dashboard?.briefing?.mailbox.warnings])

  return useMemo(
    () => ({
      loading,
      activeApproved,
      latestDraft,
      launchSetup,
      organizationalKnowledge: input.organizationalKnowledge,
      error,
    }),
    [activeApproved, error, input.organizationalKnowledge, latestDraft, launchSetup, loading],
  )
}
