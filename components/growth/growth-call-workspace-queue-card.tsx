"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Eye, Loader2, Phone, SkipForward, Timer } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  GROWTH_CALL_WORKSPACE_PANEL,
  formatDisplayPhone,
  leadInitials,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type { NativeDialerQueueItemPublicView, NativeDialerQueueMode } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_CALL_WORKSPACE_OPS_QA_MARKER,
  type CallWorkspacePowerDialSettings,
} from "@/lib/growth/native-dialer/call-workspace-operator-types"
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
  previewItemId,
  actionPendingId,
  previewMode,
  onPreviewItem,
  onDialItem,
  onSkipItem,
  onSnoozeItem,
}: {
  items: NativeDialerQueueItemPublicView[]
  dialingId?: string | null
  previewItemId?: string | null
  actionPendingId?: string | null
  previewMode?: boolean
  onPreviewItem: (item: NativeDialerQueueItemPublicView) => void
  onDialItem: (item: NativeDialerQueueItemPublicView) => void
  onSkipItem: (item: NativeDialerQueueItemPublicView) => void
  onSnoozeItem: (item: NativeDialerQueueItemPublicView) => void
}) {
  if (items.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No items in this queue mode.</p>
  }

  return (
    <ul className="max-h-[280px] space-y-1 overflow-auto pr-1">
      {items.map((item) => {
        const isPreviewing = previewItemId === item.id
        const isPending = actionPendingId === item.id || dialingId === item.id
        return (
          <li
            key={item.id}
            className={cn(
              "rounded-lg border px-2 py-2 dark:border-white/5",
              isPreviewing ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/50",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              disabled={isPending}
              onClick={() => (previewMode ? onPreviewItem(item) : onDialItem(item))}
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
            </button>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant={isPreviewing ? "default" : "outline"}
                className="h-7 px-2 text-[11px]"
                disabled={isPending}
                onClick={() => onPreviewItem(item)}
              >
                <Eye className="mr-1 size-3" />
                Preview
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-7 shrink-0 rounded-full border-emerald-500/30 text-emerald-600"
                disabled={isPending}
                onClick={() => onDialItem(item)}
                aria-label={`Call ${item.contactName ?? item.companyName ?? "lead"}`}
              >
                <Phone className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                disabled={isPending}
                onClick={() => onSkipItem(item)}
              >
                <SkipForward className="mr-1 size-3" />
                Skip
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                disabled={isPending}
                onClick={() => onSnoozeItem(item)}
              >
                <Timer className="mr-1 size-3" />
                Snooze
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function GrowthCallWorkspaceQueueCard({
  items,
  loading,
  dialingId,
  previewItemId,
  actionPendingId,
  previewDialEnabled = true,
  powerDialEnabled = false,
  powerDialSettings,
  onPowerDialSettingsChange,
  onPreviewItem,
  onDialItem,
  onSkipItem,
  onSnoozeItem,
}: {
  items: NativeDialerQueueItemPublicView[]
  loading?: boolean
  dialingId?: string | null
  previewItemId?: string | null
  actionPendingId?: string | null
  previewDialEnabled?: boolean
  powerDialEnabled?: boolean
  powerDialSettings?: CallWorkspacePowerDialSettings
  onPowerDialSettingsChange?: (settings: CallWorkspacePowerDialSettings) => void
  onPreviewItem: (item: NativeDialerQueueItemPublicView) => void
  onDialItem: (item: NativeDialerQueueItemPublicView) => void
  onSkipItem: (item: NativeDialerQueueItemPublicView) => void
  onSnoozeItem: (item: NativeDialerQueueItemPublicView) => void
}) {
  const pathname = usePathname()
  const settings = powerDialSettings ?? {
    powerDialAutoAdvance: true,
    powerDialAutoDialDelayMs: 3000,
  }

  return (
    <section
      className={cn(GROWTH_CALL_WORKSPACE_PANEL, "p-4")}
      data-growth-call-workspace-ops-marker={GROWTH_CALL_WORKSPACE_OPS_QA_MARKER}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Call Queue</h3>
        <Link href={growthFeaturePath(pathname, "leads/queue")} className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>

      {powerDialEnabled ? (
        <div
          className="mb-3 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 dark:border-white/5"
          data-qa-action="call-workspace-power-dial-settings"
        >
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="power-dial-auto-advance" className="text-[11px] font-medium text-muted-foreground">
              Auto-advance
            </label>
            <Switch
              id="power-dial-auto-advance"
              checked={settings.powerDialAutoAdvance}
              onCheckedChange={(checked) =>
                onPowerDialSettingsChange?.({
                  ...settings,
                  powerDialAutoAdvance: checked,
                })
              }
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="power-dial-delay-ms" className="shrink-0 text-[11px] text-muted-foreground">
              Delay (ms)
            </label>
            <Input
              id="power-dial-delay-ms"
              type="number"
              min={1000}
              step={500}
              value={settings.powerDialAutoDialDelayMs}
              disabled={!settings.powerDialAutoAdvance}
              className="h-7 text-xs"
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (!Number.isFinite(parsed) || parsed < 0) return
                onPowerDialSettingsChange?.({
                  ...settings,
                  powerDialAutoDialDelayMs: parsed,
                })
              }}
            />
          </div>
        </div>
      ) : null}

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
                previewItemId={previewItemId}
                actionPendingId={actionPendingId}
                previewMode={previewDialEnabled || tab.id === "preview" || tab.id === "power"}
                onPreviewItem={onPreviewItem}
                onDialItem={onDialItem}
                onSkipItem={onSkipItem}
                onSnoozeItem={onSnoozeItem}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  )
}
