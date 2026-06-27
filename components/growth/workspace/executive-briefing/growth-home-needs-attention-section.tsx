"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  AI_OS_EXCEPTIONS_SECTION_SUBTITLE,
  AI_OS_EXCEPTIONS_SECTION_TITLE,
} from "@/lib/workspace/ai-os-outcome-first-terminology"
import type { GrowthHomeExceptionItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export function GrowthHomeExceptionsSection({ items }: { items: GrowthHomeExceptionItem[] }) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-exceptions" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OS_EXCEPTIONS_SECTION_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{AI_OS_EXCEPTIONS_SECTION_SUBTITLE}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.ctaHref}
            className="group rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <p className="font-medium text-foreground">{item.headline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {item.ctaLabel}
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** @deprecated use GrowthHomeExceptionsSection */
export const GrowthHomeNeedsAttentionSection = GrowthHomeExceptionsSection
