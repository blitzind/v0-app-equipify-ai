"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GrowthVerificationEnrichmentSnapshot } from "@/lib/growth/enrichment/enrichment-types"

export function VerificationEnrichmentCard({
  contactCandidateId,
  companyCandidateId,
}: {
  contactCandidateId?: string | null
  companyCandidateId?: string | null
}) {
  const [snapshot, setSnapshot] = useState<GrowthVerificationEnrichmentSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (run = false) => {
      if (!contactCandidateId && !companyCandidateId) return
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (contactCandidateId) params.set("contact_candidate_id", contactCandidateId)
        if (companyCandidateId) params.set("company_candidate_id", companyCandidateId)
        if (run) params.set("run", "1")
        const res = await fetch(`/api/platform/growth/enrichment?${params}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as {
          ok?: boolean
          snapshot?: GrowthVerificationEnrichmentSnapshot
        }
        if (res.ok && json.ok && json.snapshot) setSnapshot(json.snapshot)
      } finally {
        setLoading(false)
      }
    },
    [contactCandidateId, companyCandidateId],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const ui = snapshot?.ui_summary

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">Verification & enrichment</h3>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(true)}>
          {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {!snapshot?.schema_ready ? (
        <p className="mt-2 text-xs text-amber-800">
          Apply migration 20270324120000_growth_engine_verification_enrichment.sql.
        </p>
      ) : ui ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Email verified</dt>
            <dd className="font-medium">{ui.email_verified_label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone verified</dt>
            <dd className="font-medium">{ui.phone_verified_label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">LinkedIn verified</dt>
            <dd className="font-medium">{ui.linkedin_verified_label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Company confidence</dt>
            <dd className="font-medium">{ui.company_confidence_label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Industry confidence</dt>
            <dd className="font-medium">{ui.industry_confidence_label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Enrichment confidence</dt>
            <dd className="font-medium">{ui.enrichment_confidence_label}</dd>
          </div>
          {ui.technology_signals.length > 0 ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Technology signals</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {ui.technology_signals.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No enrichment data yet.</p>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">{snapshot?.privacy_note}</p>
    </section>
  )
}
