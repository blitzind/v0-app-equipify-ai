"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  GROWTH_NEXT_BEST_ACTION_PANEL_QA_MARKER,
  isNextBestActionEnabledClient,
} from "@/lib/growth/contact-verification/next-best-action-feature"
import type {
  NextBestActionApiResponse,
  NextBestActionView,
} from "@/lib/growth/contact-verification/next-best-action-view"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

function priorityBadgeVariant(
  priority: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (priority === "critical") return "destructive"
  if (priority === "high") return "default"
  if (priority === "medium") return "secondary"
  return "outline"
}

function readinessBadgeVariant(
  readiness: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (readiness === "ready") return "default"
  if (readiness === "blocked") return "destructive"
  if (readiness === "waiting") return "secondary"
  return "outline"
}

function formatLabel(value: string | undefined): string {
  return value?.replace(/_/g, " ") ?? "unknown"
}

export function ProspectSearchNextBestActionPanel({
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
  const [view, setView] = useState<NextBestActionView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const panelEnabled = isNextBestActionEnabledClient()

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

    void fetch("/api/platform/growth/prospect-search/next-best-action", {
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
        const payload = (await response.json()) as NextBestActionApiResponse
        if (cancelled) return
        if (!payload.enabled) {
          setView(null)
          return
        }
        if (!payload.ok || !payload.view) {
          setError(payload.message ?? "Next best action unavailable")
          setView(null)
          return
        }
        setView(payload.view)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setError("Next best action unavailable")
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
      className="mt-3 rounded-xl border border-amber-100 bg-amber-50/40"
      data-qa-marker={GROWTH_NEXT_BEST_ACTION_PANEL_QA_MARKER}
      data-next-best-action-panel="read-only"
      data-next-best-action-collapsed-default="true"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          {open ? (
            <ChevronDown className="size-4 text-amber-800" />
          ) : (
            <ChevronRight className="size-4 text-amber-800" />
          )}
          <Zap className="size-4 text-amber-800" />
          <h4 className="text-sm font-semibold text-amber-950">Next Best Action</h4>
          <Badge variant="outline" className="text-[10px]">
            Read-only preview
          </Badge>
        </div>
        {view ? (
          <Badge variant={priorityBadgeVariant(view.priority)} className="text-[10px]">
            {formatLabel(view.action)}
          </Badge>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-amber-100 px-4 pb-4">
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Computing next best action…
          </p>
        ) : null}

        {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}

        {view ? (
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={priorityBadgeVariant(view.priority)}>
                {formatLabel(view.priority)} priority
              </Badge>
              <Badge variant={readinessBadgeVariant(view.execution_readiness)}>
                {formatLabel(view.execution_readiness)}
              </Badge>
              <Badge variant="outline">Confidence {view.confidence}%</Badge>
            </div>

            <p className="font-semibold text-amber-950">{formatLabel(view.action)}</p>

            {view.recommended_sequence ? (
              <p className="text-muted-foreground">
                Recommended sequence: {view.recommended_sequence.name}
              </p>
            ) : null}

            <p className="text-muted-foreground">
              Channel: {formatLabel(view.recommended_channel)} · Delay: {view.recommended_delay_label}
            </p>

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

            {view.dependencies.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Dependencies
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {view.dependencies.map((item) => (
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

            {view.warnings.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Warnings
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-900">
                  {view.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : !loading && !error ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Expand to load the deterministic next best action preview.
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
