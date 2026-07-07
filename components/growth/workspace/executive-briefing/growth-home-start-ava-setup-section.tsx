"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Circle, Loader2, Sparkles, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import { GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR } from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import {
  GROWTH_MISSION_CENTER_API_PATH,
  type GrowthMissionCenterSourcesPayload,
} from "@/lib/growth/mission-center"
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
import {
  synthesizeGrowthHomeLaunchMissionSetup,
  type GrowthHomeLaunchMissionSetupStep,
} from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"

type Props = {
  dashboard: GrowthWorkspaceDashboardViewModel
  onSetupProgress?: () => void
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

export function GrowthHomeStartAvaSetupSection({ dashboard, onSetupProgress }: Props) {
  const [sources, setSources] = useState<GrowthMissionCenterSourcesPayload | null>(null)
  const [profileState, setProfileState] = useState<GrowthBusinessProfileApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [missionRes, profileRes] = await Promise.all([
        fetch(GROWTH_MISSION_CENTER_API_PATH, { cache: "no-store" }),
        fetch(GROWTH_BUSINESS_PROFILE_API_PATH, { cache: "no-store" }),
      ])
      const missionPayload = (await missionRes.json()) as GrowthMissionCenterSourcesPayload
      const profilePayload = (await profileRes.json()) as GrowthBusinessProfileApiResponse
      setSources(missionRes.ok && missionPayload.ok ? missionPayload : null)
      setProfileState(profileRes.ok && profilePayload.ok ? profilePayload : null)
    } catch {
      setSources(null)
      setProfileState(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setup = useMemo(
    () =>
      synthesizeGrowthHomeLaunchMissionSetup({
        businessProfileApproved: Boolean(profileState?.activeApproved),
        hasBusinessProfileDraft: Boolean(profileState?.latestDraft),
        objectives: sources?.objectiveDashboard?.objectives ?? [],
        mailboxWarnings: dashboard.briefing?.mailbox.warnings ?? 0,
        expiredMailboxes: dashboard.briefing?.mailbox.expired_mailboxes ?? 0,
        mailboxSummary: dashboard.briefing?.section_summaries.mailbox ?? null,
      }),
    [profileState, sources, dashboard],
  )

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
            "Default acquisition mission created from Start Ava setup — Ava monitors lead search and prepares recommendations under approval guardrails.",
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

  if (loading && !sources) {
    return (
      <section
        data-qa-section="home-start-ava-setup"
        className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking Ava launch readiness…
      </section>
    )
  }

  if (!setup.showCard) return null

  return (
    <section
      data-qa-section="home-start-ava-setup"
      data-qa-marker={GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER}
      className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-background to-background p-5 space-y-4 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_AVA_LAUNCH_MISSION_SETUP_DESCRIPTION}</p>
        </div>
      </div>

      <ul className="space-y-2 rounded-xl border border-border/60 bg-background/80 px-4 py-3">
        {setup.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 text-sm" data-setup-step={step.id}>
            <span className="mt-0.5">
              <StepIcon step={step} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.summary}</p>
            </div>
            {step.actionKind !== "none" && step.status !== "complete" ? (
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
            ) : null}
          </li>
        ))}
      </ul>

      {setup.completionCopy ? (
        <p className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
          {setup.completionCopy}
        </p>
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
      ) : null}
    </section>
  )
}
