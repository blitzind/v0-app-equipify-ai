"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Radar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GrowthCompanySignalSnapshot } from "@/lib/growth/company-signals/company-signal-types"
import { ProspectSearchSchemaHealthNotice } from "@/components/growth/prospect-search/prospect-search-schema-health-notice"

function MaturityRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

export function CompanyIntelligenceCard({
  companyCandidateId,
  companyName,
  compact = false,
  suppressSchemaNotice = false,
}: {
  companyCandidateId: string | null
  companyName?: string
  compact?: boolean
  suppressSchemaNotice?: boolean
}) {
  const [snapshot, setSnapshot] = useState<GrowthCompanySignalSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (run = false) => {
      if (!companyCandidateId) return
      setLoading(true)
      try {
        const params = new URLSearchParams({ company_candidate_id: companyCandidateId })
        if (run) params.set("run", "1")
        const res = await fetch(`/api/platform/growth/company-signals?${params}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as { ok?: boolean; snapshot?: GrowthCompanySignalSnapshot }
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

  const ui = snapshot?.ui_summary

  if (!companyCandidateId) return null

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
      data-qa-marker="growth-company-signal-intelligence-v1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radar className="size-4 text-violet-600" />
          <h3 className="text-sm font-semibold">
            {compact ? "Signals" : "Company intelligence"}
            {companyName ? (
              <span className="ml-1 font-normal text-muted-foreground">· {companyName}</span>
            ) : null}
          </h3>
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(true)}>
          {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {!suppressSchemaNotice ? <ProspectSearchSchemaHealthNotice health={snapshot?.schema_health} /> : null}

      {snapshot?.schema_ready && ui ? (
        <div className="mt-4 space-y-4">
          <dl className={compact ? "grid gap-3 text-sm sm:grid-cols-2" : "grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"}>
            <MaturityRow label="Operational maturity" value={ui.operational_maturity} />
            <MaturityRow label="Digital maturity" value={ui.digital_maturity} />
            <MaturityRow label="Field service maturity" value={ui.field_service_maturity} />
          </dl>

          {ui.technology_signals.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Technology signals</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {ui.technology_signals.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {ui.growth_indicators.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Growth indicators</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {ui.growth_indicators.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {ui.fit_indicators.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Fit indicators</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {ui.fit_indicators.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {snapshot.signals.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No evidence-backed signals yet — run refresh after discovery/enrichment data is present.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
