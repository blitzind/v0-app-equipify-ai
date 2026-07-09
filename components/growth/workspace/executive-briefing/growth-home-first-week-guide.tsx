"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, CheckCircle2, Circle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import type { GrowthHomeWaitingOnYouItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import {
  buildGrowthFirstWeekExperienceReadModel,
  dismissGrowthFirstWeekExperience,
  ensureGrowthFirstWeekExperienceStarted,
  GROWTH_FIRST_WEEK_EXPERIENCE_19C_2H_QA_MARKER,
  readGrowthFirstWeekExperienceStorage,
  type GrowthFirstWeekExperienceReadModel,
} from "@/lib/growth/home/growth-first-week-experience-19c-2h"

type Props = {
  setupIncomplete: boolean
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  workManager: AvaWorkManagerResult | null
  pendingApprovals: number
  emailsSentToday: number
  outreachPreparedToday: number
  organizationalKnowledgeCount: number
  learnedTodayCount: number
}

export function GrowthHomeFirstWeekGuide(props: Props) {
  const { onboardingCompleted } = useAiTeammateIdentity()
  const [storageVersion, setStorageVersion] = useState(0)

  const launchReady = onboardingCompleted && !props.setupIncomplete

  useEffect(() => {
    if (!launchReady) return
    ensureGrowthFirstWeekExperienceStarted()
    setStorageVersion((value) => value + 1)
  }, [launchReady])

  const model = useMemo((): GrowthFirstWeekExperienceReadModel => {
    void storageVersion
    return buildGrowthFirstWeekExperienceReadModel({
      onboardingCompleted,
      setupIncomplete: props.setupIncomplete,
      waitingOnYou: props.waitingOnYou,
      workManager: props.workManager,
      pendingApprovals: props.pendingApprovals,
      emailsSentToday: props.emailsSentToday,
      outreachPreparedToday: props.outreachPreparedToday,
      organizationalKnowledgeCount: props.organizationalKnowledgeCount,
      learnedTodayCount: props.learnedTodayCount,
      storage: readGrowthFirstWeekExperienceStorage(),
    })
  }, [
    onboardingCompleted,
    props.emailsSentToday,
    props.learnedTodayCount,
    props.organizationalKnowledgeCount,
    props.outreachPreparedToday,
    props.pendingApprovals,
    props.setupIncomplete,
    props.waitingOnYou,
    props.workManager,
    storageVersion,
  ])

  if (!model.visible) return null

  function handleDismiss() {
    dismissGrowthFirstWeekExperience()
    setStorageVersion((value) => value + 1)
  }

  return (
    <section
      data-qa-section="home-first-week-guide"
      data-qa-marker-19c-2h={GROWTH_FIRST_WEEK_EXPERIENCE_19C_2H_QA_MARKER}
      className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/70 via-background to-background p-5 shadow-sm dark:border-violet-900/40 dark:from-violet-950/20"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-foreground">{model.headline}</h2>
            {model.subheadline ? (
              <p className="text-sm text-muted-foreground">{model.subheadline}</p>
            ) : null}
            {model.dayOfWeek ? (
              <p className="text-xs text-muted-foreground">Day {model.dayOfWeek} of your first week</p>
            ) : null}
          </div>
        </div>
        {model.dismissible ? (
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={handleDismiss}>
            <X className="size-4" aria-hidden />
            <span className="sr-only">Dismiss first-week guide</span>
          </Button>
        ) : null}
      </div>

      <ol className="space-y-2">
        {model.steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              "rounded-lg border px-3 py-2.5",
              step.status === "recommended"
                ? "border-violet-300/70 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-950/20"
                : "border-border/60 bg-background/70",
            )}
          >
            <div className="flex items-start gap-3">
              {step.status === "complete" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    step.status === "recommended" ? "text-violet-600" : "text-muted-foreground/50",
                  )}
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    Day {step.day} — {step.title}
                  </p>
                  {step.status === "recommended" ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                {step.status !== "upcoming" ? (
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                  >
                    Open
                    <ArrowRight className="size-3" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {model.recommendedStep ? (
        <Button asChild size="sm" className="mt-4">
          <Link href={model.recommendedStep.href}>{model.recommendedStep.title}</Link>
        </Button>
      ) : null}
    </section>
  )
}
