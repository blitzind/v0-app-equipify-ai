"use client"

import {
  growthHomeFreshTeammateHeadline,
  GROWTH_HOME_FRESH_AVA_SUBLINE,
} from "@/lib/growth/workspace/executive-briefing/growth-home-runtime-activity"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"

export function GrowthHomeCustomerGrowthEmptySection() {
  const { teammate } = useAiTeammateIdentity()
  return (
    <div
      data-qa-section="home-customer-growth-empty"
      className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-8 text-center"
    >
      <p className="text-lg font-semibold text-foreground">{growthHomeFreshTeammateHeadline(teammate)}</p>
      <p className="mt-2 text-sm text-muted-foreground">{GROWTH_HOME_FRESH_AVA_SUBLINE}</p>
    </div>
  )
}
