"use client"

import {
  riskLevelLabel,
  rotationReasonLabel,
  type GrowthSenderPool,
  type GrowthSenderRotationOutput,
  type GrowthSenderRoutingInsight,
} from "@/lib/growth/sender-pools/sender-pool-types"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked" | "medium"> = {
  active: "healthy",
  draft: "neutral",
  paused: "attention",
  disabled: "blocked",
  low: "healthy",
  medium: "medium",
  high: "attention",
  critical: "critical",
}

export type GrowthSenderPoolSimulationResult = {
  ok?: boolean
  rotation?: GrowthSenderRotationOutput
  routingInsights?: GrowthSenderRoutingInsight[]
  privacy_note?: string
}

function labelForSender(
  senderAccountId: string | null,
  routingInsights: GrowthSenderRoutingInsight[],
): string {
  if (!senderAccountId) return "—"
  const match = routingInsights.find((row) => row.sender_account_id === senderAccountId)
  return match?.sender_label ?? senderAccountId
}

export function GrowthSenderPoolSimulationCard({
  pool,
  simulation,
}: {
  pool: GrowthSenderPool | null
  simulation: GrowthSenderPoolSimulationResult
}) {
  const rotation = simulation.rotation
  const insights = simulation.routingInsights ?? []
  const selectedId = rotation?.selectedSenderAccountId ?? null
  const selectedInsight = selectedId
    ? insights.find((row) => row.sender_account_id === selectedId)
    : null

  return (
    <GrowthEngineCard title="Rotation simulation preview">
      <p className="mb-4 text-xs text-muted-foreground">
        {simulation.privacy_note ?? "Simulation only — no message sent."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pool status</p>
          <p className="mt-1 text-sm font-semibold">{pool?.name ?? "—"}</p>
          {pool ? (
            <GrowthBadge label={pool.status} tone={STATUS_TONE[pool.status] ?? "neutral"} className="mt-2" />
          ) : null}
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected sender</p>
          <p className="mt-1 text-sm font-semibold">{labelForSender(selectedId, insights)}</p>
          {rotation ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Risk: {riskLevelLabel(rotation.riskLevel)}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Routing reason</p>
          <p className="mt-1 text-sm font-semibold">
            {rotation ? rotationReasonLabel(rotation.reason) : "No eligible sender"}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Health score</p>
          <p className="mt-1 text-sm font-semibold">
            {selectedInsight ? `${selectedInsight.mailbox_health_score} · ${selectedInsight.mailbox_health_state}` : "—"}
          </p>
          {selectedInsight ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Routing score: {selectedInsight.routing_score}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capacity remaining</p>
          <p className="mt-1 text-sm font-semibold">
            {selectedInsight != null ? selectedInsight.remaining_capacity : "—"}
          </p>
          {selectedInsight != null ? (
            <p className="mt-1 text-xs text-muted-foreground">Utilization: {selectedInsight.utilization_pct}%</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warmup</p>
          <p className="mt-1 text-sm font-semibold">{selectedInsight?.warmup_status ?? "—"}</p>
        </div>
      </div>

      {rotation && rotation.fallbackSenderCandidates.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Fallback senders</p>
          <ul className="space-y-2">
            {rotation.fallbackSenderCandidates.map((candidate) => (
              <li
                key={candidate.senderAccountId}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
              >
                <span className="font-medium">{candidate.senderLabel}</span>
                <GrowthBadge
                  label={riskLevelLabel(candidate.riskLevel)}
                  tone={STATUS_TONE[candidate.riskLevel] ?? "neutral"}
                />
                <span className="text-xs text-muted-foreground">{rotationReasonLabel(candidate.reason)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No fallback senders for this simulation.</p>
      )}
    </GrowthEngineCard>
  )
}
