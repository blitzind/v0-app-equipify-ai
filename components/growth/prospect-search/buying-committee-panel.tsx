"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VerificationEnrichmentCard } from "@/components/growth/lead-operator/verification-enrichment-card"
import type { GrowthContactDiscoverySnapshot } from "@/lib/growth/contact-discovery/contact-discovery-types"

export function BuyingCommitteePanel({
  companyCandidateId,
  companyName,
}: {
  companyCandidateId: string
  companyName: string
}) {
  const [snapshot, setSnapshot] = useState<GrowthContactDiscoverySnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (run = false) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ company_candidate_id: companyCandidateId })
        if (run) params.set("run", "1")
        const res = await fetch(`/api/platform/growth/contact-discovery?${params}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as { ok?: boolean; snapshot?: GrowthContactDiscoverySnapshot }
        if (res.ok && json.ok && json.snapshot) setSnapshot(json.snapshot)
      } finally {
        setLoading(false)
      }
    },
    [companyCandidateId],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const committee = snapshot?.buying_committee

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-violet-600" />
          <h4 className="text-sm font-semibold">Buying committee — {companyName}</h4>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(true)}>
          {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
          Discover contacts
        </Button>
      </div>

      {!snapshot?.schema_ready ? (
        <p className="mt-2 text-xs text-amber-800">
          Contact discovery schema not applied — run migration 20270323120000_growth_engine_contact_discovery.sql.
        </p>
      ) : null}

      {committee ? (
        <div className="mt-3 space-y-3 text-xs">
          <div className="flex flex-wrap gap-1">
            {committee.committee.economic_buyer_found ? (
              <Badge variant="outline">Economic buyer</Badge>
            ) : null}
            {committee.committee.decision_maker_found ? (
              <Badge variant="outline">Decision maker</Badge>
            ) : null}
            {committee.committee.technical_buyer_found ? (
              <Badge variant="outline">Technical buyer</Badge>
            ) : null}
            {committee.committee.champion_found ? (
              <Badge variant="outline">Champion</Badge>
            ) : null}
            {committee.single_thread_risk ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                Single-thread risk
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            Coverage {Math.round(committee.committee.coverage_score * 100)}% · completeness{" "}
            {Math.round(committee.committee_completeness * 100)}% · confidence{" "}
            {Math.round(committee.committee_confidence * 100)}%
          </p>
          {committee.missing_roles.length > 0 ? (
            <p className="text-muted-foreground">
              Missing roles: {committee.missing_roles.map((r) => r.replace(/_/g, " ")).join(", ")}
            </p>
          ) : null}
          <ul className="space-y-2">
            {committee.contacts.slice(0, 6).map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="font-medium">{c.full_name}</p>
                <p className="text-muted-foreground">
                  {c.job_title ?? "—"} · {c.verification_state} · {Math.round(c.confidence * 100)}%
                </p>
                {!c.email && !c.phone && !c.linkedin_url ? (
                  <p className="text-[10px] text-muted-foreground">No PII — role hypothesis only</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No contact candidates yet. Run discover contacts to build a buying committee.
        </p>
      )}
      {committee?.contacts[0] ? (
        <VerificationEnrichmentCard
          contactCandidateId={committee.contacts[0].id}
          companyCandidateId={companyCandidateId}
        />
      ) : null}
    </section>
  )
}
