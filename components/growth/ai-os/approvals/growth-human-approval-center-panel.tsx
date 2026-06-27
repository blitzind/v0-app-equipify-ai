"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import type {
  GrowthHumanApprovalCenterReadModel,
  GrowthHumanApprovalChannel,
} from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import { GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  GrowthAutonomousOutboundScopeActivationControl,
  scopeIdFromApprovalEvidence,
} from "@/components/growth/ai-os/approvals/growth-autonomous-outbound-scope-activation-control"

type ApiResponse = {
  ok?: boolean
  humanApprovalCenter?: GrowthHumanApprovalCenterReadModel
  message?: string
  error?: string
}

type OutboundApiResponse = {
  ok?: boolean
  boundedAutonomousOutbound?: GrowthBoundedAutonomousOutboundReadModel
}

const CHANNEL_FILTERS: Array<{ id: "all" | GrowthHumanApprovalChannel; label: string }> = [
  { id: "all", label: "All" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
  { id: "voice", label: "Voice" },
  { id: "call", label: "Call" },
  { id: "none", label: "Planning" },
]

export function GrowthHumanApprovalCenterPanel() {
  const [model, setModel] = useState<GrowthHumanApprovalCenterReadModel | null>(null)
  const [boundedAutonomousOutbound, setBoundedAutonomousOutbound] =
    useState<GrowthBoundedAutonomousOutboundReadModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<"all" | GrowthHumanApprovalChannel>("all")

  const load = useCallback(async () => {
    const [approvalResponse, outboundResponse] = await Promise.all([
      fetch("/api/platform/growth/ai-os/approvals", { cache: "no-store" }),
      fetch("/api/platform/growth/ai-os/bounded-autonomous-outbound", { cache: "no-store" }),
    ])
    const body = (await approvalResponse.json()) as ApiResponse
    if (!approvalResponse.ok || !body.ok || !body.humanApprovalCenter) {
      throw new Error(body.message ?? body.error ?? "Could not load Human Approval Center.")
    }
    setModel(body.humanApprovalCenter)

    const outboundBody = (await outboundResponse.json()) as OutboundApiResponse
    if (outboundResponse.ok && outboundBody.ok && outboundBody.boundedAutonomousOutbound) {
      setBoundedAutonomousOutbound(outboundBody.boundedAutonomousOutbound)
    } else {
      setBoundedAutonomousOutbound(null)
    }
  }, [])

  useEffect(() => {
    void load()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load Human Approval Center.")
      })
      .finally(() => setLoading(false))
  }, [load])

  const filteredItems = useMemo(() => {
    if (!model) return []
    if (channelFilter === "all") return model.items
    return model.items.filter((item) => item.channel === channelFilter)
  }, [model, channelFilter])

  if (loading && !model) {
    return <p className="text-sm text-muted-foreground">Loading Human Approval Center…</p>
  }

  if (error && !model) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!model || model.qaMarker !== GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER) return null

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Human Approval Center"
        description="Unified operator inbox for AI-recommended actions. Autonomous outbound scope activation is gated here — all other items remain read-only review and routing."
        icon={ShieldCheck}
        iconClassName="bg-amber-50 text-amber-700"
      />

      <div className="space-y-4" data-qa-marker={GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Pending" value={String(model.summary.totalPending)} />
          <Stat label="SMS pending" value={String(model.summary.smsPending)} />
          <Stat label="Email pending" value={String(model.summary.emailPending)} />
          <Stat label="Voice pending" value={String(model.summary.voicePending)} />
        </div>

        <div className="flex flex-wrap gap-2">
          {CHANNEL_FILTERS.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              size="sm"
              variant={channelFilter === filter.id ? "default" : "outline"}
              onClick={() => setChannelFilter(filter.id)}
            >
              {filter.label}
              {filter.id !== "all" ? ` (${model.filterCounts.byChannel[filter.id] ?? 0})` : ""}
            </Button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approval items match the current filter.</p>
        ) : (
          <ul className="space-y-3">
            {filteredItems.map((item) => (
              <li key={item.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      Source: {item.source.replaceAll("_", " ")} · Action: {item.actionType.replaceAll("_", " ")}
                      {item.channel ? ` · Channel: ${item.channel}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enforcement: {item.policy.enforcementSource}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">Score {item.priorityScore}</Badge>
                    <Badge variant={item.riskLevel === "high" ? "destructive" : "secondary"}>{item.riskLevel}</Badge>
                    <Badge variant="outline">{item.status.replaceAll("_", " ")}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.evidence.length} evidence item(s)</p>
                {item.route ? (
                  <Link href={item.route} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                    Open existing approval surface
                  </Link>
                ) : null}
                {item.source === "autonomous_outbound_scope" && item.status === "approved_elsewhere" ? (
                  (() => {
                    const scopeId = scopeIdFromApprovalEvidence(item.evidence)
                    if (!scopeId) return null
                    return (
                      <GrowthAutonomousOutboundScopeActivationControl
                        scopeId={scopeId}
                        title={item.title}
                        evidence={item.evidence}
                        expiresAt={item.expiresAt}
                        readModel={boundedAutonomousOutbound}
                        onActivated={() => void load()}
                      />
                    )
                  })()
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {model.sourcesFailed.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Partial read — {model.sourcesFailed.length} source(s) skipped without failing the read model.
          </p>
        ) : null}
      </div>
    </GrowthWorkspacePageContent>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
