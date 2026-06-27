"use client"

import Link from "next/link"
import type { GrowthHomeCsRenewalMonitoring } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CS_RENEWALS_MONITORING_TITLE } from "@/lib/workspace/ai-autonomous-customer-success-operator"

type Props = {
  items: GrowthHomeCsRenewalMonitoring[]
}

export function GrowthHomeRenewalsMonitoringSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-renewals-monitoring" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CS_RENEWALS_MONITORING_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upcoming renewals with risk and recommended actions.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="block transition-colors hover:opacity-90">
            <article className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-foreground">{item.customer}</p>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.riskLevel} risk · {item.daysRemaining} days
                </span>
              </div>
              <p className="mt-2 text-sm text-foreground">{item.recommendedAction}</p>
              <p className="mt-1 text-xs text-muted-foreground">Owner · {item.owner}</p>
            </article>
          </Link>
        ))}
      </div>
    </section>
  )
}
