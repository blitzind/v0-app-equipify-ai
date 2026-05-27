"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { HeartPulse, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_CUSTOMER_LIFECYCLE_INBOX_VIEWS,
  GROWTH_CUSTOMER_LIFECYCLE_STAGE_LABELS,
  GROWTH_CUSTOMER_LIFECYCLE_STAGES,
  type GrowthCustomerLifecycleDashboard,
  type GrowthCustomerLifecycleInboxView,
  type GrowthCustomerLifecycleStage,
  type GrowthCustomerProfile,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"

const VIEW_LABELS: Record<GrowthCustomerLifecycleInboxView, string> = {
  onboarding: "Onboarding",
  healthy: "Healthy",
  renewals: "Renewals",
  expansion: "Expansion",
  churn_risk: "Churn Risk",
  reviews: "Reviews",
  referrals: "Referrals",
  all: "All",
}

export function GrowthCustomerLifecycleDashboard() {
  const [dashboard, setDashboard] = useState<GrowthCustomerLifecycleDashboard | null>(null)
  const [items, setItems] = useState<GrowthCustomerProfile[]>([])
  const [view, setView] = useState<GrowthCustomerLifecycleInboxView>("all")
  const [lifecycleStage, setLifecycleStage] = useState<GrowthCustomerLifecycleStage | "">("")
  const [minHealthScore, setMinHealthScore] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async (activeView: GrowthCustomerLifecycleInboxView, refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: activeView, limit: "50" })
      if (lifecycleStage) params.set("lifecycleStage", lifecycleStage)
      if (minHealthScore) params.set("minHealthScore", minHealthScore)
      const dashParams = refresh ? "?refresh=true" : ""
      const [dashRes, inboxRes] = await Promise.all([
        fetch(`/api/platform/growth/customer-lifecycle/dashboard${dashParams}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/customer-lifecycle/customers?${params.toString()}`, { cache: "no-store" }),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        dashboard?: GrowthCustomerLifecycleDashboard | null
        message?: string
      }
      const inboxData = (await inboxRes.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: { items?: GrowthCustomerProfile[] }
        message?: string
      }
      if (!dashRes.ok || !dashData.ok) throw new Error(dashData.message ?? "Could not load dashboard.")
      if (dashData.meta?.schemaReady === false) {
        setSetupMessage(dashData.meta.setupMessage ?? null)
        setDashboard(null)
        setItems([])
        return
      }
      if (!inboxRes.ok || !inboxData.ok) throw new Error(inboxData.message ?? "Could not load customers.")
      setSetupMessage(null)
      setDashboard(dashData.dashboard ?? null)
      setItems(inboxData.feed?.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lifecycleStage, minHealthScore])

  useEffect(() => {
    void load(view)
  }, [load, view])

  async function patchCustomer(customerId: string, body: Record<string, unknown>) {
    setActionId(customerId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/customer-lifecycle/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Update failed.")
      await load(view, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActionId(null)
    }
  }

  if (loading && !dashboard && !setupMessage) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading customer lifecycle…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROWTH_CUSTOMER_LIFECYCLE_INBOX_VIEWS.map((option) => (
            <Button key={option} size="sm" variant={view === option ? "default" : "outline"} onClick={() => setView(option)}>
              {VIEW_LABELS[option]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(view, true)}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={lifecycleStage}
          onChange={(e) => setLifecycleStage(e.target.value as GrowthCustomerLifecycleStage | "")}
        >
          <option value="">All lifecycle stages</option>
          {GROWTH_CUSTOMER_LIFECYCLE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {GROWTH_CUSTOMER_LIFECYCLE_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
        <Input
          className="w-36"
          placeholder="Min health"
          value={minHealthScore}
          onChange={(e) => setMinHealthScore(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {setupMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
      ) : null}

      {dashboard ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label="Human-owned lifecycle" tone="neutral" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={<HeartPulse className="size-3.5" />} label="Onboarding pipeline" value={dashboard.onboardingPipelineCount} />
            <StatTile label="Healthy / activated" value={dashboard.healthyCount} />
            <StatTile label="Renewals upcoming" value={dashboard.renewalUpcomingCount} />
            <StatTile label="Renewals overdue" value={dashboard.renewalOverdueCount} />
            <StatTile label="Expansion candidates" value={dashboard.expansionCandidateCount} />
            <StatTile label="Churn risks" value={dashboard.churnRiskCount} />
            <StatTile label="Review pending" value={dashboard.reviewPendingCount} />
            <StatTile label="Referral eligible" value={dashboard.referralEligibleCount} />
          </div>
        </>
      ) : null}

      <GrowthEngineCard title="Customer profiles">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No customer profiles in this view.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((profile) => (
              <li key={profile.id} className="space-y-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{profile.companyName}</p>
                    <p className="text-xs text-muted-foreground">
                      {GROWTH_CUSTOMER_LIFECYCLE_STAGE_LABELS[profile.lifecycleStage]}
                      {` · health ${profile.healthScore}`}
                      {profile.renewalDate ? ` · renewal ${profile.renewalDate}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <GrowthBadge label={profile.reviewStatus.replace(/_/g, " ")} tone="neutral" />
                      <GrowthBadge label={profile.referralStatus.replace(/_/g, " ")} tone="neutral" />
                      {(profile.openOnboardingTaskCount ?? 0) > 0 ? (
                        <GrowthBadge label={`${profile.openOnboardingTaskCount} onboarding tasks`} tone="high" />
                      ) : null}
                    </div>
                  </div>
                  <Link
                    href={`/admin/growth/leads?open=${profile.leadId}&focus=customer-lifecycle`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Open lead
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionId === profile.id}
                    onClick={() => void patchCustomer(profile.id, { action: "record_engagement" })}
                  >
                    Log engagement
                  </Button>
                  {profile.reviewStatus === "review_pending" || profile.reviewStatus === "none" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionId === profile.id}
                      onClick={() => void patchCustomer(profile.id, { action: "request_review" })}
                    >
                      Request review
                    </Button>
                  ) : null}
                  {profile.reviewStatus === "review_requested" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionId === profile.id}
                      onClick={() => void patchCustomer(profile.id, { action: "record_review_received" })}
                    >
                      Review received
                    </Button>
                  ) : null}
                  {profile.referralStatus === "referral_eligible" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionId === profile.id}
                      onClick={() => void patchCustomer(profile.id, { action: "request_referral" })}
                    >
                      Request referral
                    </Button>
                  ) : null}
                  {!profile.activationAt ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionId === profile.id}
                      onClick={() => void patchCustomer(profile.id, { action: "record_activation" })}
                    >
                      Record activation
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      {dashboard ? (
        <GrowthEngineCard title="Lifecycle distribution">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {dashboard.lifecycleStageDistribution.map((entry) => (
              <div key={entry.stage} className="rounded border border-border px-3 py-2 text-sm">
                {GROWTH_CUSTOMER_LIFECYCLE_STAGE_LABELS[entry.stage]}: {entry.count}
              </div>
            ))}
          </div>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
