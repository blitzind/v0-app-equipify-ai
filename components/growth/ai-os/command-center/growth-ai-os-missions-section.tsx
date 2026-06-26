"use client"

import { Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_MISSION_FRAMEWORK_QA_MARKER,
  type GrowthMissionFrameworkReadModel,
} from "@/lib/growth/aios/growth/growth-mission-framework-types"

export function GrowthAiOsMissionsSection({
  missionFramework,
}: {
  missionFramework: GrowthMissionFrameworkReadModel
}) {
  const displayMissions = [
    ...missionFramework.planner.activeMissions,
    ...missionFramework.missions.filter((m) => m.currentStatus === "blocked"),
  ].slice(0, 12)

  return (
    <Card
      data-qa-marker={GROWTH_MISSION_FRAMEWORK_QA_MARKER}
      data-qa-section="missions"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="size-5 text-emerald-600" />
          Missions
        </CardTitle>
        <CardDescription>{missionFramework.rule}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">
            {missionFramework.summary.totalMissions} mission(s) · Active:{" "}
            {missionFramework.summary.active} · Blocked: {missionFramework.summary.blocked} ·
            Stalled: {missionFramework.summary.stalled}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Completed: {missionFramework.summary.completed} · Waiting for human:{" "}
            {missionFramework.summary.waitingForHuman}
          </p>
        </div>

        {displayMissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missions derived yet.</p>
        ) : (
          <div className="space-y-3">
            {displayMissions.map((mission) => (
              <div key={mission.missionId} className="rounded-lg border border-border/70 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {mission.companyName ?? mission.leadId} ·{" "}
                      {mission.missionType.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mission.currentStatus.replaceAll("_", " ")} · {mission.health.state}
                    </p>
                  </div>
                  <Badge variant="outline">{Math.round(mission.progress * 100)}%</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Owner: {mission.ownerAgent.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="outline">Priority: {mission.priority}</Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{mission.objective}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Next: {mission.nextRecommendation}
                </p>
                {mission.supportingAgents.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Supporting: {mission.supportingAgents.map((a) => a.replaceAll("_", " ")).join(", ")}
                  </p>
                ) : null}
                {mission.blockedReasons.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Blocked: {mission.blockedReasons.slice(0, 2).join(" · ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
