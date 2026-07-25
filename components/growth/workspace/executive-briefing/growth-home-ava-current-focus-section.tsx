"use client"

import Link from "next/link"
import {
  GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER,
  GROWTH_HOME_SIMPLIFICATION_CURRENT_FOCUS_TITLE,
  type GrowthHomeCurrentFocusPresentation,
} from "@/lib/growth/home/growth-home-simplification-1a"

type Props = {
  focus: GrowthHomeCurrentFocusPresentation
}

function FocusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-baseline">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function GrowthHomeAvaCurrentFocusSection({ focus }: Props) {
  const companyNode = focus.companyHref ? (
    <Link href={focus.companyHref} className="text-sm font-semibold text-foreground hover:underline">
      {focus.companyName}
    </Link>
  ) : (
    <p className="text-sm font-semibold text-foreground">{focus.companyName}</p>
  )

  return (
    <section
      data-qa-section="home-ava-current-focus"
      data-qa-marker-simplification-1a={GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER}
      className="rounded-2xl border border-indigo-200/70 bg-indigo-50/30 p-5 dark:border-indigo-900/40 dark:bg-indigo-950/20"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {GROWTH_HOME_SIMPLIFICATION_CURRENT_FOCUS_TITLE}
      </h2>
      <div className="mt-4 space-y-3">
        <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-baseline">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</p>
          {companyNode}
        </div>
        <FocusRow label="Status" value={focus.statusLabel} />
        <FocusRow label="Next Action" value={focus.nextActionLabel} />
        {focus.estimatedEffortLabel ? (
          <FocusRow label="Estimated Effort" value={focus.estimatedEffortLabel} />
        ) : null}
        {focus.confidenceLabel ? <FocusRow label="Confidence" value={focus.confidenceLabel} /> : null}
      </div>
    </section>
  )
}
