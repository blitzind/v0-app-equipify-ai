"use client"

import type { GrowthRevenuePlaybook } from "@/lib/growth/revenue-execution/revenue-execution-types"

export function GrowthRevenuePlaybookGuidance({ playbook }: { playbook: GrowthRevenuePlaybook }) {
  return (
    <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
      {playbook.recommendedMessaging.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended messaging</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {playbook.recommendedMessaging.map((message, index) => (
              <li key={`${playbook.key}-message-${index}`}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {playbook.successCriteria.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Success criteria</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {playbook.successCriteria.map((criterion, index) => (
              <li key={`${playbook.key}-criteria-${index}`}>{criterion}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
