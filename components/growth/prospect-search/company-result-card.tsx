"use client"

import { ExternalLink, Inbox, ListPlus, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  recommendedMotion,
  ResultSignalBadges,
} from "@/components/growth/prospect-search/result-signal-badges"
import { CompanySignalMomentumPanel } from "@/components/growth/prospect-search/company-signal-momentum-panel"
import { CompanySignalAiInsightPanel } from "@/components/growth/prospect-search/company-signal-ai-insight-panel"
import { CompanySignalSummaryPanel } from "@/components/growth/prospect-search/company-signal-summary-panel"
import { CompanyEnrichmentBadges } from "@/components/growth/prospect-search/company-enrichment-badges"
import { CompanyIntelligenceCard } from "@/components/growth/company-signals/company-intelligence-card"
import { BuyingCommitteePanel } from "@/components/growth/prospect-search/buying-committee-panel"
import { CompanyContactIntelligencePanel } from "@/components/growth/prospect-search/company-contact-intelligence-panel"
import { CompanyContactsPanel } from "@/components/growth/prospect-search/company-contacts-panel"
import { CompanyGrowthSignalsPanel } from "@/components/growth/prospect-search/company-growth-signals-panel"
import { RelatedCompaniesPanel } from "@/components/growth/prospect-search/related-companies-panel"
import { CompanyConfidenceSummary } from "@/components/growth/prospect-search/company-confidence-summary"
import { RealWorldSourceBadge } from "@/components/growth/prospect-search/real-world-provider-status"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"
import { CompanyQualificationMetrics } from "@/components/growth/prospect-search/company-qualification-metrics"
import { CompanyResultExplanations } from "@/components/growth/prospect-search/company-result-explanations"
import { CompanyStatusBadges } from "@/components/growth/prospect-search/company-status-badges"
import { ProspectWorkflowLauncher } from "@/components/growth/prospect-search/prospect-workflow-launcher"

export function CompanyResultCard({
  row,
  selected,
  checked,
  onSelect,
  onCheckedChange,
  onAction,
  onWorkflowLaunch,
  workflowBusy = false,
  searchQuery,
  savedSearchId,
  onResearchAction,
}: {
  row: GrowthProspectSearchCompanyResult
  selected: boolean
  checked: boolean
  onSelect: () => void
  onCheckedChange: (checked: boolean) => void
  onAction: (action: string, extra?: Record<string, unknown>) => void
  onResearchAction?: (actionId: string) => void
  onWorkflowLaunch?: (input: {
    actionId: string
    launchUrl?: string | null
    serverAction?: string | null
    timelineEventKind?: string | null
  }) => void | Promise<void>
  workflowBusy?: boolean
  searchQuery?: string
  savedSearchId?: string | null
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
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${row.company_name}`}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight">{row.company_name}</h3>
          {row.website ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.website}</p>
          ) : null}
          {row.location ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.location}</p>
          ) : row.city || row.state || row.postal_code ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[row.city, row.state, row.postal_code].filter(Boolean).join(", ")}
            </p>
          ) : null}
          {row.matched_territory_label ? (
            <p className="mt-1 text-[11px] text-sky-800">{row.matched_territory_label}</p>
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
                {row.employees}
              </Badge>
            ) : null}
          </div>
          <CompanyEnrichmentBadges row={row} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Confidence</p>
          <p className="text-lg font-bold text-violet-700">
            {Math.round((row.signal_confidence ?? row.confidence) * 100)}%
          </p>
        </div>
      </div>

      <CompanyStatusBadges row={row} />
      {row.contact_intelligence?.account_contact_strategy ? (
        <p className="text-xs font-medium text-cyan-900">
          {row.contact_intelligence.account_contact_strategy.strategy_summary ??
            row.contact_intelligence.account_contact_strategy.safest_next_action}
        </p>
      ) : null}
      <ResultSignalBadges row={row} />
      <CompanySignalMomentumPanel row={row} className="mt-1" />
      <CompanySignalAiInsightPanel row={row} />

      {row.growth_signal_score != null ? (
        <p className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-xs text-sky-950">
          <span className="font-semibold">Growth signals:</span> {row.growth_signal_score}/100
          {row.growth_signal_tier ? ` · ${row.growth_signal_tier}` : ""}
          {row.growth_signal_recommended_action ? ` — ${row.growth_signal_recommended_action}` : ""}
        </p>
      ) : null}

      {row.company_confidence || row.committee_completion ? (
        <CompanyConfidenceSummary
          confidence={row.company_confidence}
          committee={row.committee_completion}
        />
      ) : null}

      {row.company_signal_summary ? (
        <CompanySignalSummaryPanel
          summary={row.company_signal_summary}
          signalConfidence={row.signal_confidence ?? row.confidence}
          signalCount={row.signal_count ?? 0}
        />
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <CompanyQualificationMetrics row={row} />
        <CompanyResultExplanations row={row} />
      </div>

      {!row.recommended_next_step_reason ? (
        <p className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs text-violet-900">
          <span className="font-semibold">Recommended motion:</span> {motion}
        </p>
      ) : null}

      {row.signals[0] ? (
        <p className="text-xs text-muted-foreground line-clamp-2">{row.signals[0]}</p>
      ) : null}

      {selected ? (
        <>
          <CompanyContactIntelligencePanel
            companyName={row.company_name}
            intelligence={row.contact_intelligence}
            onResearchAction={onResearchAction}
          />
          {row.contact_intelligence?.company_contact_coverage?.ranking_summary ? (
            <p className="text-xs font-medium text-violet-900">
              {row.contact_intelligence.company_contact_coverage.ranking_summary}
            </p>
          ) : null}
          {row.contact_intelligence?.contact_coverage_label ? (
            <p className="text-xs text-violet-900">
              Contact coverage: {row.contact_intelligence.contact_coverage_label}
              {row.contact_intelligence.contact_confidence_score != null
                ? ` · confidence ${row.contact_intelligence.contact_confidence_score}%`
                : ""}
            </p>
          ) : null}
        </>
      ) : null}

      {row.source_type === "external_discovered" && selected ? (
        <>
          <CompanyIntelligenceCard
            companyCandidateId={row.id}
            companyName={row.company_name}
            compact
            suppressSchemaNotice={Boolean(row.contact_intelligence?.schema_health?.warning_message)}
          />
          <CompanyContactsPanel
            companyId={row.id}
            companyName={row.company_name}
            website={row.website}
            growthLeadId={row.growth_lead_id}
          />
          <CompanyGrowthSignalsPanel
            companyId={row.id}
            companyName={row.company_name}
            website={row.website}
            contactCoverageLabel={row.contact_intelligence?.contact_coverage_label}
            lastVerifiedAt={row.growth_signal_last_computed_at}
            suppressSchemaNotice={Boolean(row.contact_intelligence?.schema_health?.warning_message)}
          />
          <BuyingCommitteePanel companyCandidateId={row.id} companyName={row.company_name} />
          {row.related_companies?.length ? (
            <RelatedCompaniesPanel
              relatedCompanies={row.related_companies}
              companyName={row.company_name}
            />
          ) : null}
        </>
      ) : selected && row.related_companies?.length ? (
        <RelatedCompaniesPanel relatedCompanies={row.related_companies} companyName={row.company_name} />
      ) : null}

      {selected && onWorkflowLaunch ? (
        <div onClick={(e) => e.stopPropagation()}>
          <ProspectWorkflowLauncher
            company={row}
            query={searchQuery}
            savedSearchId={savedSearchId}
            busy={workflowBusy}
            onLaunch={({ action, launchUrl, serverAction, timelineEventKind }) =>
              onWorkflowLaunch({
                actionId: action.id,
                launchUrl,
                serverAction,
                timelineEventKind,
              })
            }
          />
        </div>
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
        <Button size="sm" onClick={() => onAction("push_to_lead_inbox")} disabled={row.is_suppressed}>
          <Inbox className="mr-1 size-3.5" />
          {row.is_suppressed ? "Suppressed" : "Push To Lead Inbox"}
        </Button>
      </div>
    </article>
  )
}
