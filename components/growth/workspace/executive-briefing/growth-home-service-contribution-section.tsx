"use client"

import type { GrowthHomeServiceContribution } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_SERVICE_CONTRIBUTION_TITLE } from "@/lib/workspace/ai-autonomous-service-operator"

type Props = {
  contribution: GrowthHomeServiceContribution | null
}

export function GrowthHomeServiceContributionSection({ contribution }: Props) {
  if (!contribution) return null

  const metrics = [
    { label: "Work orders completed", value: contribution.workOrdersCompleted },
    { label: "First-time fix rate", value: contribution.firstTimeFixRate },
    { label: "Technician utilization", value: contribution.technicianUtilization },
    { label: "Customer satisfaction", value: contribution.customerSatisfaction },
    { label: "Review requests", value: contribution.reviewRequests },
    { label: "Service revenue influenced", value: contribution.serviceRevenueInfluenced },
  ]

  return (
    <section data-qa-section="home-service-contribution" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_SERVICE_CONTRIBUTION_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Service business impact from existing aggregates.</p>
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
