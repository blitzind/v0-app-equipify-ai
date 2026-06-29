"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Target, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  GROWTH_CONTACT_ACQUISITION_PANEL_QA_MARKER,
  isContactAcquisitionEnabledClient,
} from "@/lib/growth/contact-verification/contact-acquisition-feature"
import type {
  AcquisitionCandidateApiResponse,
  AcquisitionCandidateView,
} from "@/lib/growth/contact-verification/contact-acquisition-view"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

function readinessBadgeVariant(
  readiness: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (readiness === "ready") return "default"
  if (readiness === "blocked") return "destructive"
  if (readiness === "research") return "secondary"
  return "outline"
}

function formatLabel(value: string | undefined): string {
  return value?.replace(/_/g, " ") ?? "unknown"
}

export function ProspectSearchAcquisitionCandidatePanel({
  companyId,
  companyName,
  website,
  intelligence,
}: {
  companyId: string
  companyName: string
  website?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<AcquisitionCandidateView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const panelEnabled = isContactAcquisitionEnabledClient()

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

    void fetch("/api/platform/growth/prospect-search/contact-acquisition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        company_name: companyName,
        website: website ?? undefined,
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
          })),
          committee_roles: intelligence.committee_roles,
          committee_completeness_pct: intelligence.committee_completeness_pct,
          first_contact: intelligence.first_contact,
          confidence_explanation: intelligence.confidence_explanation,
          outreach_recommendation: intelligence.outreach_recommendation,
          source_labels: intelligence.source_labels,
          empty_reason: intelligence.empty_reason,
        },
      }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as AcquisitionCandidateApiResponse
        if (cancelled) return
        if (!payload.enabled) {
          setView(null)
          return
        }
        if (!payload.ok || !payload.view) {
          setError(payload.message ?? "Acquisition candidate unavailable")
          setView(null)
          return
        }
        setView(payload.view)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setError("Acquisition candidate unavailable")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, companyName, intelligence, loaded, open, panelEnabled, visibleEmails, website])

  if (!panelEnabled) return null
  if (!intelligence.has_contacts) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/40"
      data-qa-marker={GROWTH_CONTACT_ACQUISITION_PANEL_QA_MARKER}
      data-contact-acquisition-panel="read-only"
      data-contact-acquisition-collapsed-default="true"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          {open ? (
            <ChevronDown className="size-4 text-emerald-800" />
          ) : (
            <ChevronRight className="size-4 text-emerald-800" />
          )}
          <Target className="size-4 text-emerald-800" />
          <h4 className="text-sm font-semibold text-emerald-950">Acquisition Candidate</h4>
          <Badge variant="outline" className="text-[10px]">
            Read-only preview
          </Badge>
        </div>
        {view ? (
          <Badge variant={readinessBadgeVariant(view.outreach.readiness)} className="text-[10px]">
            {formatLabel(view.outreach.readiness)}
          </Badge>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-emerald-100 px-4 pb-4">
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Building acquisition candidate…
          </p>
        ) : null}

        {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}

        {view ? (
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Confidence {view.overall_confidence}%</Badge>
              <Badge variant="outline">Channel {formatLabel(view.outreach.preferred_channel)}</Badge>
              <Badge variant={readinessBadgeVariant(view.outreach.readiness)}>
                Readiness {formatLabel(view.outreach.readiness)}
              </Badge>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2 font-medium text-emerald-900">
                <UserRound className="size-3.5" />
                Primary contact
              </div>
              <p className="mt-1 font-semibold">
                {view.primary_contact.full_name}
                {view.primary_contact.title ? ` · ${view.primary_contact.title}` : ""}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Role {formatLabel(view.committee.role)} · confidence {view.primary_contact.confidence}%
              </p>
              {view.primary_contact.email_present ? (
                <p className="mt-0.5 text-muted-foreground">
                  Verified email: {view.primary_contact.email ?? "***@***"} (
                  {formatLabel(view.verification.deliverability)})
                </p>
              ) : (
                <p className="mt-0.5 text-muted-foreground">No verified email on record</p>
              )}
            </div>

            {view.outreach.recommended_sequence ? (
              <p className="text-muted-foreground">
                Recommended sequence: {view.outreach.recommended_sequence}
              </p>
            ) : null}

            {view.backup_contacts.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Backup contacts
                </p>
                <ul className="mt-1.5 space-y-1">
                  {view.backup_contacts.map((backup) => (
                    <li
                      key={`${backup.name}-${backup.role}`}
                      className="rounded-md border border-border bg-card px-2.5 py-1.5"
                    >
                      {backup.name}
                      {backup.title ? ` · ${backup.title}` : ""} · {formatLabel(backup.role)} ·{" "}
                      {backup.confidence}%
                      {backup.email_present ? ` · ${backup.email ?? "***@***"}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.reasons.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Reasons
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {view.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
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
                  {view.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : !loading && !error ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Expand to load the deterministic acquisition candidate preview.
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
