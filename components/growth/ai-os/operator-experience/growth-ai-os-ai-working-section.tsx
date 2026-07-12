"use client"

import { Loader2 } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import type { GrowthAiOsOperatorWorkingItem } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import { aiOsWorkInProgressTitle } from "@/lib/workspace/ai-os-outcome-first-terminology"
import { teammateWorkInProgressSubtitle } from "@/lib/workspace/ai-teammate-voice"

export function GrowthAiOsAiWorkingSection({ items }: { items: GrowthAiOsOperatorWorkingItem[] }) {
  const { teammate } = useAiTeammateIdentity()

  return (
    <section data-qa-section="operator-ai-work-in-progress" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{aiOsWorkInProgressTitle(teammate)}</h2>
        <p className="mt-1 text-muted-foreground">{teammateWorkInProgressSubtitle(teammate)}</p>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/15 px-5 py-4 text-base"
          >
            <Loader2 className="size-4 shrink-0 animate-spin text-indigo-600" aria-hidden />
            <span className="font-medium text-foreground">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
