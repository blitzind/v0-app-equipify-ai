"use client"

import Link from "next/link"
import { Archive, GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthAutomationPublishStatusBadge } from "@/components/growth/automation/growth-automation-publish-status-badge"
import type { GrowthAutomationFlow } from "@/lib/growth/automation/growth-automation-types"

type Props = {
  flow: GrowthAutomationFlow
  busy?: boolean
  onArchive?: () => void
}

export function GrowthAutomationFlowCard({ flow, busy, onArchive }: Props) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <GitBranch size={16} />
          </span>
          <div>
            <h3 className="font-medium">{flow.name}</h3>
            {flow.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{flow.description}</p>
            ) : null}
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <GrowthAutomationPublishStatusBadge status={flow.status} />
              {flow.publishedVersionId ? (
                <span className="text-[10px] text-muted-foreground">published snapshot saved</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/growth/automation/${flow.id}`}>Open</Link>
          </Button>
          {flow.status !== "archived" && onArchive ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onArchive}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
              Archive
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
