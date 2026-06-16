"use client"

import type { GrowthAutomationNode } from "@/lib/growth/automation/growth-automation-types"

type Props = {
  node: GrowthAutomationNode | null
}

export function GrowthAutomationNodeInspector({ node }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-medium">Node inspector</h3>
      {!node ? (
        <p className="mt-2 text-sm text-muted-foreground">Select a node to inspect its config.</p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Type</dt>
            <dd>{node.nodeType}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Label</dt>
            <dd>{node.label || "Untitled"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Validation</dt>
            <dd>{node.validationState}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Config</dt>
            <dd>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-xs">
                {JSON.stringify(node.configJson, null, 2)}
              </pre>
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}
