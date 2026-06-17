"use client"

import type { LucideIcon } from "lucide-react"
import {
  FileText,
  GitBranch,
  Handshake,
  Inbox,
  Layers,
  LayoutTemplate,
  MessageSquare,
  Phone,
  Target,
  Users,
  Wrench,
} from "lucide-react"

const SEARCH_RESULT_ICONS: Record<string, LucideIcon> = {
  growth_lead: Target,
  growth_campaign: GitBranch,
  growth_inbox_thread: Inbox,
  growth_call: Phone,
  growth_meeting: Users,
  growth_share_page: FileText,
  growth_media_asset: Layers,
  growth_template: LayoutTemplate,
  growth_opportunity: Target,
  growth_conversation: MessageSquare,
  growth_relationship: Handshake,
  customer: Users,
  equipment: Wrench,
  work_order: Wrench,
}

export function WorkspaceSearchResultIcon({ kind }: { kind: string }) {
  const Icon = SEARCH_RESULT_ICONS[kind] ?? Target
  return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
}

export function WorkspaceSearchResultsSkeleton() {
  return (
    <div className="space-y-2 px-2 py-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2 rounded-md px-2 py-2">
          <div className="size-4 shrink-0 rounded bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-4/5 rounded bg-muted/80 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
