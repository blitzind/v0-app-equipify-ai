"use client"

import Link from "next/link"
import { GROWTH_LEADS_HUB_PRIMARY_ACTIONS } from "@/lib/growth/hubs/growth-leads-hub-config"
import { recordGrowthLeadsActivity } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { cn } from "@/lib/utils"

export function GrowthLeadsHubPrimaryActions() {
  return (
    <section aria-labelledby="leads-hub-primary-actions-heading" data-section="primary-actions">
      <h2 id="leads-hub-primary-actions-heading" className="sr-only">
        Primary actions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {GROWTH_LEADS_HUB_PRIMARY_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.id}
              href={action.href}
              onClick={() =>
                recordGrowthLeadsActivity({
                  id: `${action.id}:${action.href}`,
                  verb: "Opened",
                  label: action.label,
                  href: action.href,
                })
              }
              className={cn(
                "group flex min-h-[6.5rem] items-start gap-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-primary/5 px-5 py-4 shadow-sm transition-all",
                "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "cursor-pointer",
              )}
              data-primary-action={action.id}
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background text-primary shadow-sm">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-foreground">{action.label}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{action.description}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
