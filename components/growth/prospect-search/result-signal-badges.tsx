"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

const SIGNAL_STYLES: Record<string, string> = {
  "Pricing Interest": "bg-amber-50 text-amber-900 border-amber-200",
  "Returning Visitor": "bg-sky-50 text-sky-900 border-sky-200",
  "Demo Interest": "bg-violet-50 text-violet-900 border-violet-200",
  "Vendor Evaluation": "bg-indigo-50 text-indigo-900 border-indigo-200",
  "Search Intent": "bg-cyan-50 text-cyan-900 border-cyan-200",
  "Purchase Ready": "bg-emerald-50 text-emerald-900 border-emerald-200",
}

function inferBadges(row: GrowthProspectSearchCompanyResult): string[] {
  const badges: string[] = []
  const signals = row.signals.join(" ").toLowerCase()
  const stage = (row.buying_stage ?? "").toLowerCase()
  const category = (row.search_intent_category ?? "").toLowerCase()

  if (category.includes("pricing") || signals.includes("pricing")) badges.push("Pricing Interest")
  if (signals.includes("returning") || signals.includes("repeat")) badges.push("Returning Visitor")
  if (category.includes("demo") || signals.includes("demo")) badges.push("Demo Interest")
  if (stage.includes("vendor") || category.includes("vendor")) badges.push("Vendor Evaluation")
  if (row.search_intent_category) badges.push("Search Intent")
  if (stage.includes("purchase")) badges.push("Purchase Ready")

  if (badges.length === 0 && row.intent_score != null && row.intent_score >= 12) {
    badges.push("Search Intent")
  }

  return [...new Set(badges)].slice(0, 4)
}

export function ResultSignalBadges({
  row,
  className,
}: {
  row: GrowthProspectSearchCompanyResult
  className?: string
}) {
  const badges = inferBadges(row)
  if (badges.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className={cn("text-[10px] font-medium", SIGNAL_STYLES[label] ?? "")}
        >
          {label}
        </Badge>
      ))}
    </div>
  )
}

export function recommendedMotion(row: GrowthProspectSearchCompanyResult): string {
  const stage = (row.buying_stage ?? "").toLowerCase()
  if (stage.includes("purchase")) return "Prioritize outreach — purchase-ready signals"
  if (stage.includes("vendor") || stage.includes("comparison")) return "Send comparison-focused follow-up"
  if (row.intent_score != null && row.intent_score >= 15) return "Review in Lead Inbox — high intent"
  if (row.lead_score != null && row.lead_score >= 50) return "Run Lead Engine enrichment"
  return "Add to list or push to inbox for review"
}
