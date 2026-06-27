"use client"

import type { GrowthHomeCsCustomerWin } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CS_CUSTOMER_WINS_TITLE } from "@/lib/workspace/ai-autonomous-customer-success-operator"

type Props = {
  wins: GrowthHomeCsCustomerWin[]
}

export function GrowthHomeCustomerWinsSection({ wins }: Props) {
  if (wins.length === 0) return null

  return (
    <section data-qa-section="home-customer-wins" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CS_CUSTOMER_WINS_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Positive customer outcomes worth celebrating.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {wins.map((win) => (
          <article
            key={win.id}
            className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-4"
          >
            <p className="text-base font-semibold text-foreground">
              <span aria-hidden className="mr-2">
                {win.emoji}
              </span>
              {win.headline}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{win.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
