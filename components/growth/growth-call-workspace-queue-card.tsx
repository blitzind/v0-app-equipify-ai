"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Loader2, Phone } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  GROWTH_CALL_WORKSPACE_PANEL,
  formatDisplayPhone,
  leadInitials,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type { NativeDialerQueueItemPublicView, NativeDialerQueueMode } from "@/lib/growth/native-dialer/native-dialer-types"
import { cn } from "@/lib/utils"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

const QUEUE_TAB_MODES: { id: NativeDialerQueueMode | "all"; label: string }[] = [
  { id: "power", label: "Power Dial" },
  { id: "preview", label: "Preview" },
  { id: "manual", label: "Manual" },
  { id: "callback", label: "Callback" },
]

function filterQueueItems(items: NativeDialerQueueItemPublicView[], mode: NativeDialerQueueMode | "all") {
  if (mode === "all") return items
  if (mode === "callback") {
    return items.filter((item) => item.queueMode === "callback" || item.queueMode === "missed_callback")
  }
  return items.filter((item) => item.queueMode === mode)
}

function QueueList({
  items,
  dialingId,
  onDialItem,
}: {
  items: NativeDialerQueueItemPublicView[]
  dialingId?: string | null
  onDialItem: (item: NativeDialerQueueItemPublicView) => void
}) {
  if (items.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No items in this queue mode.</p>
  }

  return (
    <ul className="max-h-[280px] space-y-1 overflow-auto pr-1">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-2 rounded-lg border border-border/50 px-2 py-2 dark:border-white/5"
        >
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {leadInitials(item.contactName, item.companyName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.contactName ?? "Contact"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.companyName ?? "Lead"} · {formatDisplayPhone(item.phoneNumber)}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 shrink-0 rounded-full border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
            disabled={dialingId === item.id}
            onClick={() => onDialItem(item)}
            aria-label={`Call ${item.contactName ?? item.companyName ?? "lead"}`}
          >
            <Phone className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function GrowthCallWorkspaceQueueCard({
  items,
  loading,
  dialingId,
  onDialItem,
}: {
  items: NativeDialerQueueItemPublicView[]
  loading?: boolean
  dialingId?: string | null
  onDialItem: (item: NativeDialerQueueItemPublicView) => void
}) {
  const pathname = usePathname()

  return (
    <section className={cn(GROWTH_CALL_WORKSPACE_PANEL, "p-4")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Call Queue</h3>
        <Link href={growthFeaturePath(pathname, "leads/queue")} className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading queue…
        </div>
      ) : (
        <Tabs defaultValue="power" className="gap-2">
          <TabsList className="grid h-8 w-full grid-cols-4 gap-0.5 p-0.5">
            {QUEUE_TAB_MODES.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="h-7 px-1 text-[11px]">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {QUEUE_TAB_MODES.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-2">
              <p className="mb-2 text-[11px] text-muted-foreground">
                {filterQueueItems(items, tab.id).length} items in queue
              </p>
              <QueueList
                items={filterQueueItems(items, tab.id)}
                dialingId={dialingId}
                onDialItem={onDialItem}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  )
}
