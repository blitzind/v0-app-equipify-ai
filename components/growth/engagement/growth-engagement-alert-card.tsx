"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementAlert, GrowthEngagementAlertSeverity } from "@/lib/growth/engagement/growth-engagement-alert-types"
import type { GrowthEngagementDrilldownTarget } from "@/components/growth/engagement/growth-engagement-drilldown-drawer"

function severityTone(severity: GrowthEngagementAlertSeverity): "critical" | "high" | "medium" | "low" {
  return severity
}

function drilldownTargetForAlert(alert: GrowthEngagementAlert): GrowthEngagementDrilldownTarget | null {
  if (alert.entityType === "lead") return { kind: "lead", id: alert.entityId }
  if (alert.entityType === "template") return { kind: "template", id: alert.entityId }
  if (alert.entityType === "media") return { kind: "media", id: alert.entityId }
  if (alert.entityType === "share_page") return { kind: "share_page", id: alert.entityId }
  return null
}

export function GrowthEngagementAlertCard({
  alert,
  onOpenDrilldown,
}: {
  alert: GrowthEngagementAlert
  onOpenDrilldown?: (target: GrowthEngagementDrilldownTarget) => void
}) {
  const drilldown = drilldownTargetForAlert(alert)

  return (
    <li className="rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{alert.title}</p>
          <p className="text-muted-foreground">{alert.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={alert.severity} tone={severityTone(alert.severity)} />
          <GrowthBadge label={alert.alertType.replaceAll("_", " ")} tone="neutral" />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{new Date(alert.occurredAt).toLocaleString()}</span>
        <span>{alert.source.replaceAll("_", " ")}</span>
        {drilldown ? (
          <button type="button" className="underline" onClick={() => onOpenDrilldown?.(drilldown)}>
            Open {alert.entityType.replaceAll("_", " ")}
          </button>
        ) : null}
      </div>
    </li>
  )
}
