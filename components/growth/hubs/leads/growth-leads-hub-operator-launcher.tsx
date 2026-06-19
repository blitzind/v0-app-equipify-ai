"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_LEADS_HUB_LAUNCHER_GROUPS } from "@/lib/growth/hubs/growth-leads-hub-config"
import { recordGrowthLeadsActivity } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { cn } from "@/lib/utils"

export function GrowthLeadsHubOperatorLauncher() {
  return (
    <section aria-labelledby="leads-hub-launcher-heading" data-section="operator-launcher">
      <GrowthEngineCard title="Operator Launcher" data-section="operator-launcher">
        <h2 id="leads-hub-launcher-heading" className="sr-only">
          Operator launcher
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {GROWTH_LEADS_HUB_LAUNCHER_GROUPS.map((group) => (
            <div key={group.id} className="rounded-lg border border-border/70 bg-muted/5 px-3 py-2.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h3>
              <ul className="mt-1.5 space-y-0.5">
                {group.actions.map((action) => {
                  const Icon = action.icon
                  return (
                    <li key={action.id}>
                      <Link
                        href={action.href}
                        onClick={() => {
                          recordGrowthLeadsActivity({
                            id: `${action.id}:${action.href}`,
                            verb: "Opened",
                            label: action.label,
                            href: action.href,
                          })
                        }}
                        className={cn(
                          "group flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 transition-colors",
                          "hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        )}
                        data-launcher-action={action.id}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {Icon ? <Icon className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
                          <span className="text-sm font-medium text-foreground">{action.label}</span>
                          {action.badge ? (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              {action.badge}
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </GrowthEngineCard>
    </section>
  )
}
