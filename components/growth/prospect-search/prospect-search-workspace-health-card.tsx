"use client"

import { Activity } from "lucide-react"
import type { ProspectSearchWorkspaceHealth } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_HEALTH_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

function HealthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-slate-950">{value}</span>
    </div>
  )
}

export function ProspectSearchWorkspaceHealthCard({
  health,
  className,
}: {
  health: ProspectSearchWorkspaceHealth
  className?: string
}) {
  if (health.account_count === 0) return null

  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER}
      data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER}
      data-workspace-health="v1"
    >
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-slate-800" />
        <h4 className="text-sm font-semibold text-slate-950">{PROSPECT_SEARCH_WORKSPACE_HEALTH_TITLE}</h4>
      </div>
      <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <HealthMetric
          label="Hydrated accounts"
          value={`${health.hydrated_account_count}/${health.account_count}`}
        />
        <HealthMetric label="Canonical company coverage" value={`${health.canonical_company_coverage_pct}%`} />
        <HealthMetric label="Person linkage" value={`${health.person_linkage_pct}%`} />
        <HealthMetric label="Verified channel coverage" value={`${health.verified_channel_coverage_pct}%`} />
        <HealthMetric label="Committee coverage" value={`${health.committee_coverage_pct}%`} />
        <HealthMetric
          label="Company intelligence coverage"
          value={`${health.company_intelligence_coverage_pct}%`}
        />
        <HealthMetric label="Outreach ready" value={`${health.outreach_ready_pct}%`} />
      </div>
    </section>
  )
}
