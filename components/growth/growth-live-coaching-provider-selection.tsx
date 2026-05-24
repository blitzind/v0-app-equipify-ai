"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { LiveCoachingProviderComparisonRow } from "@/lib/growth/realtime/live-coaching/live-coaching-provider-selection"

function readinessTone(value: boolean, negative = false): "healthy" | "neutral" | "attention" {
  if (negative) return value ? "attention" : "healthy"
  return value ? "healthy" : "neutral"
}

export function GrowthLiveCoachingProviderComparisonTable({
  rows,
}: {
  rows: LiveCoachingProviderComparisonRow[]
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        No transcript providers configured yet. Add a connection on the Call Providers dashboard, then return here
        to select an active provider for live coaching.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Provider</th>
            <th className="px-3 py-2 font-medium">Configured</th>
            <th className="px-3 py-2 font-medium">Validated</th>
            <th className="px-3 py-2 font-medium">Browser mic</th>
            <th className="px-3 py-2 font-medium">Live transcript</th>
            <th className="px-3 py-2 font-medium">Guidance</th>
            <th className="px-3 py-2 font-medium">Latency</th>
            <th className="px-3 py-2 font-medium">Reliability</th>
            <th className="px-3 py-2 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.connectionId} className="border-t border-border">
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <GrowthBadge label={row.providerLabel} tone="neutral" />
                  {row.recommended ? <GrowthBadge label="Recommended" tone="healthy" /> : null}
                  {row.active ? <GrowthBadge label="Active" tone="attention" /> : null}
                </div>
              </td>
              <td className="px-3 py-2">
                <GrowthBadge label={row.configured ? "Yes" : "No"} tone={readinessTone(row.configured)} />
              </td>
              <td className="px-3 py-2">
                <GrowthBadge label={row.validated ? "Yes" : "No"} tone={readinessTone(row.validated)} />
              </td>
              <td className="px-3 py-2">
                <GrowthBadge
                  label={row.browserMicSupported ? "Yes" : "No"}
                  tone={readinessTone(row.browserMicSupported)}
                />
              </td>
              <td className="px-3 py-2">
                <GrowthBadge
                  label={row.liveTranscriptSupported ? "Yes" : "No"}
                  tone={readinessTone(row.liveTranscriptSupported)}
                />
              </td>
              <td className="px-3 py-2">
                <GrowthBadge
                  label={row.liveGuidanceCompatible ? "Yes" : "No"}
                  tone={readinessTone(row.liveGuidanceCompatible)}
                />
              </td>
              <td className="px-3 py-2">{row.averageTranscriptLatencyMs}ms</td>
              <td className="px-3 py-2">{row.reliabilityScore}</td>
              <td className="px-3 py-2">
                {row.circuitOpen ? (
                  <GrowthBadge label="Circuit open" tone="attention" />
                ) : row.degraded ? (
                  <GrowthBadge label="Degraded" tone="attention" />
                ) : (
                  <GrowthBadge label={row.readinessStatus.replace(/_/g, " ")} tone="neutral" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
