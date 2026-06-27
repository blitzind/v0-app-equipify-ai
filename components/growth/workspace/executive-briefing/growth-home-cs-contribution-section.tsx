"use client"

import type { GrowthHomeCsContribution } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CS_CONTRIBUTION_TITLE } from "@/lib/workspace/ai-autonomous-customer-success-operator"

type Props = {
  contribution: GrowthHomeCsContribution | null
}

export function GrowthHomeCsContributionSection({ contribution }: Props) {
  if (!contribution) return null

  const metrics = [
    { label: "Retention", value: contribution.retention },
    { label: "Expansion revenue", value: contribution.expansionRevenue },
    { label: "Renewal pipeline", value: contribution.renewalPipeline },
    { label: "Customer health", value: contribution.customerHealth },
    { label: "Advocates created", value: contribution.advocatesCreated },
    { label: "Lifetime value influenced", value: contribution.lifetimeValueInfluenced },
  ]

  return (
    <section data-qa-section="home-cs-contribution" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CS_CONTRIBUTION_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Customer growth impact across Equipify accounts.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
