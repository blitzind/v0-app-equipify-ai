"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, ListOrdered, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  GROWTH_SEQUENCE_RECOMMENDATION_PANEL_QA_MARKER,
  isSequenceRecommendationEnabledClient,
} from "@/lib/growth/contact-verification/sequence-recommendation-feature"
import type {
  SequenceRecommendationApiResponse,
  SequenceRecommendationView,
} from "@/lib/growth/contact-verification/sequence-recommendation-view"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

function readinessBadgeVariant(
  readiness: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (readiness === "ready") return "default"
  if (readiness === "blocked" || readiness === "not_recommended") return "destructive"
  if (readiness === "needs_research" || readiness === "needs_verification") return "secondary"
  return "outline"
}

function formatLabel(value: string | undefined): string {
  return value?.replace(/_/g, " ") ?? "unknown"
}

export function ProspectSearchSequenceRecommendationPanel({
  companyId,
  companyName,
  website,
  industry,
  companyMatchConfidence,
  isSuppressed,
  suppressionReason,
  intelligence,
}: {
  companyId: string
  companyName: string
  website?: string | null
  industry?: string | null
  companyMatchConfidence?: number | null
  isSuppressed?: boolean
  suppressionReason?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<SequenceRecommendationView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const panelEnabled = isSequenceRecommendationEnabledClient()

  const visibleEmails = useMemo(
    () =>
      intelligence.contacts
        .map((contact) => contact.email?.trim())
        .filter((email): email is string => Boolean(email)),
    [intelligence.contacts],
  )

  useEffect(() => {
    if (!panelEnabled || !open || loaded || !intelligence.has_contacts) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetch("/api/platform/growth/prospect-search/sequence-recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        company_name: companyName,
        website: website ?? undefined,
        industry: industry ?? undefined,
        company_match_confidence: companyMatchConfidence ?? undefined,
        is_suppressed: isSuppressed ?? undefined,
        suppression_reason: suppressionReason ?? undefined,
        intelligence: {
          qa_marker: intelligence.qa_marker,
          schema_ready: intelligence.schema_ready,
          has_contacts: intelligence.has_contacts,
          contacts: intelligence.contacts.map((contact) => ({
            id: contact.id,
            name: contact.name,
            title: contact.title,
            confidence: contact.confidence,
            source_evidence: contact.source_evidence,
            role_type: contact.role_type,
            recommended_priority: contact.recommended_priority,
            email: contact.email,
            phone: contact.phone,
            linkedin_url: contact.linkedin_url,
            verification_status: contact.verification_status,
          })),
          committee_roles: intelligence.committee_roles,
          committee_completeness_pct: intelligence.committee_completeness_pct,
          first_contact: intelligence.first_contact,
          confidence_explanation: intelligence.confidence_explanation,
          outreach_recommendation: intelligence.outreach_recommendation,
          source_labels: intelligence.source_labels,
          empty_reason: intelligence.empty_reason,
          company_contact_coverage: intelligence.company_contact_coverage,
        },
      }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as SequenceRecommendationApiResponse
        if (cancelled) return
        if (!payload.enabled) {
          setView(null)
          return
        }
        if (!payload.ok || !payload.view) {
          setError(payload.message ?? "Sequence recommendation unavailable")
          setView(null)
          return
        }
        setView(payload.view)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setError("Sequence recommendation unavailable")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    companyId,
    companyMatchConfidence,
    companyName,
    industry,
    intelligence,
    isSuppressed,
    loaded,
    open,
    panelEnabled,
    suppressionReason,
    visibleEmails,
    website,
  ])

  if (!panelEnabled) return null
  if (!intelligence.has_contacts) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40"
      data-qa-marker={GROWTH_SEQUENCE_RECOMMENDATION_PANEL_QA_MARKER}
      data-sequence-recommendation-panel="read-only"
      data-sequence-recommendation-collapsed-default="true"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          {open ? (
            <ChevronDown className="size-4 text-violet-800" />
          ) : (
            <ChevronRight className="size-4 text-violet-800" />
          )}
          <ListOrdered className="size-4 text-violet-800" />
          <h4 className="text-sm font-semibold text-violet-950">Sequence Recommendation</h4>
          <Badge variant="outline" className="text-[10px]">
            Read-only preview
          </Badge>
        </div>
        {view ? (
          <Badge variant={readinessBadgeVariant(view.enrollment_readiness)} className="text-[10px]">
            {formatLabel(view.enrollment_readiness)}
          </Badge>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-violet-100 px-4 pb-4">
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Building sequence recommendation…
          </p>
        ) : null}

        {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}

        {view ? (
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{view.recommended_sequence.name}</Badge>
              <Badge variant="outline">{formatLabel(view.recommended_sequence.type)}</Badge>
              <Badge variant="outline">Confidence {view.confidence}%</Badge>
              <Badge variant={readinessBadgeVariant(view.enrollment_readiness)}>
                {formatLabel(view.enrollment_readiness)}
              </Badge>
            </div>

            <p className="text-muted-foreground">
              Preferred channel: {formatLabel(view.preferred_channel)} · Next action:{" "}
              {formatLabel(view.next_action)}
            </p>

            <div className="rounded-md border border-violet-200 bg-white px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cadence</p>
              <p className="font-semibold">
                {formatLabel(view.cadence.intensity)} · {view.cadence.suggested_touch_count} touches ·{" "}
                {view.cadence.suggested_duration_days} days
              </p>
            </div>

            <div className="rounded-md border border-violet-200 bg-white px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Personalization inputs
              </p>
              <p className="mt-1 font-medium">{view.personalization_inputs.primary_reason}</p>
              {view.personalization_inputs.company_context ? (
                <p className="mt-0.5 text-muted-foreground">
                  Company: {view.personalization_inputs.company_context}
                </p>
              ) : null}
              {view.personalization_inputs.contact_context ? (
                <p className="mt-0.5 text-muted-foreground">
                  Contact: {view.personalization_inputs.contact_context}
                </p>
              ) : null}
              {view.personalization_inputs.buying_committee_context ? (
                <p className="mt-0.5 text-muted-foreground">
                  Committee: {view.personalization_inputs.buying_committee_context}
                </p>
              ) : null}
              {view.personalization_inputs.risk_context ? (
                <p className="mt-0.5 text-amber-900">Risk: {view.personalization_inputs.risk_context}</p>
              ) : null}
            </div>

            {view.reasons.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Reasons
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {view.reasons.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.risks.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Risks
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-900">
                  {view.risks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.blockers.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Blockers
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-900">
                  {view.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : !loading && !error ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Expand to load the deterministic sequence recommendation preview.
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
