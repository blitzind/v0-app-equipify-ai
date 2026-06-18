"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, RefreshCw, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthSenderPoolManagementPanel } from "@/components/growth/sender-pools/growth-sender-pool-management-panel"
import {
  GrowthSenderPoolSimulationCard,
  type GrowthSenderPoolSimulationResult,
} from "@/components/growth/sender-pools/growth-sender-pool-simulation-card"
import type { GrowthSenderAccount } from "@/lib/growth/sender/sender-types"
import {
  GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER,
  GROWTH_SENDER_POOL_ROTATION_STRATEGIES,
  poolStatusLabel,
  riskLevelLabel,
  rotationReasonLabel,
  rotationStrategyLabel,
  type GrowthSenderRoutingInsight,
  type GrowthSenderPoolDashboard,
} from "@/lib/growth/sender-pools/sender-pool-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked" | "medium"> = {
  active: "healthy",
  draft: "neutral",
  paused: "attention",
  disabled: "blocked",
  eligible: "healthy",
  cooldown: "attention",
  blocked: "blocked",
  warming: "medium",
  degraded: "attention",
  low: "healthy",
  medium: "medium",
  high: "attention",
  critical: "critical",
  healthy: "healthy",
  warning: "attention",
  at_risk: "attention",
  ok: "healthy",
  throttled: "attention",
  improving: "healthy",
  declining: "critical",
  stable: "neutral",
  unknown: "neutral",
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function GrowthSenderPoolsDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthSenderPoolDashboard | null>(null)
  const [senders, setSenders] = useState<GrowthSenderAccount[]>([])
  const [selectedPoolId, setSelectedPoolId] = useState<string>("")
  const [newPoolName, setNewPoolName] = useState("")
  const [creating, setCreating] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [simulatingPoolId, setSimulatingPoolId] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<GrowthSenderPoolSimulationResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardRes, sendersRes] = await Promise.all([
        fetch("/api/platform/growth/sender-pools/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/senders", { cache: "no-store" }),
      ])
      const payload = (await dashboardRes.json()) as {
        ok?: boolean
        dashboard?: GrowthSenderPoolDashboard
        message?: string
      }
      const sendersPayload = (await sendersRes.json()) as { ok?: boolean; senders?: GrowthSenderAccount[] }
      if (!dashboardRes.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load sender pools dashboard.")
      }
      setDashboard(payload.dashboard)
      if (sendersRes.ok && sendersPayload.senders) setSenders(sendersPayload.senders)
      setSelectedPoolId((current) => {
        if (current && payload.dashboard!.pools.some((p) => p.id === current)) return current
        return payload.dashboard!.pools[0]?.id ?? ""
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load sender pools dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedPool = useMemo(
    () => dashboard?.pools.find((pool) => pool.id === selectedPoolId) ?? null,
    [dashboard, selectedPoolId],
  )

  const selectedMembers = useMemo(
    () => (dashboard?.members ?? []).filter((member) => member.senderPoolId === selectedPoolId),
    [dashboard, selectedPoolId],
  )

  const selectedRoutingInsights = useMemo(
    () =>
      (dashboard?.routingInsights ?? []).filter(
        (row) => row.sender_pool_id === selectedPoolId || row.sender_pool_id == null,
      ),
    [dashboard, selectedPoolId],
  )

  async function runAction(key: string, fn: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    try {
      await fn()
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function createPool() {
    if (!newPoolName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/sender-pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPoolName.trim(), status: "draft", rotationStrategy: "weighted_health" }),
      })
      const payload = (await response.json()) as { message?: string; pool?: { id?: string } }
      if (!response.ok) throw new Error(payload.message ?? "Could not create sender pool.")
      setNewPoolName("")
      if (payload.pool?.id) setSelectedPoolId(payload.pool.id)
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create sender pool.")
    } finally {
      setCreating(false)
    }
  }

  async function patchPool(patch: Record<string, unknown>) {
    if (!selectedPoolId) return
    await runAction("patch-pool", async () => {
      const response = await fetch(`/api/platform/growth/sender-pools/${selectedPoolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not update sender pool.")
    })
  }

  async function addMember(senderAccountId: string) {
    if (!selectedPoolId) return
    await runAction("add-member", async () => {
      const response = await fetch(`/api/platform/growth/sender-pools/${selectedPoolId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderAccountId, memberStatus: "eligible" }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(
          payload.message?.includes("duplicate") || payload.message?.includes("unique")
            ? "Sender is already in this pool."
            : payload.message ?? "Could not add sender to pool.",
        )
      }
    })
  }

  async function removeMember(memberId: string) {
    if (!selectedPoolId) return
    await runAction(`remove-${memberId}`, async () => {
      const response = await fetch(`/api/platform/growth/sender-pools/${selectedPoolId}/members/${memberId}`, {
        method: "DELETE",
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not remove pool member.")
    })
  }

  async function patchMember(memberId: string, patch: Record<string, unknown>) {
    if (!selectedPoolId) return
    await runAction(`member-${memberId}`, async () => {
      const response = await fetch(`/api/platform/growth/sender-pools/${selectedPoolId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not update pool member.")
    })
  }

  async function simulatePool(poolId: string) {
    setSimulatingPoolId(poolId)
    setSimulation(null)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/sender-pools/${poolId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowAutoRotation: true }),
      })
      const payload = (await response.json()) as GrowthSenderPoolSimulationResult & { message?: string }
      if (!response.ok) throw new Error(String(payload.message ?? "Simulation failed."))
      setSimulation(payload)
      setSelectedPoolId(poolId)
    } catch (simError) {
      setError(simError instanceof Error ? simError.message : "Simulation failed.")
    } finally {
      setSimulatingPoolId(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading sender pools…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER}</p>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Active Pools" value={String(dashboard?.activePools ?? 0)} />
        <StatTile label="Eligible Senders" value={String(dashboard?.eligibleSenders ?? 0)} />
        <StatTile label="Senders in Cooldown" value={String(dashboard?.sendersInCooldown ?? 0)} />
        <StatTile label="Fatigue Warnings" value={String(dashboard?.fatigueWarnings ?? 0)} />
        <StatTile label="Average Reputation" value={`${dashboard?.averageReputation ?? 0}`} />
        <StatTile label="Rotation Health" value={`${dashboard?.rotationHealth ?? 0}%`} />
      </div>

      <GrowthEngineCard title="Create sender pool">
        <div className="flex flex-wrap gap-2">
          <Input
            value={newPoolName}
            onChange={(e) => setNewPoolName(e.target.value)}
            placeholder="Pool name"
            className="max-w-xs"
          />
          <Button onClick={() => void createPool()} disabled={creating || !newPoolName.trim()}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create pool
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Sender pools">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Strategy</th>
                <th className="py-2 pr-3">Members</th>
                <th className="py-2 pr-3">Auto rotation</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.pools ?? []).map((pool) => {
                const isSelected = pool.id === selectedPoolId
                return (
                  <tr
                    key={pool.id}
                    className={
                      isSelected ? "border-b border-primary/30 bg-primary/5" : "border-b border-border/50 cursor-pointer"
                    }
                    onClick={() => setSelectedPoolId(pool.id)}
                  >
                    <td className="py-2 pr-3 font-medium">{pool.name}</td>
                    <td className="py-2 pr-3">
                      <GrowthBadge label={poolStatusLabel(pool.status)} tone={STATUS_TONE[pool.status] ?? "neutral"} />
                    </td>
                    <td className="py-2 pr-3">{rotationStrategyLabel(pool.rotationStrategy)}</td>
                    <td className="py-2 pr-3">{pool.memberCount}</td>
                    <td className="py-2 pr-3">{pool.allowAutoRotation ? "Yes" : "Manual only"}</td>
                    <td className="py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          void simulatePool(pool.id)
                        }}
                        disabled={simulatingPoolId === pool.id}
                      >
                        {simulatingPoolId === pool.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Shuffle className="size-4" />
                        )}
                        Simulate
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      {selectedPool ? (
        <GrowthSenderPoolManagementPanel
          pool={selectedPool}
          members={selectedMembers}
          routingInsights={selectedRoutingInsights}
          senders={senders}
          actionLoading={actionLoading}
          onPatchPool={patchPool}
          onAddMember={addMember}
          onRemoveMember={removeMember}
          onPatchMember={patchMember}
        />
      ) : (
        <GrowthEngineCard title="Pool management">
          <p className="text-sm text-muted-foreground">Create or select a sender pool to manage members.</p>
        </GrowthEngineCard>
      )}

      {simulation ? (
        <GrowthSenderPoolSimulationCard pool={selectedPool} simulation={simulation} />
      ) : null}

      {dashboard?.routeBalancingRecommendation ? (
        <GrowthEngineCard title="Route balancing">
          <p className="text-sm text-muted-foreground">{dashboard.routeBalancingRecommendation}</p>
        </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Health-aware routing">
        <p className="mb-3 text-xs text-muted-foreground">{dashboard?.health_aware_routing_marker}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Sender</th>
                <th className="py-2 pr-3">Routing</th>
                <th className="py-2 pr-3">Health</th>
                <th className="py-2 pr-3">Remaining</th>
                <th className="py-2 pr-3">Util %</th>
                <th className="py-2 pr-3">Eligible</th>
                <th className="py-2 pr-3">Trend</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.routingInsights ?? []).slice(0, 40).map((row: GrowthSenderRoutingInsight) => (
                <tr key={`${row.sender_pool_id ?? "none"}-${row.sender_account_id}`} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">{row.sender_label}</td>
                  <td className="py-2 pr-3">{row.routing_score}</td>
                  <td className="py-2 pr-3">
                    <GrowthBadge
                      label={`${row.mailbox_health_score} · ${row.mailbox_health_state}`}
                      tone={STATUS_TONE[row.mailbox_health_state] ?? "neutral"}
                    />
                  </td>
                  <td className="py-2 pr-3">{row.remaining_capacity}</td>
                  <td className="py-2 pr-3">{row.utilization_pct}%</td>
                  <td className="py-2 pr-3">
                    <GrowthBadge
                      label={row.routing_eligible ? "Yes" : "No"}
                      tone={row.routing_eligible ? "healthy" : "blocked"}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <GrowthBadge label={row.reputation_trend} tone={STATUS_TONE[row.reputation_trend] ?? "neutral"} />
                  </td>
                  <td className="py-2 text-xs text-muted-foreground max-w-xs">{row.recommended_action ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Rotation decisions">
        <div className="space-y-3">
          {(dashboard?.rotationDecisions ?? []).slice(0, 20).map((decision) => (
            <div key={decision.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{decision.senderPoolName}</span>
                <GrowthBadge label={riskLevelLabel(decision.riskLevel)} tone={STATUS_TONE[decision.riskLevel] ?? "neutral"} />
                <span className="text-muted-foreground">{rotationReasonLabel(decision.decisionReason)}</span>
              </div>
              <p className="mt-1">
                Selected: <span className="font-medium">{decision.selectedSenderLabel ?? "—"}</span>
              </p>
              {decision.fallbackCandidates.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Fallbacks: {decision.fallbackCandidates.map((c) => c.senderLabel).join(", ")}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">{formatWhen(decision.createdAt)}</p>
            </div>
          ))}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Fatigue events">
        <div className="space-y-3">
          {(dashboard?.fatigueEvents ?? []).slice(0, 20).map((event) => (
            <div key={event.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{event.senderLabel}</span>
                <GrowthBadge label={event.severity} tone={STATUS_TONE[event.severity] ?? "attention"} />
                <span className="text-muted-foreground">{fatigueTypeLabel(event.fatigueType)}</span>
              </div>
              <p className="mt-1">{event.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
            </div>
          ))}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Performance snapshots">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Pool</th>
                <th className="py-2 pr-3">Eligible</th>
                <th className="py-2 pr-3">Cooldown</th>
                <th className="py-2 pr-3">Fatigue</th>
                <th className="py-2 pr-3">Reputation</th>
                <th className="py-2">Health</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.performanceSnapshots ?? []).slice(0, 20).map((snap) => (
                <tr key={snap.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">{snap.senderPoolName}</td>
                  <td className="py-2 pr-3">{snap.eligibleMembers}</td>
                  <td className="py-2 pr-3">{snap.cooldownMembers}</td>
                  <td className="py-2 pr-3">{snap.fatigueWarnings}</td>
                  <td className="py-2 pr-3">{snap.averageReputation}</td>
                  <td className="py-2">{snap.rotationHealthScore}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Pool health & fatigue risks">
        <p className="text-sm text-muted-foreground">
          {(dashboard?.fatigueWarnings ?? 0) > 0
            ? `${dashboard?.fatigueWarnings ?? 0} fatigue warning(s) detected across active pools — review in Deliverability Ops.`
            : "No active pool fatigue warnings. Monitor deliverability trends in Deliverability Ops."}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/admin/growth/providers/deliverability-ops">Open Deliverability Ops</Link>
        </Button>
      </GrowthEngineCard>

      <p className="text-xs text-muted-foreground">
        Strategies: {GROWTH_SENDER_POOL_ROTATION_STRATEGIES.join(", ")}. Simulation never sends mail.
      </p>
    </div>
  )
}
