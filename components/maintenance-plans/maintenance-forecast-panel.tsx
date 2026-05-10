"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { MaintenanceForecastSummary } from "@/lib/maintenance-plans/forecast"
import { BarChart3, Building2, Package } from "lucide-react"

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] gap-2">
        <span className="text-muted-foreground truncate">{label}</span>
        <span className="tabular-nums text-foreground font-medium shrink-0">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/70 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const EMPTY_EXCLUSIVE = {
  overdue: 0,
  d0_7: 0,
  d8_30: 0,
  d31_60: 0,
  d61_90: 0,
  beyond_90: 0,
  no_date: 0,
}

export function MaintenanceForecastPanel({
  summary,
  variant = "full",
  className,
  contractHint,
  replacementHintSlot,
}: {
  summary: MaintenanceForecastSummary | null | undefined
  variant?: "full" | "compact"
  className?: string
  /** Optional SLA / agreement context (no billing claims). */
  contractHint?: string | null
  /** Optional deterministic replacement-readiness context (compact variant). */
  replacementHintSlot?: ReactNode
}) {
  const exclusive = summary?.exclusive ?? EMPTY_EXCLUSIVE
  const cumulative = summary?.cumulative ?? { within7: 0, within30: 0, within60: 0, within90: 0 }
  const workloadWeeks = Array.isArray(summary?.workloadWeeks) ? summary.workloadWeeks : []
  const workloadMonths = Array.isArray(summary?.workloadMonths) ? summary.workloadMonths : []
  const byCustomer = Array.isArray(summary?.byCustomer) ? summary.byCustomer : []
  const byEquipment = Array.isArray(summary?.byEquipment) ? summary.byEquipment : []
  const forecastableCount = typeof summary?.forecastableCount === "number" ? summary.forecastableCount : 0

  const maxWeek = Math.max(1, ...workloadWeeks.map((w) => w.count))
  const maxMonth = Math.max(1, ...workloadMonths.map((m) => m.count))

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-card/60 p-4 space-y-3",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground">PM forecast</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[
            { label: "Overdue", value: exclusive.overdue, tone: "text-destructive" },
            { label: "≤7 days", value: cumulative.within7, tone: "text-foreground" },
            { label: "≤30 days", value: cumulative.within30, tone: "text-foreground" },
            { label: "≤90 days", value: cumulative.within90, tone: "text-muted-foreground" },
          ].map((c) => (
            <div key={c.label} className="rounded-md border border-border/80 bg-background/80 py-2 px-1">
              <p className={cn("text-lg font-bold tabular-nums", c.tone)}>{c.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Counts include active plans with a next due date. Paused, expired, and archived plans are excluded.
        </p>
        {contractHint?.trim() ? (
          <p className="text-[10px] text-muted-foreground border-t border-border pt-2">{contractHint}</p>
        ) : null}
        {replacementHintSlot}
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <div className="p-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Maintenance forecast</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {forecastableCount} active plan{forecastableCount === 1 ? "" : "s"} with scheduled due
            dates. Workload buckets use calendar weeks (Mon–Sun) and calendar months.
          </p>
        </div>
      </div>

      <div className="p-4 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Due windows</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(
              [
                ["Overdue", exclusive.overdue],
                ["0–7 days", exclusive.d0_7],
                ["8–30 days", exclusive.d8_30],
                ["31–60 days", exclusive.d31_60],
                ["61–90 days", exclusive.d61_90],
                ["90+ days", exclusive.beyond_90],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border border-border px-3 py-2">
                <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cumulative (includes overdue): ≤7d: {cumulative.within7} · ≤30d: {cumulative.within30} · ≤60d:{" "}
            {cumulative.within60} · ≤90d: {cumulative.within90}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Workload — next 8 weeks
          </p>
          <div className="space-y-2.5">
            {workloadWeeks.map((w) => (
              <BarRow key={w.weekStart} label={w.label} count={w.count} max={maxWeek} />
            ))}
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Workload — next 6 months
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {workloadMonths.map((m) => (
              <BarRow key={m.monthKey} label={m.label} count={m.count} max={maxMonth} />
            ))}
          </div>
        </div>

        {(byCustomer.length > 0 || byEquipment.length > 0) && (
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
            {byCustomer.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Top customers (90d horizon)
                </p>
                <ul className="text-xs space-y-1.5">
                  {byCustomer.slice(0, 6).map((r) => (
                    <li key={r.customerId} className="flex justify-between gap-2">
                      <span className="truncate text-foreground">{r.name}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {r.overdue > 0 ? <span className="text-destructive font-medium">{r.overdue} od</span> : null}
                        {r.overdue > 0 && r.upcoming > 0 ? " · " : null}
                        {r.upcoming > 0 ? `${r.upcoming} soon` : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {byEquipment.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Top equipment (90d horizon)
                </p>
                <ul className="text-xs space-y-1.5">
                  {byEquipment.slice(0, 6).map((r) => (
                    <li key={r.equipmentId} className="flex justify-between gap-2">
                      <span className="truncate text-foreground">{r.name}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {r.overdue > 0 ? <span className="text-destructive font-medium">{r.overdue} od</span> : null}
                        {r.overdue > 0 && r.upcoming > 0 ? " · " : null}
                        {r.upcoming > 0 ? `${r.upcoming} soon` : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {contractHint?.trim() ? (
        <div className="px-4 pb-4">
          <p className="text-[10px] text-muted-foreground border-t border-border pt-3">{contractHint}</p>
        </div>
      ) : null}
    </div>
  )
}
