"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { DRAWER_NESTED_CARD } from "@/components/detail-drawer"
import type { GrowthCallPriorityTier } from "@/lib/growth/call-types"
import type { GrowthMomentumTier } from "@/lib/growth/momentum-types"
import type { GrowthWorkflowHealthStatus } from "@/lib/growth/workflow-health-types"
import { cn } from "@/lib/utils"

export function GrowthEngineCard({
  title,
  icon,
  children,
  className,
  id,
}: {
  title?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn(DRAWER_NESTED_CARD, "p-4 sm:p-5", className)}>
      {title ? (
        <div className="mb-4 flex items-center gap-2">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function GrowthCollapsibleEngineCard({
  title,
  icon,
  children,
  className,
  id,
  defaultOpen = true,
  headerAside,
  headerTrailing,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  defaultOpen?: boolean
  headerAside?: ReactNode
  headerTrailing?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section id={id} className={cn(DRAWER_NESTED_CARD, "p-4 sm:p-5", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {!open && headerAside ? <div className="ml-auto flex shrink-0 items-center gap-2">{headerAside}</div> : null}
        {headerTrailing ? (
          <div className={cn("flex shrink-0 items-center gap-2", open || !headerAside ? "ml-auto" : null)}>
            {headerTrailing}
          </div>
        ) : null}
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  )
}

export function GrowthBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string
  tone?: "critical" | "high" | "medium" | "low" | "healthy" | "attention" | "stalled" | "blocked" | "neutral" | "status"
  className?: string
}) {
  const tones: Record<string, string> = {
    critical: "border-rose-200 bg-rose-50 text-rose-800",
    high: "border-orange-200 bg-orange-50 text-orange-800",
    medium: "border-sky-200 bg-sky-50 text-sky-800",
    low: "border-slate-200 bg-slate-50 text-slate-600",
    healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
    attention: "border-amber-200 bg-amber-50 text-amber-900",
    stalled: "border-slate-200 bg-slate-100 text-slate-600",
    blocked: "border-rose-200 bg-rose-50 text-rose-800",
    neutral: "border-border bg-muted/40 text-muted-foreground",
    status: "border-violet-200 bg-violet-50 text-violet-800",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}

export function GrowthActionRequiredBadge({ className }: { className?: string }) {
  return (
    <GrowthBadge
      label="Action Required"
      tone="attention"
      className={cn("px-2 py-0 text-[10px] font-medium normal-case tracking-normal", className)}
    />
  )
}

export function priorityTierTone(tier: GrowthCallPriorityTier | null | undefined) {
  switch (tier) {
    case "critical":
      return "critical" as const
    case "high":
      return "high" as const
    case "medium":
      return "medium" as const
    default:
      return "low" as const
  }
}

export function momentumTierTone(tier: GrowthMomentumTier | null | undefined) {
  return priorityTierTone(tier as GrowthCallPriorityTier | null)
}

export function workflowHealthTone(status: GrowthWorkflowHealthStatus | null | undefined) {
  switch (status) {
    case "healthy":
      return "healthy" as const
    case "needs_attention":
      return "attention" as const
    case "stalled":
      return "stalled" as const
    case "blocked":
      return "blocked" as const
    default:
      return "neutral" as const
  }
}

export function formatRelativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"

  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (60 * 1000))
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function researchFreshnessLabel(lastResearchedAt: string | null): {
  label: "Fresh" | "Aging" | "Stale" | "None"
  tone: "healthy" | "attention" | "critical" | "neutral"
} {
  if (!lastResearchedAt) return { label: "None", tone: "neutral" }
  const days = (Date.now() - new Date(lastResearchedAt).getTime()) / (24 * 60 * 60 * 1000)
  if (days <= 7) return { label: "Fresh", tone: "healthy" }
  if (days <= 30) return { label: "Aging", tone: "attention" }
  return { label: "Stale", tone: "critical" }
}

export function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{hint}</p> : null}
    </div>
  )
}
