"use client"

import type { GrowthAutomationValidationResult } from "@/lib/growth/automation/growth-automation-types"

type Props = {
  validation: GrowthAutomationValidationResult | null
  loading?: boolean
  onValidate?: () => void
}

export function GrowthAutomationValidationPanel({ validation, loading, onValidate }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Validation</h3>
          <p className="text-xs text-muted-foreground">Read-only graph checks — no compile or execution.</p>
        </div>
        {onValidate ? (
          <button
            type="button"
            className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted"
            disabled={loading}
            onClick={onValidate}
          >
            {loading ? "Validating…" : "Validate"}
          </button>
        ) : null}
      </div>

      {!validation ? (
        <p className="mt-3 text-sm text-muted-foreground">Run validation to see errors and warnings.</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <p className={validation.ok ? "text-emerald-600" : "text-destructive"}>
            {validation.ok ? "Graph passes validation." : "Graph has validation errors."}
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span>Nodes: {validation.graphStats.nodeCount}</span>
            <span>Edges: {validation.graphStats.edgeCount}</span>
            <span>Triggers: {validation.graphStats.triggerCount}</span>
          </div>
          {validation.errors.length > 0 ? (
            <ul className="space-y-1 text-destructive">
              {validation.errors.map((issue, index) => (
                <li key={`${issue.ruleCode}-${index}`}>
                  [{issue.ruleCode}] {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          {validation.warnings.length > 0 ? (
            <ul className="space-y-1 text-amber-700">
              {validation.warnings.map((issue, index) => (
                <li key={`${issue.ruleCode}-${index}`}>
                  [{issue.ruleCode}] {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  )
}
