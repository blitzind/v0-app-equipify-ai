"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, CircleDashed, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthTrainingSectionCard } from "@/components/growth/training/growth-training-section-card"
import { buildGrowthTrainingOverviewReadModel } from "@/lib/growth/training/build-growth-training-overview-read-model"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { GrowthHomeLaunchMissionSetupViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import { GROWTH_TRAINING_OVERVIEW_TITLE } from "@/lib/growth/training/growth-training-workspace-types"
import { cn } from "@/lib/utils"

type Props = {
  loading: boolean
  activeApproved: BusinessProfileRecord | null
  latestDraft: BusinessProfileRecord | null
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload | null
  launchSetup: GrowthHomeLaunchMissionSetupViewModel | null
}

function statusLabel(status: string): string {
  if (status === "complete") return "Well understood"
  if (status === "available") return "Available"
  if (status === "in_progress") return "In progress"
  return "Needs coaching"
}

export function GrowthTrainingOverviewSection({
  loading,
  activeApproved,
  latestDraft,
  organizationalKnowledge,
  launchSetup,
}: Props) {
  if (loading) {
    return (
      <GrowthTrainingSectionCard title={GROWTH_TRAINING_OVERVIEW_TITLE} qaSection="training-overview">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Reviewing what I know about your business…
        </div>
      </GrowthTrainingSectionCard>
    )
  }

  const overview = buildGrowthTrainingOverviewReadModel({
    activeApproved,
    latestDraft,
    organizationalKnowledge,
    launchSetup,
  })

  return (
    <GrowthTrainingSectionCard
      title={GROWTH_TRAINING_OVERVIEW_TITLE}
      description="How well do I know your business?"
      qaSection="training-overview"
    >
      <div className="space-y-6" data-qa-marker={overview.qaMarker}>
        <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <p className="text-base font-medium text-foreground">{overview.headline}</p>
          {overview.subheadline ? (
            <p className="mt-2 text-sm text-muted-foreground">{overview.subheadline}</p>
          ) : null}
          {overview.recommendedNextAction ? (
            <Button asChild size="sm" className="mt-4">
              <Link href={overview.recommendedNextAction.href}>
                {overview.recommendedNextAction.label}
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {overview.areas.map((area) => (
            <Link
              key={area.id}
              href={area.href}
              className="rounded-xl border border-border/60 bg-background/80 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/20 dark:hover:border-indigo-900/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{area.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{area.summary}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                    area.status === "complete" || area.status === "available"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : area.status === "in_progress"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {statusLabel(area.status)}
                </span>
              </div>
              {area.coachingHint ? (
                <p className="mt-3 text-xs text-muted-foreground">{area.coachingHint}</p>
              ) : null}
            </Link>
          ))}
        </div>

        {overview.wellUnderstood.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-foreground">Strong understanding of</p>
            <ul className="mt-2 space-y-1">
              {overview.wellUnderstood.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {overview.needsCoaching.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-foreground">Still learning</p>
            <ul className="mt-2 space-y-1">
              {overview.needsCoaching.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {overview.confidenceNote ? (
          <p className="text-xs text-muted-foreground">{overview.confidenceNote}</p>
        ) : null}
      </div>
    </GrowthTrainingSectionCard>
  )
}
