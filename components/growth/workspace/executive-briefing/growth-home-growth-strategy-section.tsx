"use client"

import { ArrowDown, Building2, Search, Send, Sparkles } from "lucide-react"
import { GrowthHomeBusinessProfileSection } from "@/components/growth/workspace/executive-briefing/growth-home-business-profile-section"
import { GrowthHomeDatamoonSourcingWorkbenchSection } from "@/components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section"
import { GrowthHomeAvaOpportunityIntelligenceSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-opportunity-intelligence-section"
import type { GrowthHomeDailyWorkQueueItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GROWTH_HOME_GROWTH_STRATEGY_TITLE } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"
import { Button } from "@/components/ui/button"

const WORKFLOW_STEPS = [
  { id: "understand", title: "Understand My Business", icon: Building2 },
  { id: "find", title: "Find Companies", icon: Search },
  { id: "evaluate", title: "Evaluate Opportunities", icon: Sparkles },
  { id: "outreach", title: "Prepare Outreach", icon: Send },
] as const

type Props = {
  dailyWorkQueue: GrowthHomeDailyWorkQueueItem[]
  onPrepareOutreach?: () => void
}

export function GrowthHomeGrowthStrategySection({ dailyWorkQueue, onPrepareOutreach }: Props) {
  return (
    <section
      data-qa-section="home-growth-strategy"
      className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_GROWTH_STRATEGY_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ava&apos;s workflow from business context to qualified outreach.
        </p>
      </div>

      <div className="hidden items-center justify-between gap-2 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-3 text-center text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <div key={step.id} className="contents">
              <div className="flex flex-col items-center gap-1 px-1">
                <span className="flex size-8 items-center justify-center rounded-full border border-border/70 bg-background">
                  <Icon className="size-4 text-foreground/80" aria-hidden />
                </span>
                <span>{step.title}</span>
              </div>
              {index < WORKFLOW_STEPS.length - 1 ? (
                <ArrowDown className="mx-auto size-4 rotate-[-90deg] text-muted-foreground/60" aria-hidden />
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="space-y-3 divide-y divide-border/50">
        <div data-workflow-step="understand" className="space-y-3 pt-0">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Understand My Business</p>
          </div>
          <GrowthHomeBusinessProfileSection embedded />
        </div>

        <div data-workflow-step="find" className="space-y-3 pt-3">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Find Companies</p>
          </div>
          <GrowthHomeDatamoonSourcingWorkbenchSection embedded />
        </div>

        <div data-workflow-step="evaluate" className="space-y-3 pt-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Evaluate Opportunities</p>
          </div>
          <GrowthHomeAvaOpportunityIntelligenceSection dailyWorkQueue={dailyWorkQueue} embedded />
        </div>

        <div data-workflow-step="outreach" className="space-y-3 pt-3">
          <div className="flex items-center gap-2">
            <Send className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Prepare Outreach</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Once leads are approved, Ava prepares sequences and drafts for your review.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onPrepareOutreach}>
              Review outreach readiness
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
