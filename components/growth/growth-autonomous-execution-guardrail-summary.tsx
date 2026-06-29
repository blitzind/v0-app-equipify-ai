"use client"

import { ShieldAlert } from "lucide-react"
import type { AutonomousExecutionGuardrailDisplay } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-view"
import { cn } from "@/lib/utils"

const STATUS_STYLES = {
  Allowed: "text-emerald-700",
  "Requires approval": "text-amber-700",
  Blocked: "text-red-700",
  "Guardrails off": "text-muted-foreground",
} as const

export function GrowthAutonomousExecutionGuardrailSummary({
  display,
  compact = false,
}: {
  display: AutonomousExecutionGuardrailDisplay
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-muted/20 px-3 py-3",
        compact ? "text-xs" : "text-sm",
      )}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-2">
          <p className={cn("font-medium", STATUS_STYLES[display.status_label])}>
            {display.status_label} · {display.risk_level} risk
          </p>
          {!compact && display.reasons.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {display.reasons.slice(0, 5).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {display.blockers.length > 0 ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Blockers:</span> {display.blockers.join(" · ")}
            </p>
          ) : null}
          {display.limits_applied.length > 0 ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Limits:</span> {display.limits_applied.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
