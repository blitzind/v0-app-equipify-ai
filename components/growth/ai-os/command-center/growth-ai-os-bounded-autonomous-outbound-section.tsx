"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { evaluateAutonomousOutboundActivationEligibility } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { openCompletedWork } from "@/lib/workspace/ai-teammate-voice"

type Props = {
  boundedAutonomousOutbound: GrowthBoundedAutonomousOutboundReadModel
  compact?: boolean
}

export function GrowthAiOsBoundedAutonomousOutboundSection({
  boundedAutonomousOutbound,
  compact = false,
}: Props) {
  const { teammate } = useAiTeammateIdentity()
  if (boundedAutonomousOutbound.qaMarker !== GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER) return null

  const summary = boundedAutonomousOutbound.summary
  const generatedAt = boundedAutonomousOutbound.generatedAt
  const scopes = compact
    ? boundedAutonomousOutbound.activeScopes.slice(0, 3)
    : [
        ...boundedAutonomousOutbound.approvedScopes.slice(0, 2),
        ...boundedAutonomousOutbound.activeScopes,
        ...boundedAutonomousOutbound.blockedScopes.slice(0, 2),
      ]

  return (
    <section data-qa-section="bounded-autonomous-outbound" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Bounded Autonomous Outbound</h3>
          <p className="text-xs text-muted-foreground">
            Read-only scope runtime — executes only inside human-approved limits via existing transport.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {summary.activeScopes} active
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 text-xs">
        <div className="rounded-md border px-3 py-2">
          <p className="text-muted-foreground">Approved</p>
          <p className="text-sm font-semibold">{summary.approvedScopes}</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-muted-foreground">Blocked</p>
          <p className="text-sm font-semibold">{summary.blockedScopes}</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-muted-foreground">Actions today</p>
          <p className="text-sm font-semibold">{summary.actionsExecutedToday}</p>
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="text-muted-foreground">Kill switch</p>
          <p className="text-sm font-semibold">
            {boundedAutonomousOutbound.killSwitchStatus.autonomyOutboundEnabled ? "Outbound on" : "Outbound off"}
          </p>
        </div>
      </div>

      {scopes.length > 0 ? (
        <ul className="space-y-2 text-xs">
          {scopes.map((row) => {
            const activation = evaluateAutonomousOutboundActivationEligibility({
              scope: row.scope,
              nowIso: generatedAt,
              killSwitchStatus: boundedAutonomousOutbound.killSwitchStatus,
            })
            return (
            <li key={row.scope.id} className="rounded-md border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{row.scope.title}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={row.scope.status === "blocked" ? "destructive" : "secondary"}>
                    {row.scope.status}
                  </Badge>
                  {row.scope.status === "approved" ? (
                    <Badge variant={activation.eligible ? "default" : "outline"}>
                      {activation.eligible ? "Eligible for activation" : "Not eligible"}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-muted-foreground">{row.scope.summary}</p>
              <p className="mt-1">
                Budget: {row.consumption.actionsToday}/{row.scope.limits.maxActionsPerDay} today ·{" "}
                {row.consumption.actionsTotal}/{row.scope.limits.maxActionsTotal} total
              </p>
              <p className="mt-1 text-muted-foreground">
                Expires: {new Date(row.scope.expiresAt).toLocaleDateString()} · Channels:{" "}
                {row.scope.allowedChannels.join(", ") || "none"}
              </p>
              {row.nextQueuedAction ? (
                <p className="mt-1">Next: {row.nextQueuedAction.actionType}</p>
              ) : null}
              {row.activeStopConditions.length > 0 ? (
                <p className="mt-1 text-amber-700">Stop: {row.activeStopConditions.join(", ")}</p>
              ) : null}
              {row.scope.status === "approved" && !activation.eligible ? (
                <p className="mt-1 text-muted-foreground">{activation.reasons.join(" · ")}</p>
              ) : null}
            </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No active autonomous outbound scopes.</p>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/growth/os/approvals" className="text-primary underline-offset-4 hover:underline">
          {openCompletedWork(teammate)}
        </Link>
        {boundedAutonomousOutbound.lastEventType ? (
          <span className="text-muted-foreground">
            Last event: {boundedAutonomousOutbound.lastEventType}
          </span>
        ) : null}
      </div>
    </section>
  )
}
