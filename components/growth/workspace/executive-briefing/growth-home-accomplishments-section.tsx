"use client"

import type { GrowthHomeAccomplishmentGroup } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_ACCOMPLISHMENTS_TITLE } from "@/lib/workspace/ai-ownership-accountability"

type Props = {
  groups: GrowthHomeAccomplishmentGroup[]
}

export function GrowthHomeAccomplishmentsSection({ groups }: Props) {
  if (groups.length === 0) return null

  return (
    <section data-qa-section="home-what-i-accomplished" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OWNERSHIP_ACCOMPLISHMENTS_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Business outcomes I finished, grouped by area.</p>
      </div>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
            <ul className="mt-2 space-y-2">
              {group.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-base leading-relaxed text-foreground">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
