"use client"

import type { GrowthHomeBusinessAwareness } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import Link from "next/link"

type Props = {
  awareness: GrowthHomeBusinessAwareness
}

function AwarenessCard({
  label,
  value,
  detail,
  href,
  tone = "default",
}: {
  label: string
  value?: string
  detail?: string
  href?: string | null
  tone?: "default" | "win" | "risk"
}) {
  const borderClass =
    tone === "win"
      ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      : tone === "risk"
        ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20"
        : "border-border/60 bg-card"

  const inner = (
    <article className={`rounded-xl border p-4 ${borderClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {value ? <p className="mt-2 text-base font-semibold text-foreground">{value}</p> : null}
      {detail ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p> : null}
    </article>
  )

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {inner}
      </Link>
    )
  }

  return inner
}

export function GrowthHomeBusinessAwarenessSection({ awareness }: Props) {
  const hasContent =
    awareness.thisWeek ||
    awareness.thisMonth ||
    awareness.currentObjective ||
    awareness.topWin ||
    awareness.biggestRisk

  if (!hasContent) return null

  return (
    <section data-qa-section="home-business-awareness" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Business awareness</h2>
        <p className="mt-1 text-sm text-muted-foreground">Context from your current revenue priorities.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {awareness.thisWeek ? (
          <AwarenessCard label={awareness.thisWeek.label} value={awareness.thisWeek.value} />
        ) : null}
        {awareness.thisMonth ? (
          <AwarenessCard label={awareness.thisMonth.label} value={awareness.thisMonth.value} />
        ) : null}
        {awareness.currentObjective ? (
          <AwarenessCard
            label={awareness.currentObjective.label}
            detail={awareness.currentObjective.detail}
            href={awareness.currentObjective.href}
          />
        ) : null}
        {awareness.topWin ? (
          <AwarenessCard
            label="Top Win"
            value={awareness.topWin.headline}
            detail={awareness.topWin.detail}
            tone="win"
          />
        ) : null}
        {awareness.biggestRisk ? (
          <AwarenessCard
            label="Biggest Risk"
            value={awareness.biggestRisk.headline}
            detail={awareness.biggestRisk.detail}
            tone="risk"
          />
        ) : null}
      </div>
    </section>
  )
}
