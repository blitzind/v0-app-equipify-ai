"use client"

import Link from "next/link"
import type { GrowthHomeActivityGroup } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { teammateWorkInProgressSubtitle } from "@/lib/workspace/ai-teammate-voice"

export function GrowthHomeAiActivitySection({ groups }: { groups: GrowthHomeActivityGroup[] }) {
  const { teammate } = useAiTeammateIdentity()

  return (
    <section id="ai-work-summary" data-qa-section="home-ai-work-in-progress" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{teammate.name} is handling</h2>
        <p className="mt-1 text-sm text-muted-foreground">{teammateWorkInProgressSubtitle(teammate)}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const inner = (
            <>
              <p className="font-medium text-foreground">{group.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{group.summary}</p>
            </>
          )

          if (group.href) {
            return (
              <Link
                key={group.id}
                href={group.href}
                className="rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/25 hover:bg-muted/20"
              >
                {inner}
              </Link>
            )
          }

          return (
            <div key={group.id} className="rounded-xl border border-border/60 bg-card p-4">
              {inner}
            </div>
          )
        })}
      </div>
    </section>
  )
}
