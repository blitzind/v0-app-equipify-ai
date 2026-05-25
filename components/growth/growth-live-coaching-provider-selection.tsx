"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { LiveCoachingProviderComparisonRow } from "@/lib/growth/realtime/live-coaching/live-coaching-provider-selection"
import { cn } from "@/lib/utils"

function readinessTone(value: boolean, negative = false): "healthy" | "neutral" | "attention" {
  if (negative) return value ? "attention" : "healthy"
  return value ? "healthy" : "neutral"
}

export function GrowthLiveCoachingProviderComparisonTable({
  rows,
  compact = false,
}: {
  rows: LiveCoachingProviderComparisonRow[]
  compact?: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
        No transcript providers configured yet. Add a connection on the Call Providers dashboard, then return here
        to select an active provider for live coaching.
      </p>
    )
  }

  const badgeClass = compact ? "px-1.5 py-0 text-[9px] font-medium normal-case tracking-normal" : undefined

  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div key={row.connectionId} className="rounded-lg border border-border p-2.5 text-xs dark:border-[#25324C]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <GrowthBadge label={row.providerLabel} tone="neutral" className={badgeClass} />
              {row.recommended ? <GrowthBadge label="Recommended" tone="healthy" className={badgeClass} /> : null}
              {row.active ? <GrowthBadge label="Active" tone="attention" className={badgeClass} /> : null}
            </div>
            <div className={cn("mt-2 grid grid-cols-2 gap-1.5", compact && "gap-1")}>
              <MetricBadge label="Configured" value={row.configured} compact={compact} />
              <MetricBadge label="Validated" value={row.validated} compact={compact} />
              <MetricBadge label="Browser mic" value={row.browserMicSupported} compact={compact} />
              <MetricBadge label="Live transcript" value={row.liveTranscriptSupported} compact={compact} />
              <MetricBadge label="Guidance" value={row.liveGuidanceCompatible} compact={compact} />
              <MetricBadge label="Latency" value={`${row.averageTranscriptLatencyMs}ms`} text compact={compact} />
              <MetricBadge label="Reliability" value={String(row.reliabilityScore)} text compact={compact} />
            </div>
            <div className="mt-1.5">
              {row.circuitOpen ? (
                <GrowthBadge label="Circuit open" tone="attention" className={badgeClass} />
              ) : row.degraded ? (
                <GrowthBadge label="Degraded" tone="attention" className={badgeClass} />
              ) : (
                <GrowthBadge label={row.readinessStatus.replace(/_/g, " ")} tone="neutral" className={badgeClass} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block dark:border-[#25324C]">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>Provider</th>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>Configured</th>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>Validated</th>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>Browser mic</th>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>Live transcript</th>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>Guidance</th>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>Latency</th>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>Reliability</th>
            <th className={cn("px-2.5 font-medium", compact ? "py-1.5" : "py-2")}>State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.connectionId} className="border-t border-border dark:border-[#25324C]">
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <GrowthBadge label={row.providerLabel} tone="neutral" className={badgeClass} />
                  {row.recommended ? <GrowthBadge label="Recommended" tone="healthy" className={badgeClass} /> : null}
                  {row.active ? <GrowthBadge label="Active" tone="attention" className={badgeClass} /> : null}
                </div>
              </td>
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>
                <GrowthBadge label={row.configured ? "Yes" : "No"} tone={readinessTone(row.configured)} className={badgeClass} />
              </td>
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>
                <GrowthBadge label={row.validated ? "Yes" : "No"} tone={readinessTone(row.validated)} className={badgeClass} />
              </td>
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>
                <GrowthBadge
                  label={row.browserMicSupported ? "Yes" : "No"}
                  tone={readinessTone(row.browserMicSupported)}
                  className={badgeClass}
                />
              </td>
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>
                <GrowthBadge
                  label={row.liveTranscriptSupported ? "Yes" : "No"}
                  tone={readinessTone(row.liveTranscriptSupported)}
                  className={badgeClass}
                />
              </td>
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>
                <GrowthBadge
                  label={row.liveGuidanceCompatible ? "Yes" : "No"}
                  tone={readinessTone(row.liveGuidanceCompatible)}
                  className={badgeClass}
                />
              </td>
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>{row.averageTranscriptLatencyMs}ms</td>
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>{row.reliabilityScore}</td>
              <td className={cn("px-2.5", compact ? "py-1.5" : "py-2")}>
                {row.circuitOpen ? (
                  <GrowthBadge label="Circuit open" tone="attention" className={badgeClass} />
                ) : row.degraded ? (
                  <GrowthBadge label="Degraded" tone="attention" className={badgeClass} />
                ) : (
                  <GrowthBadge label={row.readinessStatus.replace(/_/g, " ")} tone="neutral" className={badgeClass} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  )
}

function MetricBadge({
  label,
  value,
  text = false,
  compact = false,
}: {
  label: string
  value: boolean | string
  text?: boolean
  compact?: boolean
}) {
  if (text) {
    return (
      <div className={cn("rounded-md bg-muted/30 px-2 py-1", compact && "px-1.5 py-0.5")}>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
    )
  }

  const boolValue = Boolean(value)
  return (
    <div className={cn("rounded-md bg-muted/30 px-2 py-1", compact && "px-1.5 py-0.5")}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <GrowthBadge
        label={boolValue ? "Yes" : "No"}
        tone={readinessTone(boolValue)}
        className={compact ? "px-1.5 py-0 text-[9px] font-medium normal-case tracking-normal" : undefined}
      />
    </div>
  )
}
