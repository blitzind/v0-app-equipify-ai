"use client"

import { cn } from "@/lib/utils"
import { formatInfrastructureReadinessForOperator } from "@/lib/growth/deliverability/dns-setup-operator-types"
import type { GrowthInfrastructureReadinessDescriptor } from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import { growthInfrastructureReadinessLabel } from "@/lib/growth/infrastructure/infrastructure-readiness-types"

const STATUS_STYLES: Record<GrowthInfrastructureReadinessDescriptor["status"], string> = {
  live: "border-emerald-300 bg-emerald-100 text-emerald-950 ring-1 ring-emerald-400/40",
  stub: "border-slate-300 bg-slate-100 text-slate-800 ring-1 ring-slate-400/30",
  simulated: "border-amber-300 bg-amber-100 text-amber-950 ring-1 ring-amber-500/50",
  preview_only: "border-violet-300 bg-violet-100 text-violet-950 ring-1 ring-violet-400/40",
  disabled: "border-rose-200 bg-rose-50 text-rose-900 ring-1 ring-rose-300/40",
  internal: "border-sky-300 bg-sky-100 text-sky-950 ring-1 ring-sky-400/30",
  error: "border-rose-400 bg-rose-100 text-rose-950 ring-2 ring-rose-500/50",
  degraded: "border-amber-400 bg-amber-100 text-amber-950 ring-1 ring-amber-500/40",
}

export function GrowthInfrastructureReadinessBadge({
  readiness,
  className,
  showDetail = false,
  operatorFacing = false,
}: {
  readiness: GrowthInfrastructureReadinessDescriptor
  className?: string
  showDetail?: boolean
  operatorFacing?: boolean
}) {
  const resolved = operatorFacing ? formatInfrastructureReadinessForOperator(readiness) : readiness
  const label = resolved.label || growthInfrastructureReadinessLabel(readiness.status)

  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-md border px-2.5 py-1",
          operatorFacing
            ? "text-xs font-semibold normal-case tracking-normal"
            : "text-[11px] font-bold uppercase tracking-wider",
          STATUS_STYLES[resolved.status],
        )}
        title={resolved.detail}
      >
        {label}
      </span>
      {showDetail && resolved.detail ? (
        <span className="max-w-md text-[11px] leading-snug text-muted-foreground">{resolved.detail}</span>
      ) : null}
    </span>
  )
}

export function GrowthInfrastructureReadinessBanner({
  readiness,
  title,
  operatorFacing = false,
}: {
  readiness: GrowthInfrastructureReadinessDescriptor
  title?: string
  operatorFacing?: boolean
}) {
  if (readiness.status === "live") return null

  const resolved = operatorFacing ? formatInfrastructureReadinessForOperator(readiness) : readiness

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        resolved.status === "simulated"
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-border bg-muted/50 text-foreground",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {title ? <span className="font-semibold">{title}</span> : null}
        <GrowthInfrastructureReadinessBadge readiness={readiness} operatorFacing={operatorFacing} />
      </div>
      {resolved.detail ? <p className="mt-1 text-xs opacity-90">{resolved.detail}</p> : null}
    </div>
  )
}
