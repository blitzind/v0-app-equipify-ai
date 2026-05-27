"use client"

import { Target, UserRound, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import { ProspectSearchSchemaHealthNotice } from "@/components/growth/prospect-search/prospect-search-schema-health-notice"

export function CompanyContactIntelligencePanel({
  companyName,
  intelligence,
}: {
  companyName: string
  intelligence: GrowthProspectSearchContactIntelligence | null | undefined
}) {
  if (!intelligence) return null

  const firstContact = intelligence.first_contact
  const confidenceExplanation = intelligence.confidence_explanation

  return (
    <section className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="size-4 text-violet-700" />
        <h4 className="text-sm font-semibold text-violet-950">Decision makers — {companyName}</h4>
        {intelligence.committee_completeness_pct != null ? (
          <Badge variant="outline" className="text-[10px]">
            Committee {intelligence.committee_completeness_pct}% complete
          </Badge>
        ) : null}
      </div>

      <ProspectSearchSchemaHealthNotice health={intelligence.schema_health} />

      {firstContact ? (
        <div className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs">
          <div className="flex items-center gap-2 font-medium text-violet-900">
            <Target className="size-3.5" />
            Recommended first contact
          </div>
          <p className="mt-1 font-semibold">
            {firstContact.role}
            {firstContact.name ? ` — ${firstContact.name}` : ""}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Confidence {Math.round(firstContact.confidence * 100)}% · {firstContact.reasons.join(" · ")}
          </p>
        </div>
      ) : intelligence.outreach_recommendation ? (
        <p className="mt-2 text-xs text-violet-900">{intelligence.outreach_recommendation}</p>
      ) : null}

      {intelligence.committee_roles.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Buying committee mapping
          </p>
          <ul className="space-y-1.5">
            {intelligence.committee_roles.slice(0, 6).map((role) => (
              <li
                key={`${role.recommended_order}-${role.role}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
              >
                <span>
                  {role.recommended_order}. {role.role}
                  {role.contact_name ? ` (${role.contact_name})` : ""}
                </span>
                <span className="text-muted-foreground">
                  {role.role_type} · {Math.round(role.confidence * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intelligence.has_contacts ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Evidence-backed contacts
          </p>
          <ul className="space-y-2">
            {intelligence.contacts.slice(0, 6).map((contact) => (
              <li key={contact.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                <div className="flex items-start gap-2">
                  <UserRound className="mt-0.5 size-3.5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-muted-foreground">
                      {contact.title ?? contact.role_type} · {Math.round(contact.confidence * 100)}% · priority{" "}
                      {contact.recommended_priority}
                    </p>
                    {contact.email || contact.phone || contact.linkedin_url ? (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {[contact.email, contact.phone, contact.linkedin_url].filter(Boolean).join(" · ")}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        No contact channels — evidence-backed identity only
                      </p>
                    )}
                    {contact.source_evidence[0] ? (
                      <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
                        Evidence: {contact.source_evidence[0].evidence}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {intelligence.empty_reason ?? "No evidence-backed contacts available."}
        </p>
      )}

      {confidenceExplanation ? (
        <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">
            Contact confidence {Math.round(confidenceExplanation.confidence * 100)}%
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
            {confidenceExplanation.evidence.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {intelligence.source_labels.length > 0 ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Sources: {intelligence.source_labels.join(", ")}
        </p>
      ) : null}
    </section>
  )
}
