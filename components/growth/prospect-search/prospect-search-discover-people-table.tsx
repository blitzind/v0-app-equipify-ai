"use client"

import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER,
  GROWTH_CONTACT_FRESHNESS_QA_MARKER,
  GROWTH_CONTACT_RANKING_QA_MARKER,
  GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER,
  GROWTH_REVENUE_PERSONA_INTELLIGENCE_QA_MARKER,
  GROWTH_PEOPLE_HYDRATION_QA_MARKER,
  GROWTH_PEOPLE_WORKFLOWS_QA_MARKER,
  GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER,
  GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER,
  GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
  GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER,
  GROWTH_EVIDENCE_FUSION_QA_MARKER,
  GROWTH_CONTACT_CONFLICT_REVIEW_QA_MARKER,
  type GrowthProspectSearchPeopleResultRow,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { formatWebsiteEvidenceQualityLabel } from "@/lib/growth/contact-discovery/website-acquisition-metadata-bridge"
import { formatProspectSearchContactConflictLabel } from "@/lib/growth/prospect-search/prospect-search-contact-identity-operator-review"
import { GROWTH_CONTACT_INFLUENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-influence"
import {
  GROWTH_RELATIONSHIP_MEMORY_QA_MARKER,
  GROWTH_ACCOUNT_TIMELINE_QA_MARKER,
  GROWTH_ACCOUNT_PROGRESSION_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { formatProspectSearchFreshnessLabel } from "@/lib/growth/prospect-search/prospect-search-contact-freshness"
import { prospectSearchPeopleSelectionKey } from "@/lib/growth/prospect-search/prospect-search-people-selection"
import { cn } from "@/lib/utils"

function eligibilityBadgeVariant(state: string): "default" | "outline" | "destructive" | "secondary" {
  if (state === "eligible") return "default"
  if (state === "suppressed" || state === "blocked") return "destructive"
  if (state === "unsupported") return "secondary"
  return "outline"
}

function priorityTierBadgeVariant(
  tier: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (tier === "high_priority" || tier === "recommended") return "default"
  if (tier === "blocked") return "destructive"
  if (tier === "low_confidence") return "secondary"
  return "outline"
}

function formatPriorityTierLabel(tier: string): string {
  return tier.replace(/_/g, " ")
}

function influenceBadgeVariant(
  tier: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (tier === "high_influence" || tier === "operational_authority") return "default"
  if (tier === "gatekeeper") return "secondary"
  if (tier === "low_influence" || tier === "unknown") return "outline"
  return "outline"
}

function formatInfluenceTierLabel(tier: string): string {
  return tier.replace(/_/g, " ")
}

function freshnessBadgeVariant(
  status: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (status === "fresh") return "default"
  if (status === "expired" || status === "stale") return "destructive"
  if (status === "aging") return "secondary"
  return "outline"
}

export function ProspectSearchDiscoverPeopleTable({
  rows,
  selectedKeys,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
  onOpenCompany,
  onOpenContact,
  onAddToQueue,
  onAddToLeadPipeline,
  onAddToCallQueue,
  onRerunDiscovery,
}: {
  rows: GrowthProspectSearchPeopleResultRow[]
  selectedKeys?: Set<string>
  onToggleSelection?: (row: GrowthProspectSearchPeopleResultRow, checked: boolean) => void
  onSelectAllVisible?: () => void
  onClearSelection?: () => void
  onOpenCompany?: (companyId: string) => void
  onOpenContact?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToLeadPipeline?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToCallQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onRerunDiscovery?: (row: GrowthProspectSearchPeopleResultRow) => void
}) {
  const allVisibleSelected =
    rows.length > 0 &&
    selectedKeys &&
    rows.every((row) => selectedKeys.has(prospectSearchPeopleSelectionKey(row)))

  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground"
        data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
        data-people-hydration-marker={GROWTH_PEOPLE_HYDRATION_QA_MARKER}
        data-people-workflows-marker={GROWTH_PEOPLE_WORKFLOWS_QA_MARKER}
        data-result-mode="people"
      >
        <p className="font-medium text-foreground">No verified contacts yet</p>
        <p className="mx-auto mt-2 max-w-md text-xs">
          Run Find contacts on company rows to extract publicly listed people from company websites.
          Empty results may mean no team/contact pages were found, only generic role emails were
          discovered, or the website was unreachable.
        </p>
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-card"
      data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}
      data-people-hydration-marker={GROWTH_PEOPLE_HYDRATION_QA_MARKER}
      data-people-workflows-marker={GROWTH_PEOPLE_WORKFLOWS_QA_MARKER}
      data-contact-eligibility-marker={GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER}
      data-contact-freshness-marker={GROWTH_CONTACT_FRESHNESS_QA_MARKER}
      data-contact-ranking-marker={GROWTH_CONTACT_RANKING_QA_MARKER}
      data-revenue-persona-marker={GROWTH_REVENUE_PERSONA_INTELLIGENCE_QA_MARKER}
      data-contact-verification-depth-marker={GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER}
      data-contact-influence-marker={GROWTH_CONTACT_INFLUENCE_QA_MARKER}
      data-relationship-memory-marker={GROWTH_RELATIONSHIP_MEMORY_QA_MARKER}
      data-account-timeline-marker={GROWTH_ACCOUNT_TIMELINE_QA_MARKER}
        data-account-progression-marker={GROWTH_ACCOUNT_PROGRESSION_QA_MARKER}
      data-deep-contact-acquisition-marker={GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER}
      data-website-extraction-quality-marker={GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER}
      data-public-profile-reference-marker={GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER}
      data-contact-identity-resolution-marker={GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER}
      data-evidence-fusion-marker={GROWTH_EVIDENCE_FUSION_QA_MARKER}
      data-contact-conflict-review-marker={GROWTH_CONTACT_CONFLICT_REVIEW_QA_MARKER}
      data-result-mode="people"
    >
      <table className="w-full min-w-[1280px] text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2">
              {onSelectAllVisible && onClearSelection ? (
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(value) => {
                    if (value === true) onSelectAllVisible()
                    else onClearSelection()
                  }}
                  aria-label="Select all visible contacts"
                />
              ) : null}
            </th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Influence</th>
            <th className="px-3 py-2">Relationship</th>
            <th className="px-3 py-2">Freshness</th>
            <th className="px-3 py-2">Eligibility</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = prospectSearchPeopleSelectionKey(row)
            const suppressed = row.compliance_status === "suppressed"
            return (
              <tr
                key={row.id}
                className={cn(
                  "border-t border-border hover:bg-muted/30",
                  selectedKeys?.has(key) && "bg-cyan-50/50",
                )}
              >
                <td className="px-3 py-2 align-top">
                  {onToggleSelection ? (
                    <Checkbox
                      checked={selectedKeys?.has(key) ?? false}
                      onCheckedChange={(value) => onToggleSelection(row, value === true)}
                      aria-label={`Select ${row.full_name}`}
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    className="font-medium text-left hover:underline"
                    onClick={() => onOpenContact?.(row)}
                  >
                    {row.full_name ?? "—"}
                  </button>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {row.persona_label}
                    {row.is_recommended_contact ? " · Recommended" : ""}
                  </p>
                </td>
                <td className="px-3 py-2">{row.company_name}</td>
                <td className="px-3 py-2">{row.title ?? row.role ?? "—"}</td>
                <td className="px-3 py-2">
                  <div>{row.email ?? "—"}</div>
                  {!row.email?.trim() && row.email_reason ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{row.email_reason}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div>{row.phone ?? "—"}</div>
                  {!row.phone?.trim() && row.phone_reason ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{row.phone_reason}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="max-w-[180px] truncate" title={row.source_label ?? undefined}>
                    {row.source_label ?? "Internal contact research"}
                  </div>
                  {row.last_checked_at ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Checked {new Date(row.last_checked_at).toLocaleDateString()}
                    </p>
                  ) : null}
                  {row.evidence_quality_label ? (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {formatWebsiteEvidenceQualityLabel(row.evidence_quality_label)}
                    </Badge>
                  ) : null}
                  {row.linkedin_reference_label ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">{row.linkedin_reference_label}</p>
                  ) : null}
                  {row.source_count != null && row.source_count > 1 ? (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {row.source_count} fused sources
                    </Badge>
                  ) : null}
                  {row.conflict_status && row.conflict_status !== "no_conflict" ? (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {formatProspectSearchContactConflictLabel(row.conflict_status)}
                    </Badge>
                  ) : null}
                  {row.operator_confirmed ? (
                    <Badge className="mt-1 text-[10px]">Confirmed</Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={priorityTierBadgeVariant(row.priority_tier)} className="text-[10px]">
                    {formatPriorityTierLabel(row.priority_tier)}
                  </Badge>
                  {row.is_recommended_contact ? (
                    <p className="mt-1 text-[10px] font-medium text-violet-800">Recommended contact</p>
                  ) : null}
                  <p
                    className="mt-1 text-[10px] text-muted-foreground"
                    title={row.ranking_reasons.join(" · ")}
                  >
                    {row.recommended_next_action}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={influenceBadgeVariant(row.influence_tier)} className="text-[10px]">
                    {formatInfluenceTierLabel(row.influence_tier)}
                  </Badge>
                  {row.influence_score > 0 ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Score {Math.round(row.influence_score * 100)}%
                    </p>
                  ) : null}
                  {row.sequencing_note ? (
                    <p className="mt-1 text-[10px] text-violet-900" title={row.sequencing_note}>
                      {row.sequencing_note}
                    </p>
                  ) : row.influence_reasons.length > 0 ? (
                    <p
                      className="mt-1 text-[10px] text-muted-foreground"
                      title={row.influence_reasons.join(" · ")}
                    >
                      {row.influence_reasons[0]}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px]">
                    {row.relationship_status.replace(/_/g, " ")}
                  </Badge>
                  {row.relationship_strength_score > 0 ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Strength {row.relationship_strength_score}%
                    </p>
                  ) : null}
                  {row.relationship_summary ? (
                    <p className="mt-1 text-[10px] text-rose-900" title={row.relationship_summary}>
                      {row.relationship_summary}
                    </p>
                  ) : null}
                  {row.relationship_last_interaction_at ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Last {new Date(row.relationship_last_interaction_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={freshnessBadgeVariant(row.freshness_status)} className="text-[10px]">
                    {formatProspectSearchFreshnessLabel(row.freshness_status)}
                  </Badge>
                  {row.stale_warning ? (
                    <p className="mt-1 text-[10px] text-amber-800">{row.stale_warning}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={eligibilityBadgeVariant(row.email_eligibility)} className="text-[10px]">
                      Email
                    </Badge>
                    <Badge variant={eligibilityBadgeVariant(row.call_eligibility)} className="text-[10px]">
                      Call
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{row.readiness_label}</p>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={suppressed}
                      onClick={() => onAddToQueue?.(row)}
                    >
                      Queue
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={suppressed || !row.call_ready}
                      onClick={() => onAddToCallQueue?.(row)}
                    >
                      Call
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={suppressed}
                      onClick={() => onAddToLeadPipeline?.(row)}
                    >
                      Pipeline
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onOpenCompany?.(row.company_id)}>
                      Company
                    </Button>
                    {row.source_page_url ? (
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <a href={row.source_page_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 size-3" />
                          Source
                        </a>
                      </Button>
                    ) : null}
                    {onRerunDiscovery ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => onRerunDiscovery(row)}>
                        Refresh
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ProspectSearchPeopleResultsPanel({
  rows,
  selectedKeys,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
  onOpenCompany,
  onOpenContact,
  onAddToQueue,
  onAddToLeadPipeline,
  onAddToCallQueue,
  onRerunDiscovery,
  className,
}: {
  rows: GrowthProspectSearchPeopleResultRow[]
  selectedKeys?: Set<string>
  onToggleSelection?: (row: GrowthProspectSearchPeopleResultRow, checked: boolean) => void
  onSelectAllVisible?: () => void
  onClearSelection?: () => void
  onOpenCompany?: (companyId: string) => void
  onOpenContact?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToLeadPipeline?: (row: GrowthProspectSearchPeopleResultRow) => void
  onAddToCallQueue?: (row: GrowthProspectSearchPeopleResultRow) => void
  onRerunDiscovery?: (row: GrowthProspectSearchPeopleResultRow) => void
  className?: string
}) {
  return (
    <div className={cn(className)} data-qa-marker={GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}>
      <ProspectSearchDiscoverPeopleTable
        rows={rows}
        selectedKeys={selectedKeys}
        onToggleSelection={onToggleSelection}
        onSelectAllVisible={onSelectAllVisible}
        onClearSelection={onClearSelection}
        onOpenCompany={onOpenCompany}
        onOpenContact={onOpenContact}
        onAddToQueue={onAddToQueue}
        onAddToLeadPipeline={onAddToLeadPipeline}
        onAddToCallQueue={onAddToCallQueue}
        onRerunDiscovery={onRerunDiscovery}
      />
    </div>
  )
}
