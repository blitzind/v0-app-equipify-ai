"use client"

import { Bot, Layers3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiOsExecutWorkOrderProposal } from "@/lib/growth/aios/ai-executive-mission-planning-types"

function ProposalCard({ proposal }: { proposal: AiOsExecutWorkOrderProposal }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{proposal.workOrderType.replaceAll("_", " ")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{proposal.rationale}</p>
        </div>
        <Badge variant="secondary">P{proposal.priority}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-1">
          <Bot className="size-3.5" />
          {proposal.assignedAgent}
        </span>
        {proposal.entityType ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-1 font-mono">
            {proposal.entityType}:{proposal.entityId?.slice(0, 8) ?? "—"}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function GrowthAiOsProposedWorkOrdersSection({
  proposals,
  duplicateProposals,
  previewedAt,
  loading,
  onRefreshPreview,
  busy,
}: {
  proposals: AiOsExecutWorkOrderProposal[]
  duplicateProposals: AiOsExecutWorkOrderProposal[]
  previewedAt: string | null
  loading?: boolean
  onRefreshPreview?: () => void
  busy?: boolean
}) {
  return (
    <Card data-qa-section="proposed-work-orders">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="size-5 text-indigo-600" />
              Proposed Work Orders
            </CardTitle>
            <CardDescription>
              {previewedAt
                ? `Dry-run preview · ${new Date(previewedAt).toLocaleString()}`
                : "Run preview to see what will be created on approval."}
            </CardDescription>
          </div>
          {onRefreshPreview ? (
            <button
              type="button"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              disabled={busy}
              onClick={onRefreshPreview}
            >
              {busy ? "Refreshing…" : "Refresh preview"}
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading proposed Work Orders…</p>
        ) : proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No selectable proposals — all items were duplicate-skipped or the stage has no bindings.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {proposals.map((proposal) => (
              <ProposalCard key={proposal.proposalKey} proposal={proposal} />
            ))}
          </div>
        )}
        {duplicateProposals.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-dashed border-border/70 bg-muted/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Duplicate-skipped ({duplicateProposals.length})
            </p>
            <div className="grid gap-2">
              {duplicateProposals.map((proposal) => (
                <p key={proposal.proposalKey} className="text-xs text-muted-foreground">
                  {proposal.workOrderType} · {proposal.rationale}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
