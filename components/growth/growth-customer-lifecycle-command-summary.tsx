"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { HeartPulse, Loader2 } from "lucide-react"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthCustomerLifecycleCommandSummary } from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"

export function GrowthCustomerLifecycleCommandSummary() {
  const [summary, setSummary] = useState<GrowthCustomerLifecycleCommandSummary | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/customer-lifecycle/command-summary", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        summary?: GrowthCustomerLifecycleCommandSummary | null
      }
      if (res.ok && data.ok) {
        if (data.meta?.schemaReady === false) {
          setSetupMessage(data.meta.setupMessage ?? null)
          setSummary(null)
        } else {
          setSummary(data.summary ?? null)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <GrowthEngineCard title="Post-Close Revenue">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading lifecycle summary…
        </div>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Post-Close Revenue">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HeartPulse className="size-4" />
          Close won → onboarding → retention → expansion. Human-owned only.
        </div>
        <Link href="/admin/growth/customer-lifecycle" className="text-sm text-indigo-600 hover:underline">
          Open lifecycle
        </Link>
      </div>
      {setupMessage ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Renewals due" value={summary?.renewalsDueCount ?? 0} />
        <StatTile label="Expansion candidates" value={summary?.expansionCandidatesCount ?? 0} />
        <StatTile label="Churn risks" value={summary?.churnRisksCount ?? 0} />
        <StatTile label="Review opportunities" value={summary?.reviewOpportunitiesCount ?? 0} />
        <StatTile label="Referral opportunities" value={summary?.referralOpportunitiesCount ?? 0} />
      </div>
    </GrowthEngineCard>
  )
}
