"use client"

import type { GrowthAutomationRuntimeReconciliationDiff } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"

type Props = {
  diff: GrowthAutomationRuntimeReconciliationDiff | null
}

const RISK_STYLES: Record<string, string> = {
  low: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  high: "border-orange-500/30 bg-orange-500/5 text-orange-700 dark:text-orange-300",
  blocked: "border-destructive/40 bg-destructive/5 text-destructive",
}

function DiffList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-md border border-border/70 p-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5 text-xs">
        {items.slice(0, 8).map((item) => (
          <li key={item} className="truncate">
            {item}
          </li>
        ))}
        {items.length > 8 ? <li className="text-muted-foreground">+{items.length - 8} more</li> : null}
      </ul>
    </div>
  )
}

export function GrowthAutomationRuntimeDiffSummary({ diff }: Props) {
  if (!diff) {
    return <p className="text-xs text-muted-foreground">Run runtime preview to compare against published version.</p>
  }

  const riskClass = RISK_STYLES[diff.riskLevel] ?? RISK_STYLES.low

  return (
    <div className="space-y-3">
      <div className={`rounded-md border p-2 text-xs ${riskClass}`}>
        <p className="font-medium uppercase tracking-wide">Risk: {diff.riskLevel}</p>
        {diff.requiresHumanReview ? (
          <p className="mt-1 text-muted-foreground">Human review recommended for action nodes.</p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <DiffList title="Nodes added" items={diff.nodesAdded} />
        <DiffList title="Nodes removed" items={diff.nodesRemoved} />
        <DiffList title="Nodes changed" items={diff.nodesChanged} />
        <DiffList title="Edges added" items={diff.edgesAdded} />
        <DiffList title="Edges removed" items={diff.edgesRemoved} />
        <DiffList title="Triggers changed" items={diff.triggersChanged} />
        <DiffList title="Actions changed" items={diff.actionsChanged} />
        <DiffList title="Conditions changed" items={diff.conditionsChanged} />
        <DiffList title="Waits changed" items={diff.waitsChanged} />
        <DiffList title="Approval gates changed" items={diff.approvalGatesChanged} />
      </div>
    </div>
  )
}
