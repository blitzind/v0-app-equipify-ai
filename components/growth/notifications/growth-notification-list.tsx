"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthNotificationCard } from "@/components/growth/notifications/growth-notification-card"
import type { GrowthOperatorNotificationCenterListItem } from "@/lib/growth/notifications/growth-notification-center-utils"

export function GrowthNotificationList({
  items,
  loading,
  loadingMore,
  hasMore,
  actingId,
  actingAction,
  onLoadMore,
  onAcknowledge,
  onDismiss,
}: {
  items: GrowthOperatorNotificationCenterListItem[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  actingId: string | null
  actingAction: "acknowledge" | "dismiss" | null
  onLoadMore: () => void
  onAcknowledge: (id: string) => void
  onDismiss: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading notifications…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No notifications match the current filters.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <GrowthNotificationCard
          key={item.id}
          item={item}
          acting={actingId === item.id ? actingAction : null}
          onAcknowledge={onAcknowledge}
          onDismiss={onDismiss}
        />
      ))}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}
