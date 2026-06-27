"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { AI_OS_AI_IMPROVEMENTS_TITLE } from "@/lib/workspace/ai-os-outcome-first-terminology"
import { teammateImprovementsSubtitle } from "@/lib/workspace/ai-teammate-voice"
import type { GrowthAiOsOperatorAiImprovement } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"

export function GrowthAiOsOperatorAiImprovementsSection({ items }: { items: GrowthAiOsOperatorAiImprovement[] }) {
  const { teammate } = useAiTeammateIdentity()

  if (items.length === 0) return null

  return (
    <section data-qa-section="operator-ai-improvements" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{AI_OS_AI_IMPROVEMENTS_TITLE}</h2>
        <p className="mt-1 text-muted-foreground">{teammateImprovementsSubtitle(teammate)}</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border/70 bg-card p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-indigo-600" aria-hidden />
              <div className="flex-1 space-y-2">
                <p className="font-medium text-foreground">{item.headline}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
                {item.reviewHref ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={item.reviewHref}>Review improvement</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
