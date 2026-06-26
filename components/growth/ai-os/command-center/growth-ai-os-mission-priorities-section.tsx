"use client"

import { ArrowUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_MISSION_PRIORITY_QA_MARKER,
  type GrowthMissionPriorityReadModel,
} from "@/lib/growth/aios/growth/growth-mission-priority-types"

export function GrowthAiOsMissionPrioritiesSection({
  missionPriority,
}: {
  missionPriority: GrowthMissionPriorityReadModel
}) {
  const topMissions = missionPriority.rankedMissions.slice(0, 12)

  return (
    <Card
      data-qa-marker={GROWTH_MISSION_PRIORITY_QA_MARKER}
      data-qa-section="mission-priorities"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowUpDown className="size-5 text-orange-600" />
          Mission Priorities
        </CardTitle>
        <CardDescription>{missionPriority.rule}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">
            {missionPriority.summary.missionsRanked} ranked · Immediate:{" "}
            {missionPriority.summary.immediate} · Today: {missionPriority.summary.today} ·
            Deferred: {missionPriority.summary.deferred}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {missionPriority.revenueOperatorGuidance.highestValueWork}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {missionPriority.capacityPool.map((slot) => (
            <div key={slot.capacityKind} className="rounded-md border border-border/60 p-2 text-xs">
              <p className="font-medium">{slot.label}</p>
              <p className="text-muted-foreground">
                {slot.allocatedSlots}/{slot.totalSlots} allocated · {slot.availableSlots} free
              </p>
            </div>
          ))}
        </div>

        {topMissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missions to prioritize yet.</p>
        ) : (
          <div className="space-y-3">
            {topMissions.map((row) => (
              <div key={row.missionId} className="rounded-lg border border-border/70 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      #{row.priority.recommendedOrder} · {row.companyName ?? row.leadId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.missionType.replaceAll("_", " ")} · {row.queueBucket.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Badge variant="outline">Priority {row.priority.overallPriority}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">ROI {row.priority.estimatedRoi}</Badge>
                  <Badge variant="outline">Urgency {row.priority.urgencyScore}</Badge>
                  <Badge variant="outline">
                    Confidence {row.priority.confidenceScore}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{row.allocationReason}</p>
                {row.blockers.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Blockers: {row.blockers.slice(0, 2).join(" · ")}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Recommended: {row.recommendedAction}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
