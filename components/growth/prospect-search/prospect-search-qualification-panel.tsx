"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, ClipboardCheck, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  GROWTH_PROSPECT_QUALIFICATION_PANEL_QA_MARKER,
  isProspectQualificationEnabledClient,
} from "@/lib/growth/contact-verification/prospect-qualification-feature"
import type {
  ProspectQualificationApiResponse,
  ProspectQualificationView,
} from "@/lib/growth/contact-verification/prospect-qualification-view"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

function qualificationBadgeVariant(
  qualification: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (qualification === "qualified") return "default"
  if (qualification === "disqualified" || qualification === "blocked") return "destructive"
  if (qualification === "research") return "secondary"
  return "outline"
}

function formatLabel(value: string | undefined): string {
  return value?.replace(/_/g, " ") ?? "unknown"
}

export function ProspectSearchQualificationPanel({
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
  const [view, setView] = useState<ProspectQualificationView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const panelEnabled = isProspectQualificationEnabledClient()

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

    void fetch("/api/platform/growth/prospect-search/prospect-qualification", {
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
        visible_emails: visibleEmails,
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
        const payload = (await response.json()) as ProspectQualificationApiResponse
        if (cancelled) return
        if (!payload.enabled) {
          setView(null)
          return
        }
        if (!payload.ok || !payload.view) {
          setError(payload.message ?? "Prospect qualification unavailable")
          setView(null)
          return
        }
        setView(payload.view)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setError("Prospect qualification unavailable")
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
      className="mt-3 rounded-xl border border-sky-100 bg-sky-50/40"
      data-qa-marker={GROWTH_PROSPECT_QUALIFICATION_PANEL_QA_MARKER}
      data-prospect-qualification-panel="read-only"
      data-prospect-qualification-collapsed-default="true"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          {open ? (
            <ChevronDown className="size-4 text-sky-800" />
          ) : (
            <ChevronRight className="size-4 text-sky-800" />
          )}
          <ClipboardCheck className="size-4 text-sky-800" />
          <h4 className="text-sm font-semibold text-sky-950">Prospect Qualification</h4>
          <Badge variant="outline" className="text-[10px]">
            Read-only preview
          </Badge>
        </div>
        {view ? (
          <Badge variant={qualificationBadgeVariant(view.qualification)} className="text-[10px]">
            {formatLabel(view.qualification)}
          </Badge>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-sky-100 px-4 pb-4">
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Building prospect qualification…
          </p>
        ) : null}

        {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}

        {view ? (
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={qualificationBadgeVariant(view.qualification)}>
                {formatLabel(view.qualification)}
              </Badge>
              <Badge variant="outline">Overall {view.overall_score}%</Badge>
              <Badge variant="outline">Confidence {view.confidence}%</Badge>
              <Badge variant="outline">Next: {formatLabel(view.next_action)}</Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-sky-200 bg-white px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fit</p>
                <p className="font-semibold">{view.fit_score}%</p>
              </div>
              <div className="rounded-md border border-sky-200 bg-white px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contact</p>
                <p className="font-semibold">{view.contact_score}%</p>
              </div>
              <div className="rounded-md border border-sky-200 bg-white px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Engagement</p>
                <p className="font-semibold">{view.engagement_score}%</p>
              </div>
              <div className="rounded-md border border-sky-200 bg-white px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Committee</p>
                <p className="font-semibold">{view.buying_committee_coverage}%</p>
              </div>
            </div>

            <p className="text-muted-foreground">
              Primary: {view.primary_contact_name} · {formatLabel(view.primary_contact_role)}
            </p>

            {view.strengths.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Strengths
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {view.strengths.map((item) => (
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

            {view.recommendations.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Recommendations
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {view.recommendations.map((item) => (
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
            Expand to load the deterministic prospect qualification preview.
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
