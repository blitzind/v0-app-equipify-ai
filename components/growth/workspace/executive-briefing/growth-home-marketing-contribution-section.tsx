"use client"

import type { GrowthHomeMarketingContribution } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_MARKETING_CONTRIBUTION_TITLE } from "@/lib/workspace/ai-autonomous-marketing-operator"

type Props = {
  contribution: GrowthHomeMarketingContribution | null
}

export function GrowthHomeMarketingContributionSection({ contribution }: Props) {
  if (!contribution) return null

  const metrics = [
    { label: "Pipeline influenced", value: contribution.pipelineInfluenced },
    { label: "Campaign ROI", value: contribution.campaignRoi },
    { label: "Leads generated", value: contribution.leadsGenerated },
    { label: "Meetings influenced", value: contribution.meetingsInfluenced },
    { label: "Revenue influenced", value: contribution.revenueInfluenced },
  ]

  return (
    <section data-qa-section="home-marketing-contribution" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_MARKETING_CONTRIBUTION_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Growth impact from pipeline, meetings, and revenue read models.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border/60 bg-card p-4">
            <dt className="text-sm text-muted-foreground">{metric.label}</dt>
            <dd className="mt-1 text-lg font-semibold text-foreground">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
