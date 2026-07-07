"use client"

import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  GROWTH_AVA_MISSION_RUNTIME_1B_FIND_LEADS_BINDING_QA_MARKER,
  GROWTH_HOME_FIND_LEADS_MISSION_BINDING_COPY,
  GROWTH_HOME_FIND_LEADS_MISSION_BINDING_MONITOR_LABEL,
  GROWTH_HOME_FIND_LEADS_MISSION_BINDING_NONE_LABEL,
  GROWTH_HOME_FIND_LEADS_MISSION_BINDING_SELECT_LABEL,
  GROWTH_HOME_FIND_LEADS_MISSION_BINDING_TITLE,
} from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"

export type FindLeadsMissionOption = {
  id: string
  title: string
}

type Props = {
  missions: FindLeadsMissionOption[]
  selectedMissionId: string | null
  onSelectedMissionIdChange: (missionId: string | null) => void
  keepMonitoring: boolean
  onKeepMonitoringChange: (value: boolean) => void
  disabled?: boolean
}

export function GrowthHomeFindLeadsMissionBindingCard({
  missions,
  selectedMissionId,
  onSelectedMissionIdChange,
  keepMonitoring,
  onKeepMonitoringChange,
  disabled = false,
}: Props) {
  if (missions.length === 0) return null

  return (
    <Card
      data-qa-section="find-leads-mission-binding"
      data-qa-marker={GROWTH_AVA_MISSION_RUNTIME_1B_FIND_LEADS_BINDING_QA_MARKER}
      className="border-sky-200/80 bg-sky-50/40 py-5 shadow-none dark:border-sky-900/40 dark:bg-sky-950/20"
    >
      <CardContent className="space-y-4 px-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{GROWTH_HOME_FIND_LEADS_MISSION_BINDING_TITLE}</p>
          <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_MISSION_BINDING_COPY}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="find-leads-mission-select">{GROWTH_HOME_FIND_LEADS_MISSION_BINDING_SELECT_LABEL}</Label>
          <select
            id="find-leads-mission-select"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedMissionId ?? ""}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.value
              onSelectedMissionIdChange(value ? value : null)
            }}
          >
            <option value="">{GROWTH_HOME_FIND_LEADS_MISSION_BINDING_NONE_LABEL}</option>
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.title}
              </option>
            ))}
          </select>
        </div>

        {selectedMissionId ? (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={keepMonitoring}
              disabled={disabled}
              onChange={(event) => onKeepMonitoringChange(event.target.checked)}
            />
            <span>{GROWTH_HOME_FIND_LEADS_MISSION_BINDING_MONITOR_LABEL}</span>
          </label>
        ) : null}
      </CardContent>
    </Card>
  )
}
