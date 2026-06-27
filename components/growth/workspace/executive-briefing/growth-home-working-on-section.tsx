"use client"

import Link from "next/link"
import type { GrowthHomeWorkingOnItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_EMPLOYEE_WORKING_ON_TITLE } from "@/lib/workspace/ai-employee-experience"

type Props = {
  items: GrowthHomeWorkingOnItem[]
}

export function GrowthHomeWorkingOnSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-working-on-now" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_EMPLOYEE_WORKING_ON_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Active work in progress right now.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const inner = (
            <span className="flex items-start gap-3 text-base leading-relaxed text-foreground">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              {item.label}
            </span>
          )

          if (item.href) {
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/25 hover:bg-muted/20"
                >
                  {inner}
                </Link>
              </li>
            )
          }

          return (
            <li key={item.id} className="rounded-xl border border-border/60 bg-card p-4">
              {inner}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
