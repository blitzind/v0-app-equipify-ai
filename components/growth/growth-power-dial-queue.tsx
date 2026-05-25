"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { NativeDialerQueueItemPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import { NATIVE_DIALER_QUEUE_MODE_LABELS } from "@/lib/growth/native-dialer/native-dialer-types"

export function GrowthPowerDialQueue({
  items,
  loading,
  onDialItem,
  dialingId,
}: {
  items: NativeDialerQueueItemPublicView[]
  loading?: boolean
  onDialItem: (item: NativeDialerQueueItemPublicView) => void
  dialingId?: string | null
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading queue…
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No queue items — add from Call Queue or execution surfaces.</p>
  }

  return (
    <ul className="max-h-[260px] space-y-2 overflow-auto pr-1">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border/80 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{item.companyName ?? "Lead"}</p>
              <p className="text-xs text-muted-foreground">
                {item.contactName ?? "Contact"} · {item.phoneNumber ?? "No phone"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GrowthBadge label={NATIVE_DIALER_QUEUE_MODE_LABELS[item.queueMode]} tone="neutral" />
              <GrowthBadge label={`P${item.priorityScore}`} tone={item.priorityScore >= 70 ? "attention" : "medium"} />
              <Button
                type="button"
                size="sm"
                disabled={dialingId === item.id}
                onClick={() => onDialItem(item)}
              >
                {dialingId === item.id ? "Dialing…" : "Dial"}
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={item.ctaHref}>Open</Link>
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
