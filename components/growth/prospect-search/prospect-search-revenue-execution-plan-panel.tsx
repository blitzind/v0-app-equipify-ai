"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, ClipboardList, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER,
  isRevenueExecutionPlanEnabledClient,
} from "@/lib/growth/contact-verification/revenue-execution-plan-feature"
import type {
  RevenueExecutionPlanApiResponse,
  RevenueExecutionPlanView,
} from "@/lib/growth/contact-verification/revenue-execution-plan-view"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

function stateBadgeVariant(
  state: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (state === "ready") return "default"
  if (state === "blocked") return "destructive"
  if (state === "waiting") return "secondary"
  return "outline"
}

function modeBadgeVariant(
  mode: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (mode === "ready_for_execution") return "default"
  if (mode === "approval_required") return "secondary"
  if (mode === "human_review") return "outline"
  return "outline"
}

function formatLabel(value: string | undefined): string {
  return value?.replace(/_/g, " ") ?? "unknown"
}

export function ProspectSearchRevenueExecutionPlanPanel({
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
  const [view, setView] = useState<RevenueExecutionPlanView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const panelEnabled = isRevenueExecutionPlanEnabledClient()

  useEffect(() => {
    if (!panelEnabled || !open || loaded || !intelligence.has_contacts) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetch("/api/platform/growth/prospect-search/revenue-execution-plan", {
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
        const payload = (await response.json()) as RevenueExecutionPlanApiResponse
        if (cancelled) return
        if (!payload.enabled) {
          setView(null)
          return
        }
        if (!payload.ok || !payload.view) {
          setError(payload.message ?? "Revenue execution plan unavailable")
          setView(null)
          return
        }
        setView(payload.view)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setError("Revenue execution plan unavailable")
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
    website,
  ])

  if (!panelEnabled) return null
  if (!intelligence.has_contacts) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40"
      data-qa-marker={GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER}
      data-revenue-execution-plan-panel="read-only"
      data-revenue-execution-plan-collapsed-default="true"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <div className="flex flex-wrap items-center gap-2">
          {open ? (
            <ChevronDown className="size-4 text-violet-800" />
          ) : (
            <ChevronRight className="size-4 text-violet-800" />
          )}
          <ClipboardList className="size-4 text-violet-800" />
          <h4 className="text-sm font-semibold text-violet-950">Revenue Execution Plan</h4>
          <Badge variant="outline" className="text-[10px]">
            Read-only preview
          </Badge>
        </div>
        {view ? (
          <Badge variant={stateBadgeVariant(view.execution_state)} className="text-[10px]">
            {formatLabel(view.execution_state)}
          </Badge>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-violet-100 px-4 pb-4">
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Building execution plan…
          </p>
        ) : null}

        {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}

        {view ? (
          <div className="mt-3 space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={stateBadgeVariant(view.execution_state)}>
                {formatLabel(view.execution_state)}
              </Badge>
              <Badge variant={modeBadgeVariant(view.execution_mode)}>
                {formatLabel(view.execution_mode)}
              </Badge>
              <Badge variant="outline">Confidence {view.confidence}%</Badge>
            </div>

            <p className="font-semibold text-violet-950">
              Workflow: {formatLabel(view.recommended_workflow)}
            </p>

            <p className="text-muted-foreground">
              Estimated duration: {view.estimated_duration_label}
            </p>

            {view.execution_steps.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Execution steps
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted-foreground">
                  {view.execution_steps.map((step) => (
                    <li key={step.order}>
                      <span className="font-medium text-foreground">{step.label}</span>
                      {" — "}
                      {step.description}
                      {step.estimated_minutes > 0 ? ` (${step.estimated_minutes}m)` : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {view.prerequisites.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Prerequisites
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {view.prerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.approvals_required.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Required approvals
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {view.approvals_required.map((item) => (
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
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-violet-900">
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
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-violet-900">
                  {view.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : !loading && !error ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Expand to load the deterministic revenue execution plan preview.
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
