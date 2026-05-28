"use client"

import { ExternalLink, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER,
  GROWTH_PEOPLE_WORKFLOWS_QA_MARKER,
  type GrowthProspectSearchPeopleResultRow,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

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

        <div className="mt-4 space-y-4 text-xs">
          <section>
            <h4 className="font-medium text-foreground">Outreach eligibility</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">Email: {row.email_eligibility.replace(/_/g, " ")}</Badge>
              <Badge variant="outline">Call: {row.call_eligibility.replace(/_/g, " ")}</Badge>
              <Badge variant="outline">SMS: {row.sms_eligibility.replace(/_/g, " ")}</Badge>
            </div>
            {row.call_block_reason ? (
              <p className="mt-2 text-muted-foreground">Call block: {row.call_block_reason}</p>
            ) : null}
            {row.sms_block_reason ? (
              <p className="mt-1 text-muted-foreground">SMS block: {row.sms_block_reason}</p>
            ) : null}
            {row.phone_on_dnc === true ? (
              <p className="mt-1 text-red-700">Matched voice DNC registry</p>
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

          <section>
            <h4 className="font-medium text-foreground">Confidence reasoning</h4>
            <p className="mt-2 text-muted-foreground">
              Confidence {Math.round(row.confidence * 100)}% · verification{" "}
              {row.verification_status.replace(/_/g, " ")}
            </p>
            {row.company.contact_intelligence?.confidence_explanation?.reasoning.map((line) => (
              <p key={line} className="mt-1 text-muted-foreground">
                {line}
              </p>
            ))}
          </section>

          {onRerunDiscovery ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onRerunDiscovery(row)}>
              Re-run discovery for company
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
