"use client"

import { useEffect, useMemo, useState } from "react"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import type { GrowthAutonomySettingsViewModel } from "@/lib/growth/autonomy/growth-autonomy-settings-service"
import type { GrowthOperatorSetupHealthPayload } from "@/lib/growth/operational/ge-v1-2-operator-setup-health-types"
import { GROWTH_HOME_STARTUP_API_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { GROWTH_MISSION_CENTER_API_PATH } from "@/lib/growth/mission-center/growth-mission-center-api-contract"
import type { GrowthMissionCenterSourcesPayload } from "@/lib/growth/mission-center/growth-mission-center-types"
import { synthesizeGrowthHomeLaunchMissionSetup } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import { areStartupAutonomyGuardrailsConfigured } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import type { GrowthAutonomyApprovalPolicies } from "@/lib/growth/autonomy/growth-autonomy-types"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildAvaHomeHero } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { normalizeGrowthHomeAiOsUxViewModel } from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import { buildGrowthAvaAboutReadModel } from "@/lib/growth/ava-about/build-growth-ava-about-read-model"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"

type AutonomyApiResponse = {
  ok?: boolean
  viewModel?: GrowthAutonomySettingsViewModel
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

export function useGrowthAvaAboutData(input: {
  dashboard: GrowthWorkspaceDashboardViewModel | null
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload | null
  operatorDisplayName?: string | null
}) {
  const { teammate } = useAiTeammateIdentity()
  const [loading, setLoading] = useState(true)
  const [autonomy, setAutonomy] = useState<GrowthAutonomySettingsViewModel | null>(null)
  const [setupHealth, setSetupHealth] = useState<GrowthOperatorSetupHealthPayload | null>(null)
  const [activeApproved, setActiveApproved] = useState<BusinessProfileRecord | null>(null)
  const [latestDraft, setLatestDraft] = useState<BusinessProfileRecord | null>(null)
  const [launchSetup, setLaunchSetup] = useState<ReturnType<typeof synthesizeGrowthHomeLaunchMissionSetup> | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [profileRes, missionRes, autonomyRes, setupHealthRes] = await Promise.all([
          fetch(GROWTH_BUSINESS_PROFILE_API_PATH, { cache: "no-store" }),
          fetch(GROWTH_MISSION_CENTER_API_PATH, { cache: "no-store" }),
          fetch(GROWTH_HOME_STARTUP_API_PATHS.autonomy, { cache: "no-store" }),
          fetch(GROWTH_HOME_STARTUP_API_PATHS.operatorSetupHealth, { cache: "no-store" }),
        ])

        const profilePayload = (await profileRes.json()) as GrowthBusinessProfileApiResponse
        const missionPayload = (await missionRes.json()) as GrowthMissionCenterSourcesPayload
        const autonomyPayload = (await autonomyRes.json()) as AutonomyApiResponse
        const setupHealthPayload = (await setupHealthRes.json()) as GrowthOperatorSetupHealthPayload & {
          ok?: boolean
        }

        if (cancelled) return

        if (profileRes.ok && profilePayload.ok) {
          setActiveApproved(profilePayload.activeApproved ?? null)
          setLatestDraft(profilePayload.latestDraft ?? null)
        }

        if (autonomyRes.ok && autonomyPayload.viewModel) {
          setAutonomy(autonomyPayload.viewModel)
        }

        setSetupHealth(setupHealthRes.ok && setupHealthPayload.qaMarker ? setupHealthPayload : null)

        const setupSignals = resolveSetupHealthSignals(
          setupHealthRes.ok && setupHealthPayload.qaMarker ? setupHealthPayload : null,
        )

        setLaunchSetup(
          synthesizeGrowthHomeLaunchMissionSetup({
            businessProfileApproved: Boolean(profilePayload.activeApproved),
            hasBusinessProfileDraft: Boolean(profilePayload.latestDraft),
            objectives: missionPayload.objectiveDashboard?.objectives ?? [],
            mailboxWarnings: input.dashboard?.briefing?.mailbox.warnings ?? 0,
            expiredMailboxes: input.dashboard?.briefing?.mailbox.expired_mailboxes ?? 0,
            connectedMailboxes: setupSignals.connectedMailboxes,
            aiTeammateOnboardingCompleted: true,
            autonomyGuardrailsConfigured: areStartupAutonomyGuardrailsConfigured({
              approvalPolicies:
                (autonomyPayload.viewModel?.settings.approvalPolicies as GrowthAutonomyApprovalPolicies | undefined) ??
                {},
            }),
            calendarConnected: setupSignals.calendarConnected,
            bookingPagesCount: setupSignals.bookingPagesCount,
          }),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    input.dashboard?.briefing?.mailbox.expired_mailboxes,
    input.dashboard?.briefing?.mailbox.warnings,
  ])

  const model = useMemo(() => {
    if (!input.dashboard || !input.workspaceSummary) return null

    const briefing = synthesizeGrowthHomeExecutiveBriefing({
      dashboard: input.dashboard,
      recentViews: [],
      continueItems: [],
      teammate,
      operatorDisplayName: input.operatorDisplayName ?? null,
    })
    const aiOsUx = normalizeGrowthHomeAiOsUxViewModel(briefing.aiOsUx)
    const hero = buildAvaHomeHero({
      greeting: aiOsUx.hero.greeting,
      hour: new Date().getHours(),
      employeeStatus: briefing.employeeStatus,
      aiOsUx,
      researchLoopSummary: input.workspaceSummary.avaConsole?.researchLoopSummary ?? null,
      accomplishments: briefing.accomplishments,
      repliesWaiting: 0,
      workspaceSummary: {
        kpis: input.workspaceSummary.kpis,
        meetings: input.workspaceSummary.meetings,
        inbox: input.workspaceSummary.inbox,
        operatorTasks: input.workspaceSummary.operatorTasks,
        avaConsole: input.workspaceSummary.avaConsole,
        dashboard: input.workspaceSummary.dashboard,
        relationshipSnapshots: input.workspaceSummary.relationshipSnapshots,
        leadPool: input.workspaceSummary.leadPool,
        missionDiscovery: input.workspaceSummary.missionDiscovery ?? null,
      },
      waitingOnYou: aiOsUx.waitingOnYou,
      dailyWorkQueue: aiOsUx.dailyWorkQueue,
      timeline: briefing.timeline,
      previousSnapshot: null,
      operatingRhythmMemory: null,
      persistedMemoryStore: null,
      generatedAt: input.workspaceSummary.generatedAt,
      salesOutcomes: input.workspaceSummary.salesOutcomes ?? null,
      organizationalKnowledge: input.workspaceSummary.organizationalKnowledge?.store.items ?? null,
      operatorDisplayName: input.operatorDisplayName ?? null,
      relationshipSnapshotsById: input.workspaceSummary.relationshipSnapshots?.byLeadId ?? {},
    })

    return buildGrowthAvaAboutReadModel({
      teammate,
      employeeStatus: briefing.employeeStatus,
      dailyBriefing: hero.dailyBriefing,
      workspaceSummary: input.workspaceSummary,
      autonomy,
      setupHealth,
      activeApproved,
      latestDraft,
      launchSetup,
      organizationalKnowledge: input.workspaceSummary.organizationalKnowledge ?? null,
    })
  }, [
    activeApproved,
    autonomy,
    input.dashboard,
    input.operatorDisplayName,
    input.workspaceSummary,
    latestDraft,
    launchSetup,
    setupHealth,
    teammate,
  ])

  return { loading, model, teammate }
}
