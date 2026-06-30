"use client"

import type { GrowthAutomationCompileResult } from "@/lib/growth/automation/growth-automation-compiler-types"

type Props = {
  compile: GrowthAutomationCompileResult | null
  loading?: boolean
}

export function GrowthAutomationCompiledArtifactPreview({ compile, loading }: Props) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Compiling preview…</p>
  }
  if (!compile) {
    return <p className="text-sm text-muted-foreground">Run preview to see how this automation will behave.</p>
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <span>Steps: {compile.stats.stepCount}</span>
        <span>Conditions: {compile.stats.conditionCount}</span>
        <span>Edges: {compile.stats.edgeCount}</span>
        <span>Waits: {compile.stats.waitCount}</span>
        <span>Gates: {compile.stats.safeExecutionGateCount}</span>
        <span>Status: {compile.status}</span>
      </div>

      {compile.compiledPatternDraft ? (
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entry trigger</p>
          <p>{compile.compiledPatternDraft.entryTrigger.triggerKey}</p>
          {compile.compiledPatternDraft.entryTrigger.conditionEvent ? (
            <p className="text-xs text-muted-foreground">
              {compile.compiledPatternDraft.entryTrigger.conditionSource} ·{" "}
              {compile.compiledPatternDraft.entryTrigger.conditionEvent}
            </p>
          ) : null}
        </div>
      ) : null}

      {compile.errors.length > 0 ? (
        <ul className="space-y-1 text-destructive">
          {compile.errors.map((issue, index) => (
            <li key={`${issue.ruleCode}-${index}`}>
              [{issue.ruleCode}] {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {compile.warnings.length > 0 ? (
        <ul className="space-y-1 text-amber-700">
          {compile.warnings.map((issue, index) => (
            <li key={`${issue.ruleCode}-${index}`}>
              [{issue.ruleCode}] {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Draft artifact JSON
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto text-xs">
          {JSON.stringify(
            {
              compiledSteps: compile.compiledSteps,
              compiledConditions: compile.compiledConditions,
              compiledEdges: compile.compiledEdges,
              compiledWaits: compile.compiledWaits,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  )
}
