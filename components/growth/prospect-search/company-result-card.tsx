"use client"

import { ExternalLink, Inbox, ListPlus, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  recommendedMotion,
  ResultSignalBadges,
} from "@/components/growth/prospect-search/result-signal-badges"
import { CompanySignalSummaryPanel } from "@/components/growth/prospect-search/company-signal-summary-panel"
import { CompanyIntelligenceCard } from "@/components/growth/company-signals/company-intelligence-card"
import { BuyingCommitteePanel } from "@/components/growth/prospect-search/buying-committee-panel"
import { RealWorldSourceBadge } from "@/components/growth/prospect-search/real-world-provider-status"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function CompanyResultCard({
  row,
  selected,
  onSelect,
  onAction,
}: {
  row: GrowthProspectSearchCompanyResult
  selected: boolean
  onSelect: () => void
  onAction: (action: string, extra?: Record<string, unknown>) => void
}) {
  const motion = recommendedMotion(row)

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        selected ? "border-violet-400 ring-2 ring-violet-200" : "border-border",
      )}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      role="button"
      tabIndex={0}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight">{row.company_name}</h3>
          {row.website ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.website}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            {row.industry ? (
              <Badge variant="secondary" className="text-[10px]">
                {row.industry}
              </Badge>
            ) : null}
            {row.source_type === "external_discovered" ? (
              <>
                <Badge variant="secondary" className="text-[10px]">
                  External
                </Badge>
                <RealWorldSourceBadge
                  badge={row.discovery_source_badge}
                  providerType={row.discovery_provider_type}
                />
              </>
            ) : null}
            {row.location ? (
              <Badge variant="outline" className="text-[10px]">
                {row.location}
              </Badge>
            ) : null}
            {row.employees ? (
              <Badge variant="outline" className="text-[10px]">
                {row.employees} employees
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Confidence</p>
          <p className="text-lg font-bold text-violet-700">
            {Math.round((row.signal_confidence ?? row.confidence) * 100)}%
          </p>
        </div>
      </div>

      <ResultSignalBadges row={row} />

      {row.company_signal_summary ? (
        <CompanySignalSummaryPanel
          summary={row.company_signal_summary}
          signalConfidence={row.signal_confidence ?? row.confidence}
          signalCount={row.signal_count ?? 0}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricPill label="Lead score" value={row.lead_score ?? "—"} />
        <MetricPill label="Intent" value={row.intent_score ?? "—"} />
        <MetricPill
          label="Buying stage"
          value={row.buying_stage?.replace(/_/g, " ") ?? "—"}
        />
        <MetricPill
          label="Company match"
          value={
            row.company_match_confidence != null
              ? `${Math.round(row.company_match_confidence * 100)}%`
              : "—"
          }
        />
      </div>

      <p className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs text-violet-900">
        <span className="font-semibold">Recommended motion:</span> {motion}
      </p>

      {row.signals[0] ? (
        <p className="text-xs text-muted-foreground line-clamp-2">{row.signals[0]}</p>
      ) : null}

      {row.source_type === "external_discovered" && selected ? (
        <>
          <CompanyIntelligenceCard
            companyCandidateId={row.id}
            companyName={row.company_name}
            compact
          />
          <BuyingCommitteePanel companyCandidateId={row.id} companyName={row.company_name} />
        </>
      ) : null}

      <div
        className="flex flex-wrap gap-2 border-t border-border pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <Button size="sm" variant="outline" onClick={() => onAction("open_workspace")}>
          <ExternalLink className="mr-1 size-3.5" />
          Open Workspace
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("run_lead_engine")}>
          <Workflow className="mr-1 size-3.5" />
          Run Lead Engine
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAction("create_list", { list_name: row.company_name })}
        >
          <ListPlus className="mr-1 size-3.5" />
          Add To List
        </Button>
        <Button size="sm" onClick={() => onAction("push_to_lead_inbox")}>
          <Inbox className="mr-1 size-3.5" />
          Push To Lead Inbox
        </Button>
      </div>
    </article>
  )
}
