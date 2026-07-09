"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Circle, Loader2, Sparkles, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import { GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR } from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import {
  GROWTH_MISSION_CENTER_API_PATH,
} from "@/lib/growth/mission-center/growth-mission-center-api-contract"
import type { GrowthMissionCenterSourcesPayload } from "@/lib/growth/mission-center/growth-mission-center-types"
import { GROWTH_AVA_LAUNCH_RUN_TITLE } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import {
  GROWTH_HOME_CANONICAL_STARTUP_EXPERIENCE_18D_QA_MARKER,
  GROWTH_HOME_GET_AVA_READY_LAUNCH_CTA,
  GROWTH_HOME_STARTUP_API_PATHS,
  areStartupAutonomyGuardrailsConfigured,
  shouldPromoteGetAvaReadyAboveFold,
} from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import {
  GROWTH_AVA_LAUNCH_MISSION_SETUP_CTA,
  GROWTH_AVA_LAUNCH_MISSION_SETUP_DESCRIPTION,
  GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER,
  GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE,
  GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE,
  GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TARGET,
  GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
  GROWTH_HOME_FIND_LEADS_SECTION_SELECTOR,
  GROWTH_HOME_MAILBOX_READINESS_SECTION_SELECTOR,
} from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import type { GrowthAutonomyApprovalPolicies } from "@/lib/growth/autonomy/growth-autonomy-types"
import {
  synthesizeGrowthHomeLaunchMissionSetup,
  type GrowthHomeLaunchMissionSetupStep,
} from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import type { GrowthOperatorSetupHealthPayload } from "@/lib/growth/operational/ge-v1-2-operator-setup-health-types"

type Props = {
  dashboard: GrowthWorkspaceDashboardViewModel
  placement?: "primary" | "secondary"
  onSetupProgress?: () => void
}

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

function StepIcon({ step }: { step: GrowthHomeLaunchMissionSetupStep }) {
  if (step.status === "complete") {
    return <Check className="size-4 text-emerald-600" aria-hidden />
  }
  if (step.status === "warning") {
    return <TriangleAlert className="size-4 text-amber-600" aria-hidden />
  }
  if (step.status === "blocked") {
    return <Circle className="size-4 text-muted-foreground/50" aria-hidden />
  }
  return <Circle className="size-4 text-primary" aria-hidden />
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

export function GrowthHomeStartAvaSetupSection({
  dashboard,
  placement = "secondary",
  onSetupProgress,
}: Props) {
  const [sources, setSources] = useState<GrowthMissionCenterSourcesPayload | null>(null)
  const [profileState, setProfileState] = useState<GrowthBusinessProfileApiResponse | null>(null)
  const [aiTeammateOnboardingCompleted, setAiTeammateOnboardingCompleted] = useState<boolean | undefined>(
    undefined,
  )
  const [autonomyGuardrailsConfigured, setAutonomyGuardrailsConfigured] = useState<boolean | undefined>(
    undefined,
  )
  const [setupHealth, setSetupHealth] = useState<GrowthOperatorSetupHealthPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [missionRes, profileRes, aiTeammateRes, autonomyRes, setupHealthRes] = await Promise.all([
        fetch(GROWTH_MISSION_CENTER_API_PATH, { cache: "no-store" }),
        fetch(GROWTH_BUSINESS_PROFILE_API_PATH, { cache: "no-store" }),
        fetch(GROWTH_HOME_STARTUP_API_PATHS.aiTeammate, { cache: "no-store" }),
        fetch(GROWTH_HOME_STARTUP_API_PATHS.autonomy, { cache: "no-store" }),
        fetch(GROWTH_HOME_STARTUP_API_PATHS.operatorSetupHealth, { cache: "no-store" }),
      ])

      const missionPayload = (await missionRes.json()) as GrowthMissionCenterSourcesPayload
      const profilePayload = (await profileRes.json()) as GrowthBusinessProfileApiResponse
      const aiTeammatePayload = (await aiTeammateRes.json()) as AiTeammateApiResponse
      const autonomyPayload = (await autonomyRes.json()) as AutonomyApiResponse
      const setupHealthPayload = (await setupHealthRes.json()) as GrowthOperatorSetupHealthPayload & {
        ok?: boolean
      }

      setSources(missionRes.ok && missionPayload.ok ? missionPayload : null)
      setProfileState(profileRes.ok && profilePayload.ok ? profilePayload : null)
      setAiTeammateOnboardingCompleted(
        aiTeammateRes.ok && aiTeammatePayload.ok
          ? Boolean(aiTeammatePayload.identity?.onboardingCompleted)
          : undefined,
      )
      setAutonomyGuardrailsConfigured(
        autonomyRes.ok && autonomyPayload.ok
          ? areStartupAutonomyGuardrailsConfigured({
              approvalPolicies: autonomyPayload.viewModel?.settings?.approvalPolicies ?? {},
            })
          : undefined,
      )
      setSetupHealth(
        setupHealthRes.ok && setupHealthPayload.qaMarker ? setupHealthPayload : null,
      )
    } catch {
      setSources(null)
      setProfileState(null)
      setAiTeammateOnboardingCompleted(undefined)
      setAutonomyGuardrailsConfigured(undefined)
      setSetupHealth(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const healthSignals = useMemo(() => resolveSetupHealthSignals(setupHealth), [setupHealth])

  const setup = useMemo(
    () =>
      synthesizeGrowthHomeLaunchMissionSetup({
        businessProfileApproved: Boolean(profileState?.activeApproved),
        hasBusinessProfileDraft: Boolean(profileState?.latestDraft),
        objectives: sources?.objectiveDashboard?.objectives ?? [],
        mailboxWarnings: dashboard.briefing?.mailbox.warnings ?? 0,
        expiredMailboxes: dashboard.briefing?.mailbox.expired_mailboxes ?? 0,
        mailboxSummary: dashboard.briefing?.section_summaries.mailbox ?? null,
        connectedMailboxes: healthSignals.connectedMailboxes,
        aiTeammateOnboardingCompleted,
        autonomyGuardrailsConfigured,
        calendarConnected: healthSignals.calendarConnected,
        bookingPagesCount: healthSignals.bookingPagesCount,
      }),
    [profileState, sources, dashboard, healthSignals, aiTeammateOnboardingCompleted, autonomyGuardrailsConfigured],
  )

  const promoteAboveFold = shouldPromoteGetAvaReadyAboveFold({
    setupComplete: setup.setupComplete,
    showCard: setup.showCard,
  })

  const scrollTo = useCallback((selector: string) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const createDefaultMission = useCallback(async () => {
    setActionBusy(true)
    setActionError(null)
    try {
      const response = await fetch("/api/growth/workspace/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
          description:
            "Default acquisition mission created from Get me ready — I monitor lead search and prepare recommendations under approval guardrails.",
          objectiveType: GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE,
          targetValue: GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TARGET,
          autoStart: true,
        }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string; message?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? body.error ?? "Could not create mission.")
      }
      await load()
      onSetupProgress?.()
      scrollTo(GROWTH_HOME_FIND_LEADS_SECTION_SELECTOR)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not create mission.")
    } finally {
      setActionBusy(false)
    }
  }, [load, onSetupProgress, scrollTo])

  const runStepAction = useCallback(
    async (step: GrowthHomeLaunchMissionSetupStep) => {
      setActionError(null)
      if (step.href) {
        window.location.assign(step.href)
        return
      }
      switch (step.actionKind) {
        case "scroll_profile":
          scrollTo(GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR)
          return
        case "create_mission":
          await createDefaultMission()
          return
        case "scroll_find_leads":
          scrollTo(GROWTH_HOME_FIND_LEADS_SECTION_SELECTOR)
          return
        case "scroll_mailbox":
          scrollTo(GROWTH_HOME_MAILBOX_READINESS_SECTION_SELECTOR)
          return
        default:
          return
      }
    },
    [createDefaultMission, scrollTo],
  )

  const handleStartSetup = useCallback(async () => {
    const current = setup.steps.find((step) => step.id === setup.currentStepId) ?? setup.steps[0]
    if (!current) return
    await runStepAction(current)
  }, [runStepAction, setup.currentStepId, setup.steps])

  if (placement === "primary" && !promoteAboveFold) return null
  if (placement === "secondary" && promoteAboveFold) return null

  if (loading && !sources) {
    return (
      <section
        data-qa-section="home-start-ava-setup"
        data-qa-placement={placement}
        className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking if I&apos;m ready to launch…
      </section>
    )
  }

  if (!setup.showCard) return null

  return (
    <section
      data-qa-section="home-start-ava-setup"
      data-qa-marker={GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER}
      data-qa-marker-18d={GROWTH_HOME_CANONICAL_STARTUP_EXPERIENCE_18D_QA_MARKER}
      data-qa-placement={placement}
      data-setup-complete={setup.setupComplete ? "true" : "false"}
      data-ready-for-launch={setup.readyForLaunch ? "true" : "false"}
      className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-background to-background p-5 space-y-4 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{GROWTH_AVA_LAUNCH_MISSION_SETUP_DESCRIPTION}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {setup.completedStepCount} of {setup.totalStepCount} steps complete
              </span>
              <span className="font-medium text-foreground">{setup.progressPercent}%</span>
            </div>
            <Progress value={setup.progressPercent} className="h-2" />
          </div>
        </div>
      </div>

      <ol className="space-y-2 rounded-xl border border-border/60 bg-background/80 px-4 py-3">
        {setup.steps.map((step, index) => {
          const isCurrent = step.id === setup.currentStepId
          return (
            <li
              key={step.id}
              className="flex items-start gap-3 text-sm"
              data-setup-step={step.id}
              data-setup-step-status={step.status}
              data-setup-step-current={isCurrent ? "true" : "false"}
            >
              <span className="mt-0.5 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{index + 1}</span>
                <StepIcon step={step} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.summary}</p>
              </div>
              {step.actionKind !== "none" && step.status !== "complete" ? (
                step.href ? (
                  <Button type="button" size="sm" variant="ghost" className="shrink-0" asChild>
                    <Link href={step.href}>{step.actionKind === "create_mission" ? "Create" : "Open"}</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={actionBusy}
                    onClick={() => void runStepAction(step)}
                  >
                    {step.actionKind === "create_mission" ? "Create" : "Go"}
                  </Button>
                )
              ) : null}
            </li>
          )
        })}
      </ol>

      {setup.completionCopy ? (
        <p className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
          {setup.completionCopy}
        </p>
      ) : null}

      {setup.setupComplete ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={actionBusy}
            onClick={() => scrollTo(GROWTH_HOME_FIND_LEADS_SECTION_SELECTOR)}
          >
            {GROWTH_AVA_LAUNCH_RUN_TITLE} in Find Leads
          </Button>
        </div>
      ) : null}

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      {!setup.setupComplete ? (
        <Button type="button" disabled={actionBusy} onClick={() => void handleStartSetup()}>
          {actionBusy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Working…
            </>
          ) : (
            GROWTH_AVA_LAUNCH_MISSION_SETUP_CTA
          )}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{GROWTH_HOME_GET_AVA_READY_LAUNCH_CTA}</p>
      )}
    </section>
  )
}
