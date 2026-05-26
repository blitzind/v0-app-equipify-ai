"use client"

import { UserRound } from "lucide-react"
import { formatLabel } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"

export function OperatorMotionCard({
  motion,
  owner,
  nextAction,
}: {
  motion: string
  owner: string
  nextAction?: string | null
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended motion</p>
        <p className="mt-1 text-lg font-semibold capitalize text-foreground">{formatLabel(motion)}</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4" />
        <span className="capitalize">{formatLabel(owner)}</span>
      </div>
      {nextAction ? (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
          {nextAction}
        </p>
      ) : null}
    </div>
  )
}
