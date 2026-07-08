"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"
import { GrowthHomeMissionTimelineSection } from "@/components/growth/workspace/executive-briefing/growth-home-mission-timeline-section"
import {
  GROWTH_MISSION_CENTER_HEALTH_LABELS,
  presentationStageLabel,
  type GrowthMissionCenterCard,
  type GrowthMissionCenterDetailSection,
} from "@/lib/growth/mission-center"
import type { GrowthHomeMissionTimelineItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mission: GrowthMissionCenterCard | null
  sections: GrowthMissionCenterDetailSection[]
  timeline: GrowthHomeMissionTimelineItem[]
}

function sectionStatusTone(status: GrowthMissionCenterDetailSection["status"]) {
  switch (status) {
    case "ready":
      return "text-emerald-700 dark:text-emerald-300"
    case "in_progress":
      return "text-sky-700 dark:text-sky-300"
    case "waiting":
      return "text-amber-700 dark:text-amber-300"
    case "blocked":
      return "text-red-700 dark:text-red-300"
    default:
      return "text-muted-foreground"
  }
}

export function GrowthMissionCenterDetailDrawer({ open, onOpenChange, mission, sections, timeline }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({})

  if (!mission) return null

  const missionTimeline = timeline.filter((item) => item.missionId === mission.id || item.missionId === null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{mission.name}</SheetTitle>
          <SheetDescription>{mission.currentActivity}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <Card className="gap-4 py-4 shadow-none">
            <CardContent className="space-y-4 px-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  {GROWTH_MISSION_CENTER_HEALTH_LABELS[mission.health]}
                </span>
                <span className="text-sm text-muted-foreground">Owner · {mission.ownerLabel}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{mission.progressPercent}%</span>
                </div>
                <GrowthHomeProgressBar percent={mission.progressPercent} />
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Current stage</p>
                  <p className="font-medium">{presentationStageLabel(mission.presentationStage)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Priority</p>
                  <p className="font-medium capitalize">{mission.priority}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Confidence</p>
                  <p className="font-medium">{mission.confidence}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Recommended next action</p>
                  <p className="font-medium">{mission.recommendedNextAction}</p>
                </div>
              </div>
              {mission.waitingOn ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                  <span className="font-medium">Waiting on · </span>
                  {mission.waitingOn}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {mission.completedToday.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Completed today</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {mission.completedToday.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-600" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <h3 className="text-base font-semibold">Mission pipeline</h3>
            <div className="space-y-3">
              {sections.map((section) => (
                <Card key={section.id} className="gap-2 py-3 shadow-none">
                  <CardHeader className="px-4 pb-0">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{section.title}</span>
                      <span className={`text-xs font-normal capitalize ${sectionStatusTone(section.status)}`}>
                        {section.status.replaceAll("_", " ")}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4 text-sm">
                    <p className="text-muted-foreground">{section.summary}</p>
                    {section.items.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {section.advancedItems && section.advancedItems.length > 0 ? (
                      <Collapsible
                        open={advancedOpen[section.id] ?? false}
                        onOpenChange={(next) => setAdvancedOpen((current) => ({ ...current, [section.id]: next }))}
                      >
                        <CollapsibleTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" className="gap-2 px-0 text-muted-foreground">
                            <ChevronDown
                              className={`size-4 transition-transform ${advancedOpen[section.id] ? "rotate-180" : ""}`}
                            />
                            Advanced details
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {section.advancedItems.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : null}
                    {section.href ? (
                      <Button asChild variant="link" size="sm" className="h-auto px-0">
                        <Link href={section.href}>Review</Link>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {missionTimeline.length > 0 ? (
            <>
              <Separator />
              <GrowthHomeMissionTimelineSection items={missionTimeline} />
            </>
          ) : null}

          <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
            {mission.controls.map((control) => (
              <Button
                key={`${mission.id}-${control.kind}`}
                asChild
                variant={control.kind === "review_approvals" ? "default" : "outline"}
                size="sm"
                disabled={control.disabled}
              >
                <Link href={control.href}>{control.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
