"use client"

import { ExternalLink, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER,
  GROWTH_CONTACT_FRESHNESS_QA_MARKER,
  GROWTH_CONTACT_RANKING_QA_MARKER,
  GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER,
  GROWTH_REVENUE_PERSONA_INTELLIGENCE_QA_MARKER,
  GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER,
  GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER,
  GROWTH_PEOPLE_WORKFLOWS_QA_MARKER,
  type GrowthProspectSearchPeopleResultRow,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { ProspectSearchAccountStrategyPanel } from "@/components/growth/prospect-search/prospect-search-account-strategy-panel"
import { formatProspectSearchFreshnessLabel } from "@/lib/growth/prospect-search/prospect-search-contact-freshness"

function eligibilityBadgeVariant(state: string): "default" | "outline" | "destructive" | "secondary" {
  if (state === "eligible") return "default"
  if (state === "suppressed" || state === "blocked") return "destructive"
  if (state === "unsupported") return "secondary"
  return "outline"
}

export function ProspectSearchContactEvidenceDrawer({
  row,
  open,
  onClose,
  onRerunDiscovery,
}: {
  row: GrowthProspectSearchPeopleResultRow | null
  open: boolean
  onClose: () => void
  onRerunDiscovery?: (row: GrowthProspectSearchPeopleResultRow) => void
}) {
  if (!open || !row) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      data-qa-marker={GROWTH_PEOPLE_WORKFLOWS_QA_MARKER}
      data-contact-eligibility-marker={GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER}
      data-contact-freshness-marker={GROWTH_CONTACT_FRESHNESS_QA_MARKER}
      data-contact-ranking-marker={GROWTH_CONTACT_RANKING_QA_MARKER}
      data-revenue-persona-marker={GROWTH_REVENUE_PERSONA_INTELLIGENCE_QA_MARKER}
      data-account-strategy-marker={GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER}
      data-multi-contact-orchestration-marker={GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER}
      data-contact-verification-depth-marker={GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER}
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{row.full_name}</h3>
            <p className="text-sm text-muted-foreground">
              {row.title ?? row.role ?? "—"} · {row.company_name}
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {row.stale_warning ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {row.stale_warning}
          </p>
        ) : null}

        <div className="mt-4 space-y-4 text-xs">
          <section>
            <h4 className="font-medium text-foreground">Outreach ranking</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{row.priority_tier.replace(/_/g, " ")}</Badge>
              <Badge variant="outline">{row.persona_label}</Badge>
              {row.is_recommended_contact ? <Badge>Recommended</Badge> : null}
            </div>
            <p className="mt-2 text-muted-foreground">{row.recommended_next_action}</p>
            {row.ranking_reasons.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
                {row.ranking_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            {row.ranking_risks.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-amber-900">
                {row.ranking_risks.map((risk) => (
                  <li key={risk}>Risk: {risk}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <h4 className="font-medium text-foreground">Persona intelligence</h4>
            <p className="mt-2 text-muted-foreground">
              {row.persona_label} · ICP relevance {Math.round(row.persona_icp_relevance * 100)}% · buying
              influence {Math.round(row.persona_buying_influence * 100)}%
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {row.persona_evidence.slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {row.company.contact_intelligence?.account_contact_strategy ? (
            <section>
              <h4 className="font-medium text-foreground">Account outreach strategy</h4>
              <div className="mt-2">
                <ProspectSearchAccountStrategyPanel
                  strategy={row.company.contact_intelligence.account_contact_strategy}
                  compact
                />
              </div>
              {row.is_recommended_contact ? (
                <p className="mt-2 text-muted-foreground">
                  This contact is the recommended primary for {row.company_name}.
                </p>
              ) : row.is_secondary_contact ? (
                <p className="mt-2 text-muted-foreground">
                  This contact is a backup outreach target for {row.company_name}.
                </p>
              ) : null}
            </section>
          ) : null}

          <section>
            <h4 className="font-medium text-foreground">Freshness</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">
                {formatProspectSearchFreshnessLabel(row.freshness_status)}
              </Badge>
              {row.last_checked_at ? (
                <Badge variant="secondary">
                  Checked {new Date(row.last_checked_at).toLocaleDateString()}
                </Badge>
              ) : null}
            </div>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {row.discovered_at ? <li>Discovered {new Date(row.discovered_at).toLocaleString()}</li> : null}
              {row.last_verified_at ? (
                <li>Last verified {new Date(row.last_verified_at).toLocaleString()}</li>
              ) : null}
              {row.verification_expires_at ? (
                <li>Verification expires {new Date(row.verification_expires_at).toLocaleDateString()}</li>
              ) : null}
            </ul>
          </section>

          <section>
            <h4 className="font-medium text-foreground">Verification depth</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">
                Email: {(row.email_verification_depth ?? "unknown").replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline">
                Phone: {(row.phone_verification_depth ?? "unknown").replace(/_/g, " ")}
              </Badge>
            </div>
          </section>

          <section>
            <h4 className="font-medium text-foreground">Outreach eligibility</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={eligibilityBadgeVariant(row.email_eligibility)}>
                Email: {row.email_eligibility.replace(/_/g, " ")}
              </Badge>
              <Badge variant={eligibilityBadgeVariant(row.call_eligibility)}>
                Call: {row.call_eligibility.replace(/_/g, " ")}
              </Badge>
              <Badge variant={eligibilityBadgeVariant(row.sms_eligibility)}>
                SMS: {row.sms_eligibility.replace(/_/g, " ")}
              </Badge>
            </div>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Email: {row.email ?? row.email_reason ?? "Not on file"}</li>
              <li>Phone: {row.phone ?? row.phone_reason ?? "Not on file"}</li>
              {row.call_block_reason ? <li>Call block: {row.call_block_reason}</li> : null}
              {row.sms_block_reason ? <li>SMS block: {row.sms_block_reason}</li> : null}
              {row.phone_on_dnc === true ? <li className="text-red-700">Matched voice DNC registry</li> : null}
            </ul>
          </section>

          <section>
            <h4 className="font-medium text-foreground">Confidence reasoning</h4>
            <p className="mt-2 font-medium capitalize">{row.confidence_label} confidence</p>
            <p className="mt-1 text-muted-foreground">{row.confidence_reason}</p>
            {row.confidence_top_reasons.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                {row.confidence_top_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            {row.confidence_risk_notes.length > 0 ? (
              <ul className="mt-2 space-y-1 text-amber-900">
                {row.confidence_risk_notes.map((note) => (
                  <li key={note}>Risk: {note}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <h4 className="font-medium text-foreground">Evidence</h4>
            <ul className="mt-2 space-y-2">
              {(row.company.contact_intelligence?.contacts.find((c) => c.id === row.contact_id)
                ?.source_evidence ?? []
              ).map((item, index) => (
                <li key={`${item.claim}-${index}`} className="rounded-md border border-border p-2">
                  <p className="font-medium">{item.claim}</p>
                  <p className="mt-1 text-muted-foreground">{item.evidence}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.source}
                  </p>
                </li>
              ))}
              {row.source_label ? (
                <li className="rounded-md border border-border p-2">
                  <p className="font-medium">Discovery source</p>
                  <p className="mt-1 text-muted-foreground">{row.source_label}</p>
                </li>
              ) : null}
            </ul>
            {row.source_page_url ? (
              <Button type="button" size="sm" variant="link" className="mt-2 px-0" asChild>
                <a href={row.source_page_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 size-3" />
                  Open source page
                </a>
              </Button>
            ) : null}
          </section>

          <section>
            <h4 className="font-medium text-foreground">Timeline</h4>
            <ul className="mt-2 space-y-2">
              {row.timeline_events.map((event) => (
                <li key={event.id} className="rounded-md bg-muted/40 p-2">
                  <p className="font-medium">{event.label}</p>
                  <p className="text-muted-foreground">{event.detail}</p>
                  {event.occurred_at ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(event.occurred_at).toLocaleString()}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {onRerunDiscovery ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onRerunDiscovery(row)}>
              Refresh company contacts
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
