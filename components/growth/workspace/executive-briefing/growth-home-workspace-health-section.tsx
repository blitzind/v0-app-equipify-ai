"use client"

import {
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
  GROWTH_HOME_SECTION_WORKSPACE_HEALTH_SUBTITLE,
  GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE,
  type GrowthHomeWorkspaceHealthPresentation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

type Props = {
  presentation: GrowthHomeWorkspaceHealthPresentation | null
}

function toneClass(tone: GrowthHomeWorkspaceHealthPresentation["items"][number]["tone"]): string {
  if (tone === "healthy") return "text-emerald-700 dark:text-emerald-300"
  if (tone === "attention") return "text-amber-700 dark:text-amber-300"
  return "text-foreground"
}

export function GrowthHomeWorkspaceHealthSection({ presentation }: Props) {
  if (!presentation || presentation.items.length === 0) return null

  return (
    <section
      data-qa-section="home-workspace-health"
      data-qa-marker-live-3b={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="mb-4 border-b border-border/50 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground">{GROWTH_HOME_SECTION_WORKSPACE_HEALTH_SUBTITLE}</p>
      </div>

      <ul className="space-y-2">
        {presentation.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className={`font-medium tabular-nums ${toneClass(item.tone)}`}>{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
