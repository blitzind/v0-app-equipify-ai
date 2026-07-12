"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import {
  AI_OS_EXCEPTIONS_SECTION_TITLE,
  aiOsExceptionsSectionSubtitle,
} from "@/lib/workspace/ai-os-outcome-first-terminology"
import type { GrowthAiOsOperatorAttentionCard } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"

export function GrowthAiOsNeedsAttentionSection({ items }: { items: GrowthAiOsOperatorAttentionCard[] }) {
  const { teammate } = useAiTeammateIdentity()

  return (
    <section data-qa-section="operator-exceptions" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{AI_OS_EXCEPTIONS_SECTION_TITLE}</h2>
        <p className="mt-1 text-muted-foreground">{aiOsExceptionsSectionSubtitle(teammate)}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
          <p className="text-base text-muted-foreground">Nothing urgent right now. AI is operating within normal bounds.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  <h3 className="text-lg font-semibold leading-snug">{item.headline}</h3>
                </div>
                <p className="text-base text-muted-foreground">{item.summary}</p>
                <p className="text-sm font-medium text-indigo-700">{item.estimatedImpact}</p>
              </div>
              <Button asChild variant="outline" className="mt-5 w-fit">
                <Link href={item.ctaHref}>{item.ctaLabel}</Link>
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
