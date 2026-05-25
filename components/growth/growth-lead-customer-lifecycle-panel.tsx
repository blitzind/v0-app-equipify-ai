"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { HeartPulse, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  GROWTH_CUSTOMER_LIFECYCLE_STAGE_LABELS,
  GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS,
  GROWTH_POST_CLOSE_REVENUE_QA_MARKER,
  type GrowthCustomerOnboardingTask,
  type GrowthCustomerProfile,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadCustomerLifecyclePanelProps = {
  lead: GrowthLead
  onTimelineRefresh?: () => void
}

export function GrowthLeadCustomerLifecyclePanel({ lead, onTimelineRefresh }: GrowthLeadCustomerLifecyclePanelProps) {
  const [profile, setProfile] = useState<GrowthCustomerProfile | null>(null)
  const [tasks, setTasks] = useState<GrowthCustomerOnboardingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [renewalDate, setRenewalDate] = useState("")
  const [actionId, setActionId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/customer-lifecycle`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        profile?: GrowthCustomerProfile | null
        tasks?: GrowthCustomerOnboardingTask[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load customer lifecycle.")
      if (data.meta?.schemaReady === false) {
        setSetupMessage(data.meta.setupMessage ?? null)
        setProfile(null)
        setTasks([])
        return
      }
      setSetupMessage(null)
      setProfile(data.profile ?? null)
      setTasks(data.tasks ?? [])
      setRenewalDate(data.profile?.renewalDate ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  async function createProfile() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/customer-lifecycle/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, renewalDate: renewalDate || null }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create customer profile.")
      await load()
      onTimelineRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setCreating(false)
    }
  }

  async function patchProfile(body: Record<string, unknown>) {
    if (!profile) return
    setActionId(profile.id)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/customer-lifecycle/customers/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Update failed.")
      await load()
      onTimelineRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActionId(null)
    }
  }

  async function patchTask(taskId: string, body: Record<string, unknown>) {
    setActionId(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/customer-lifecycle/onboarding-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Task update failed.")
      await load()
      onTimelineRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task update failed.")
    } finally {
      setActionId(null)
    }
  }

  return (
    <GrowthCollapsibleEngineCard
      id="growth-customer-lifecycle"
      cardKey={GROWTH_DRAWER_CARD_KEYS.customerLifecycle}
      title="Post-Close Lifecycle"
      icon={<HeartPulse className="size-4" />}
      summary={
        profile
          ? `${GROWTH_CUSTOMER_LIFECYCLE_STAGE_LABELS[profile.lifecycleStage]} · health ${profile.healthScore}`
          : "No customer profile yet"
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_POST_CLOSE_REVENUE_QA_MARKER} tone="neutral" />
          <GrowthBadge label="No auto-send" tone="neutral" />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading lifecycle…
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {setupMessage ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">{setupMessage}</p>
        ) : null}

        {!loading && !profile && !setupMessage ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a customer lifecycle profile after close won. Human-triggered — not automatic.
            </p>
            <Input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
            <Button size="sm" disabled={creating} onClick={() => void createProfile()}>
              {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Create from close won
            </Button>
          </div>
        ) : null}

        {profile ? (
          <>
            <div className="flex flex-wrap gap-2">
              <GrowthBadge label={GROWTH_CUSTOMER_LIFECYCLE_STAGE_LABELS[profile.lifecycleStage]} tone="healthy" />
              <GrowthBadge label={`Health ${profile.healthScore}`} tone="neutral" />
              <GrowthBadge label={profile.reviewStatus.replace(/_/g, " ")} tone="neutral" />
              <GrowthBadge label={profile.referralStatus.replace(/_/g, " ")} tone="neutral" />
            </div>
            <p className="text-xs text-muted-foreground">
              Closed won {new Date(profile.closedWonAt).toLocaleDateString()}
              {profile.renewalDate ? ` · Renewal ${profile.renewalDate}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={actionId === profile.id}
                onClick={() => void patchProfile({ action: "record_engagement" })}
              >
                Log engagement
              </Button>
              {!profile.activationAt ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionId === profile.id}
                  onClick={() => void patchProfile({ action: "record_activation" })}
                >
                  Record activation
                </Button>
              ) : null}
              {profile.reviewStatus === "review_pending" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionId === profile.id}
                  onClick={() => void patchProfile({ action: "request_review" })}
                >
                  Request review
                </Button>
              ) : null}
              {profile.referralStatus === "referral_eligible" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionId === profile.id}
                  onClick={() => void patchProfile({ action: "request_referral" })}
                >
                  Request referral
                </Button>
              ) : null}
            </div>
            <Link href="/admin/growth/customer-lifecycle" className="text-sm text-indigo-600 hover:underline">
              Open lifecycle dashboard
            </Link>

            {tasks.length > 0 ? (
              <ul className="divide-y divide-border">
                {tasks.map((task) => (
                  <li key={task.id} className="space-y-2 py-3 first:pt-0">
                    <p className="text-sm font-medium">{GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS[task.taskKey]}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.status}
                      {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{task.instructions}</p>
                    {task.status === "open" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionId === task.id}
                          onClick={() => void patchTask(task.id, { action: "complete" })}
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionId === task.id}
                          onClick={() => void patchTask(task.id, { action: "skip", reason: "Skipped from drawer" })}
                        >
                          Skip
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
