"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_NEXT_BEST_ACTION_LABELS } from "@/lib/growth/nba-types"
import {
  buildGrowthOpportunityNbaSecondaryActions,
  GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER,
  resolveGrowthOpportunityNbaPrimaryAction,
} from "@/lib/growth/operator-ux/growth-operator-primary-actions-7a2"
import { GROWTH_OPS_HANDOFF_6C_QA_MARKER } from "@/lib/growth/navigation/growth-workspace-operator-links"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_OPPORTUNITY_NEXT_BEST_ACTION_CARD_QA_MARKER =
  "growth-opportunity-next-best-action-card-v1" as const

type GrowthOpportunityNextBestActionCardProps = {
  leadId: string
  companyName?: string | null
}

export function GrowthOpportunityNextBestActionCard({
  leadId,
  companyName,
}: GrowthOpportunityNextBestActionCardProps) {
  const [lead, setLead] = useState<GrowthLead | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; lead?: GrowthLead }
      setLead(res.ok && data.ok && data.lead ? data.lead : null)
    } catch {
      setLead(null)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  const action = lead?.nextBestAction ?? null
  const label = action
    ? GROWTH_NEXT_BEST_ACTION_LABELS[action] ?? action.replace(/_/g, " ")
    : "No persisted next action"
  const reason = lead?.nextBestActionReason ?? "Run research or refresh workflow signals to populate NBA."
  const primaryAction = resolveGrowthOpportunityNbaPrimaryAction(action, leadId)
  const secondaryActions = buildGrowthOpportunityNbaSecondaryActions(leadId, primaryAction.label)

  return (
    <div
      className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10"
      data-qa-marker={GROWTH_OPPORTUNITY_NEXT_BEST_ACTION_CARD_QA_MARKER}
      data-growth-ops-handoff={GROWTH_OPS_HANDOFF_6C_QA_MARKER}
      data-growth-ops-click-reduction={GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next best action</p>
        {action ? <GrowthBadge label="Persisted" tone="healthy" /> : <GrowthBadge label="Awaiting signal" tone="neutral" />}
      </div>
      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading lead NBA…
        </div>
      ) : (
        <>
          {companyName ? <p className="mt-1 text-sm text-muted-foreground">{companyName}</p> : null}
          <p className="mt-2 text-base font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="default" className="h-8 text-xs" asChild>
          <Link href={primaryAction.href}>{primaryAction.label}</Link>
        </Button>
        {secondaryActions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {secondaryActions.map((entry) => (
                <DropdownMenuItem key={entry.id} asChild>
                  <Link href={entry.href}>{entry.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}
