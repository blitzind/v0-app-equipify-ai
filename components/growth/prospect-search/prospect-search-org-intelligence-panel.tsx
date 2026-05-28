"use client"

import { Network } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ProspectSearchOrgIntelligence } from "@/lib/growth/prospect-search/prospect-search-org-intelligence"
import type { ProspectSearchAccountOutreachSequence } from "@/lib/growth/prospect-search/prospect-search-contact-influence"
import { GROWTH_ORG_INTELLIGENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-org-intelligence"
import { GROWTH_CONTACT_INFLUENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-influence"

export function ProspectSearchOrgIntelligencePanel({
  orgIntelligence,
  outreachSequence,
}: {
  orgIntelligence: ProspectSearchOrgIntelligence | null | undefined
  outreachSequence?: ProspectSearchAccountOutreachSequence | null
}) {
  if (!orgIntelligence) return null

  return (
    <section
      className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"
      data-org-intelligence-marker={GROWTH_ORG_INTELLIGENCE_QA_MARKER}
      data-contact-influence-marker={GROWTH_CONTACT_INFLUENCE_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Network className="size-4 text-indigo-800" />
        <h4 className="text-sm font-semibold text-indigo-950">Org intelligence</h4>
        <Badge variant="outline">
          Structure confidence {Math.round(orgIntelligence.operational_structure_confidence * 100)}%
        </Badge>
      </div>

      <p className="mt-2 text-xs font-medium text-indigo-950">{orgIntelligence.structure_summary}</p>
      {orgIntelligence.likely_communication_flow ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Communication flow: {orgIntelligence.likely_communication_flow}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1">
        {orgIntelligence.leadership_coverage ? <Badge variant="secondary">Leadership</Badge> : null}
        {orgIntelligence.operations_coverage ? <Badge variant="secondary">Operations</Badge> : null}
        {orgIntelligence.service_coverage ? <Badge variant="secondary">Service</Badge> : null}
        {orgIntelligence.admin_coverage ? <Badge variant="secondary">Admin</Badge> : null}
        {orgIntelligence.branch_structure_detected ? <Badge variant="secondary">Branch structure</Badge> : null}
      </div>

      {orgIntelligence.grouped_contacts_by_persona.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {orgIntelligence.grouped_contacts_by_persona.slice(0, 5).map((group) => (
            <li key={group.persona_type}>
              {group.persona_label}: {group.contact_names.join(", ") || "—"}
            </li>
          ))}
        </ul>
      ) : null}

      {orgIntelligence.missing_department_warnings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
          {orgIntelligence.missing_department_warnings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {outreachSequence?.sequence_summary ? (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs">
          <p className="font-medium text-indigo-900">Outreach sequence</p>
          <p className="mt-1">{outreachSequence.sequence_summary}</p>
          {outreachSequence.likely_gatekeepers.length > 0 ? (
            <p className="mt-1 text-muted-foreground">
              Likely gatekeepers: {outreachSequence.likely_gatekeepers.join(", ")}
            </p>
          ) : null}
          {outreachSequence.steps.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-muted-foreground">
              {outreachSequence.steps
                .filter((step) => step.role !== "avoid")
                .slice(0, 4)
                .map((step) => (
                  <li key={step.contact_id}>
                    {step.role}: {step.full_name ?? step.persona_label} — {step.reasoning}
                  </li>
                ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-[10px] text-muted-foreground">
        {orgIntelligence.relationship_graph.edges.length} relationship edges ·{" "}
        {orgIntelligence.uncertainty_notes[0]}
      </p>
    </section>
  )
}
