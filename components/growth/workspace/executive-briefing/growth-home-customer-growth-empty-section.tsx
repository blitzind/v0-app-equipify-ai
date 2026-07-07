"use client"

import {
  GROWTH_HOME_FRESH_AVA_HEADLINE,
  GROWTH_HOME_FRESH_AVA_SUBLINE,
} from "@/lib/growth/workspace/executive-briefing/growth-home-runtime-activity"

export function GrowthHomeCustomerGrowthEmptySection() {
  return (
    <div
      data-qa-section="home-customer-growth-empty"
      className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-8 text-center"
    >
      <p className="text-lg font-semibold text-foreground">{GROWTH_HOME_FRESH_AVA_HEADLINE}</p>
      <p className="mt-2 text-sm text-muted-foreground">{GROWTH_HOME_FRESH_AVA_SUBLINE}</p>
    </div>
  )
}
