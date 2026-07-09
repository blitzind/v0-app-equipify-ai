"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  GROWTH_HOME_BRIEFING_CROSS_LINKS,
  GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER,
} from "@/lib/growth/home/growth-home-cleanup-19c-2g"

type Props = {
  pendingApprovals?: number
}

export function GrowthHomeBriefingCrossLinks({ pendingApprovals = 0 }: Props) {
  return (
    <nav
      data-qa-section="home-briefing-cross-links"
      data-qa-marker-19c-2g={GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER}
      aria-label="Briefing shortcuts"
      className="flex flex-wrap gap-2"
    >
      {GROWTH_HOME_BRIEFING_CROSS_LINKS.map((link) => {
        const label =
          link.id === "approvals" && pendingApprovals > 0
            ? `${link.label} (${pendingApprovals})`
            : link.label
        return (
          <Link
            key={link.id}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
            title={link.description}
          >
            {label}
            <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
          </Link>
        )
      })}
    </nav>
  )
}
