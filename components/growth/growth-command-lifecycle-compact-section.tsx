"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { HeartPulse, Loader2 } from "lucide-react"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthCustomerLifecycleCommandSummary } from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"

export function GrowthCommandLifecycleCompactSection() {
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

  const total =
    (summary?.renewalsDueCount ?? 0) +
    (summary?.expansionCandidatesCount ?? 0) +
    (summary?.churnRisksCount ?? 0) +
    (summary?.reviewOpportunitiesCount ?? 0) +
    (summary?.referralOpportunitiesCount ?? 0) +
    (summary?.onboardingOverdueCount ?? 0)

  if (loading) {
    return (
      <GrowthEngineCard title="Customer Lifecycle" icon={<HeartPulse className="size-4" />}>
        <p className="text-sm text-muted-foreground">Loading lifecycle metrics…</p>
      </GrowthEngineCard>
    )
  }

  if (setupMessage) {
    return (
      <GrowthEngineCard title="Customer Lifecycle" icon={<HeartPulse className="size-4" />}>
        <p className="text-sm text-muted-foreground">{setupMessage}</p>
      </GrowthEngineCard>
    )
  }

  if (total === 0) {
    return (
      <GrowthEngineCard title="Customer Lifecycle" icon={<HeartPulse className="size-4" />}>
        <p className="text-sm text-muted-foreground">No post-close lifecycle actions due.</p>
        <Link href="/admin/growth/customer-lifecycle" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
          Open lifecycle
        </Link>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Customer Lifecycle" icon={<HeartPulse className="size-4" />}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Renewals due" value={summary?.renewalsDueCount ?? 0} />
        <StatTile label="Expansion candidates" value={summary?.expansionCandidatesCount ?? 0} />
        <StatTile label="Churn risks" value={summary?.churnRisksCount ?? 0} />
        <StatTile label="Review opportunities" value={summary?.reviewOpportunitiesCount ?? 0} />
        <StatTile label="Referral opportunities" value={summary?.referralOpportunitiesCount ?? 0} />
        <StatTile label="Onboarding overdue" value={summary?.onboardingOverdueCount ?? 0} />
      </div>
      <Link href="/admin/growth/customer-lifecycle" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
        Open lifecycle dashboard
      </Link>
    </GrowthEngineCard>
  )
}
