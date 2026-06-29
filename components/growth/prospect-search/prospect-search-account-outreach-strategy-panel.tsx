"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Compass,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER,
  isAccountOutreachStrategyPanelEnabledClient,
} from "@/lib/growth/contact-verification/account-outreach-strategy-panel-feature"
import type {
  AccountOutreachStrategyPanelApiResponse,
  AccountOutreachStrategyPanelView,
} from "@/lib/growth/contact-verification/account-outreach-strategy-panel-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

function readinessBadgeVariant(
  tier: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (tier === "ready") return "default"
  if (tier === "insufficient") return "destructive"
  if (tier === "needs_review") return "secondary"
  return "outline"
}

function channelIcon(channel: string) {
  if (channel === "email") return <Mail className="size-3" />
  if (channel === "phone") return <Phone className="size-3" />
  return null
}

function formatRole(role: string | undefined): string {
  return role?.replace(/_/g, " ") ?? "unknown"
}

export function ProspectSearchAccountOutreachStrategyPanel({
  companyName,
  website,
  intelligence,
  compact = false,
}: {
  companyName: string
  website?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
  compact?: boolean
}) {
  const [view, setView] = useState<AccountOutreachStrategyPanelView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const panelEnabled = isAccountOutreachStrategyPanelEnabledClient()

  const visibleEmails = useMemo(
    () =>
      intelligence.contacts
        .map((contact) => contact.email?.trim())
        .filter((email): email is string => Boolean(email)),
    [intelligence.contacts],
  )

  useEffect(() => {
    if (!panelEnabled || !intelligence.has_contacts) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetch("/api/platform/growth/prospect-search/account-outreach-strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        const payload = (await response.json()) as AccountOutreachStrategyPanelApiResponse
        if (cancelled) return
        if (!payload.enabled) {
          setView(null)
          return
        }
        if (!payload.ok || !payload.view) {
          setError(payload.message ?? "Strategy preview unavailable")
          setView(null)
          return
        }
        setView(payload.view)
      })
      .catch(() => {
        if (!cancelled) setError("Strategy preview unavailable")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyName, intelligence, panelEnabled, visibleEmails, website])

  if (!panelEnabled) return null
  if (!intelligence.has_contacts) return null

  return (
    <section
      className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"
      data-qa-marker={GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER}
      data-account-outreach-strategy-panel="read-only"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Compass className="size-4 text-indigo-800" />
        <h4 className="text-sm font-semibold text-indigo-950">
          Account Outreach Strategy — {companyName}
        </h4>
        <Badge variant="outline" className="text-[10px]">
          Read-only preview
        </Badge>
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Building deterministic outreach strategy…
        </p>
      ) : null}

      {error ? <p className="mt-3 text-xs text-muted-foreground">{error}</p> : null}

      {view ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={readinessBadgeVariant(view.readiness.tier)}>
              Readiness {view.readiness.tier.replace(/_/g, " ")} · {view.readiness.score}
            </Badge>
            <Badge variant="outline" className="gap-1">
              {channelIcon(view.primary?.recommended_channel ?? "unknown")}
              {formatRole(view.primary?.recommended_channel)}
            </Badge>
            <Badge variant="outline">
              Committee coverage {view.committee.coverage_score}% · {view.committee.coverage_tier}
            </Badge>
          </div>

          <p className="mt-2 text-sm font-medium text-indigo-950">{view.summary.recommended_strategy}</p>

          {view.primary ? (
            <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-indigo-900">
                <ShieldCheck className="size-3.5" />
                Primary recommended contact
              </div>
              <p className="mt-1 font-semibold">
                {view.primary.display_name} · {formatRole(view.primary.committee_role)}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Score {Math.round(view.primary.score * 100)}% · confidence {view.primary.confidence}% ·{" "}
                channel {formatRole(view.primary.recommended_channel)}
              </p>
              {view.primary.recommended_email_present ? (
                <p className="mt-0.5 text-muted-foreground">
                  Recommended email: {view.primary.recommended_email ?? "***@***"}
                </p>
              ) : null}
              {view.primary.reasons.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {view.primary.reasons.slice(0, compact ? 3 : 5).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {!compact && view.backups.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Backup contacts
              </p>
              <ul className="mt-1.5 space-y-1">
                {view.backups.map((backup) => (
                  <li
                    key={`${backup.display_name}-${backup.committee_role ?? "unknown"}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span>
                      {backup.display_name} · {formatRole(backup.committee_role)} ·{" "}
                      {formatRole(backup.recommended_channel)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {view.committee.missing_roles.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Missing committee roles:{" "}
              {view.committee.missing_roles.map((role) => formatRole(role)).join(", ")}
            </p>
          ) : null}

          {!compact && view.staged_plan.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Staged outreach plan
              </p>
              <ol className="mt-1.5 space-y-1.5">
                {view.staged_plan.map((step) => (
                  <li
                    key={`${step.step}-${step.action}`}
                    className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium">
                      Step {step.step}: {step.action.replace(/_/g, " ")}
                    </span>
                    {step.contact_name ? <span> — {step.contact_name}</span> : null}
                    <p className="mt-0.5 text-muted-foreground">{step.rationale}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {view.warnings.length > 0 ? (
            <ul className="mt-3 space-y-0.5 text-xs text-amber-900">
              {view.warnings.slice(0, compact ? 3 : 6).map((warning) => (
                <li key={warning} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled>
              Enroll primary contact (preview only)
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled>
              Send outreach (preview only)
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
