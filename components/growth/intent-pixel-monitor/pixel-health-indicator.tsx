"use client"

import type { GrowthPixelHealthTone } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
import { cn } from "@/lib/utils"

const TONE_STYLES: Record<GrowthPixelHealthTone, { dot: string; ring: string; text: string }> = {
  healthy: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
    text: "text-emerald-800",
  },
  attention: {
    dot: "bg-amber-500",
    ring: "ring-amber-200",
    text: "text-amber-900",
  },
  problem: {
    dot: "bg-red-500",
    ring: "ring-red-200",
    text: "text-red-800",
  },
}

export function PixelHealthIndicator({
  tone,
  label,
  className,
}: {
  tone: GrowthPixelHealthTone
  label: string
  className?: string
}) {
  const styles = TONE_STYLES[tone]
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn("size-2.5 shrink-0 rounded-full ring-2", styles.dot, styles.ring)}
        aria-hidden
      />
      <span className={cn("text-sm font-medium", styles.text)}>{label}</span>
    </span>
  )
}

export function PixelHealthCheckRow({
  label,
  passed,
  tone,
  detail,
}: {
  label: string
  passed: boolean
  tone: GrowthPixelHealthTone
  detail: string
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <PixelHealthIndicator tone={tone} label={passed ? "OK" : "Check"} />
    </li>
  )
}
