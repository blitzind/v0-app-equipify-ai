"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"
import { GrowthMissionCenterDetailDrawer } from "@/components/growth/mission-center/growth-mission-center-detail-drawer"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_TITLE,
  GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_SUBTITLE,
  GROWTH_MISSION_CENTER_EMPTY_STATE_COPY,
  GROWTH_MISSION_CENTER_API_PATH,
  GROWTH_MISSION_CENTER_HEALTH_LABELS,
  GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER,
  buildMissionCenterDetailView,
  synthesizeGrowthMissionCenter,
  type GrowthMissionCenterCard,
  type GrowthMissionCenterSourcesPayload,
} from "@/lib/growth/mission-center"
import { GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR, GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL } from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"

type Props = {
  dashboard: GrowthWorkspaceDashboardViewModel
}

export function GrowthHomeMissionCenterSection({ dashboard }: Props) {
  const [sources, setSources] = useState<GrowthMissionCenterSourcesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedMission, setSelectedMission] = useState<GrowthMissionCenterCard | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const loadSources = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(GROWTH_MISSION_CENTER_API_PATH, { cache: "no-store" })
      const payload = (await res.json()) as GrowthMissionCenterSourcesPayload
      if (res.ok && payload.ok) {
        setSources(payload)
        setLoadFailed(false)
      } else {
        setSources(null)
        setLoadFailed(true)
      }
    } catch {
      setSources(null)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const businessProfileApproved = Boolean(sources?.businessProfile?.activeApproved)

  const missionCenter = useMemo(
    () =>
      synthesizeGrowthMissionCenter({
        dashboard,
        objectiveDashboard: sources?.objectiveDashboard,
        businessProfileApproved,
        revenueDirectorSnapshot: sources?.revenueDirectorSnapshot,
      }),
    [dashboard, sources, businessProfileApproved],
  )

  const selectedObjective = useMemo(
    () => sources?.objectiveDashboard?.objectives.find((o) => o.id === selectedMission?.id) ?? null,
    [sources, selectedMission],
  )

  const detailView = useMemo(() => {
    if (!selectedMission) return null
    return buildMissionCenterDetailView({
      mission: selectedMission,
      objective: selectedObjective,
      businessProfileApproved,
      pendingApprovalCount: missionCenter.pendingApprovalCount,
    })
  }, [selectedMission, selectedObjective, businessProfileApproved, missionCenter.pendingApprovalCount])

  function openMission(mission: GrowthMissionCenterCard) {
    setSelectedMission(mission)
    setDrawerOpen(true)
  }

  function handleCreateBusinessProfile() {
    const section = document.querySelector(GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR)
    section?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (loading && !sources) {
    return (
      <section
        data-qa-section="home-mission-center"
        className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading Ava&apos;s missions…
      </section>
    )
  }

  const hasActiveMissions = missionCenter.activeMissions.length > 0

  return (
    <>
      <section
        data-qa-section="home-mission-center"
        data-qa-marker={GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER}
        className="rounded-2xl border border-border/70 bg-card p-6 space-y-5"
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_TITLE}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_SUBTITLE}</p>
        </div>

        <div className="space-y-4">
          {!hasActiveMissions ? (
            <div
              data-qa-section="home-mission-center-empty"
              className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm"
            >
              <p className="font-medium text-foreground">No active missions yet</p>
              <p className="mt-1 text-muted-foreground">{GROWTH_MISSION_CENTER_EMPTY_STATE_COPY}</p>
              {loadFailed ? (
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void loadSources()}>
                  Retry loading missions
                </Button>
              ) : null}
            </div>
          ) : null}
          {missionCenter.activeMissions.map((mission) => (
            <article
              key={mission.id}
              className="rounded-2xl border border-border/60 bg-card p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{mission.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{mission.currentActivity}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    {GROWTH_MISSION_CENTER_HEALTH_LABELS[mission.health]}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{mission.statusLabel}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{mission.progressPercent}%</span>
                </div>
                <GrowthHomeProgressBar percent={mission.progressPercent} />
              </div>

              {mission.completedToday.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Completed today</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {mission.completedToday.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {mission.waitingOn ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                  <span className="font-medium">Waiting on · </span>
                  {mission.waitingOn}
                </p>
              ) : null}

              {mission.businessProfileBlocked ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={handleCreateBusinessProfile}>
                    {GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL}
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                <Button type="button" size="sm" onClick={() => openMission(mission)}>
                  View Details
                </Button>
                {missionCenter.pendingApprovalCount > 0 ? (
                  <Button asChild size="sm" variant="default">
                    <Link href={missionCenter.approvalsHref}>Review Approvals</Link>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={mission.controls.find((c) => c.kind === "review_leads")?.href ?? mission.detailHref}>
                    Review Leads
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <GrowthMissionCenterDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mission={selectedMission}
        sections={detailView?.sections ?? []}
        timeline={missionCenter.timeline}
      />
    </>
  )
}
