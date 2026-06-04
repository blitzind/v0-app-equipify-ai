"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildProspectSearchActionableResearchPlan,
  buildProspectSearchSuggestedGrowthEngineActions,
} from "@/lib/growth/prospect-search/prospect-search-actionable-research"
import { executeProspectSearchActionableResearch } from "@/lib/growth/prospect-search/prospect-search-actionable-research-execute"
import { GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-actionable-research-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function ProspectSearchActionableResearchActions({
  company,
  actionKind,
  actionLabel,
  compact = false,
  onComplete,
}: {
  company: GrowthProspectSearchCompanyResult
  actionKind?: string
  actionLabel?: string
  compact?: boolean
  onComplete?: (message: string, ok: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [localMessage, setLocalMessage] = useState<string | null>(null)

  const plan = actionKind
    ? buildProspectSearchActionableResearchPlan({ company, actionKind })
    : null

  async function run(kind: string) {
    setBusy(true)
    setLocalMessage(null)
    try {
      const result = await executeProspectSearchActionableResearch({
        company,
        actionKind: kind,
        companyCandidateId: company.id,
      })
      setLocalMessage(result.message)
      onComplete?.(result.message, result.ok)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Research action failed."
      setLocalMessage(msg)
      onComplete?.(msg, false)
    } finally {
      setBusy(false)
    }
  }

  if (actionKind && plan) {
    return (
      <div
        data-qa-marker={GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER}
        data-actionable-research="single"
      >
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          variant="outline"
          className="text-xs"
          disabled={busy || !plan.can_execute}
          title={plan.blocked_reason ?? plan.description}
          onClick={() => void run(actionKind)}
        >
          {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          {actionLabel ?? plan.label}
        </Button>
        {plan.blocked_reason && !plan.can_execute ? (
          <p className="mt-1 text-[10px] text-amber-800">{plan.blocked_reason}</p>
        ) : null}
        {localMessage ? (
          <p className="mt-1 text-[10px] text-muted-foreground">{localMessage}</p>
        ) : null}
      </div>
    )
  }

  const suggestions = buildProspectSearchSuggestedGrowthEngineActions(company)
  if (!suggestions.length) return null

  return (
    <div
      className="mt-3 rounded-lg border border-sky-200 bg-white px-3 py-2"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER}
      data-actionable-research="suggested"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-950">
        <Sparkles className="size-3.5" />
        Growth Engine research (operator-triggered)
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Queues existing discovery/intelligence jobs — does not run automatically from search filters.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.lane}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={busy || !suggestion.can_execute}
            title={suggestion.blocked_reason ?? suggestion.description}
            onClick={() => void run(mapLaneToActionKind(suggestion.lane))}
          >
            {suggestion.label}
          </Button>
        ))}
      </div>
      {localMessage ? (
        <p className="mt-2 text-[10px] text-muted-foreground">{localMessage}</p>
      ) : null}
    </div>
  )
}

function mapLaneToActionKind(
  lane: import("@/lib/growth/prospect-search/prospect-search-actionable-research-types").GrowthProspectSearchGrowthEngineJobLane,
): string {
  switch (lane) {
    case "email_discovery":
      return "verify_email"
    case "phone_discovery":
      return "verify_phone_numbers"
    case "social_profile_discovery":
      return "queue_social_profile_discovery"
    case "company_intelligence":
      return "rerun_website_extraction"
    case "buying_committee_intelligence":
      return "expand_relationship_coverage"
    default:
      return "additional_contact_research"
  }
}
