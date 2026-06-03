"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, BookOpen } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthRevenuePlaybookGuidance } from "@/components/growth/growth-revenue-playbook-guidance"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type GrowthRevenuePlaybook,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

export function GrowthRevenuePlaybookCatalog() {
  const [loading, setLoading] = useState(true)
  const [playbooks, setPlaybooks] = useState<GrowthRevenuePlaybook[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/platform/growth/revenue-execution/playbooks", { cache: "no-store" })
      const payload = (await response.json()) as { playbooks?: GrowthRevenuePlaybook[] }
      if (response.ok) {
        setPlaybooks((payload.playbooks ?? []).filter((p) => p.qaMarker === GROWTH_REVENUE_EXECUTION_QA_MARKER))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading playbooks…
      </div>
    )
  }

  return (
    <GrowthEngineCard title="Revenue Playbooks" icon={<BookOpen className="size-4" />}>
      <p className="mb-4 text-sm text-muted-foreground">
        Decision support only — operators execute all actions manually.
      </p>
      <div className="space-y-4">
        {playbooks.map((playbook) => (
          <div key={playbook.key} className="rounded-lg border border-border/70 p-4">
            <p className="font-medium text-sm">{playbook.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{playbook.summary}</p>
            <p className="mt-2 text-sm">
              Next step: <span className="font-medium">{playbook.recommendedNextStep}</span>
            </p>
            <GrowthRevenuePlaybookGuidance playbook={playbook} />
          </div>
        ))}
      </div>
    </GrowthEngineCard>
  )
}
