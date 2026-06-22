"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  DEFAULT_GROWTH_NOTIFICATION_CENTER_FILTERS,
  GrowthNotificationFilters,
  type GrowthNotificationCenterFilters,
} from "@/components/growth/notifications/growth-notification-filters"
import { GrowthNotificationList } from "@/components/growth/notifications/growth-notification-list"
import type { GrowthOperatorNotificationCenterListItem } from "@/lib/growth/notifications/growth-notification-center-utils"
import type { GrowthOperatorNotificationUnreadCounts } from "@/lib/growth/notifications/growth-notification-persistence-types"
import { GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER } from "@/lib/growth/notifications/growth-notification-persistence-types"

const PAGE_SIZE = 25

function buildListParams(filters: GrowthNotificationCenterFilters, offset: number): URLSearchParams {
  const params = new URLSearchParams({
    status: filters.status,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  })
  if (filters.severity) params.set("severity", filters.severity)
  if (filters.event) params.set("event", filters.event)
  if (filters.recipientRole) params.set("recipientRole", filters.recipientRole)
  return params
}

function patchItemStatus(
  item: GrowthOperatorNotificationCenterListItem,
  action: "acknowledge" | "dismiss",
): GrowthOperatorNotificationCenterListItem {
  const now = new Date().toISOString()
  if (action === "dismiss") {
    return { ...item, status: "dismissed", dismissedAt: now, acknowledgedAt: now }
  }
  return { ...item, status: "acknowledged", acknowledgedAt: now }
}

export function GrowthNotificationCenter() {
  const [filters, setFilters] = useState<GrowthNotificationCenterFilters>(
    DEFAULT_GROWTH_NOTIFICATION_CENTER_FILTERS,
  )
  const [items, setItems] = useState<GrowthOperatorNotificationCenterListItem[]>([])
  const [counts, setCounts] = useState<GrowthOperatorNotificationUnreadCounts | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [actingAction, setActingAction] = useState<"acknowledge" | "dismiss" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filterKey = useMemo(
    () => `${filters.status}|${filters.severity}|${filters.event}|${filters.recipientRole}`,
    [filters],
  )

  const loadUnreadCounts = useCallback(async () => {
    const res = await fetch("/api/platform/growth/notifications/unread", { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      counts?: GrowthOperatorNotificationUnreadCounts
      message?: string
    }
    if (!res.ok || !data.ok || !data.counts) return
    setCounts(data.counts)
  }, [])

  const loadPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      try {
        const params = buildListParams(filters, nextOffset)
        const res = await fetch(`/api/platform/growth/notifications?${params.toString()}`, {
          cache: "no-store",
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          items?: GrowthOperatorNotificationCenterListItem[]
          hasMore?: boolean
          message?: string
        }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load notifications.")

        const nextItems = data.items ?? []
        setItems((current) => (append ? [...current, ...nextItems] : nextItems))
        setHasMore(Boolean(data.hasMore))
        setOffset(nextOffset)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load notifications.")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters],
  )

  useEffect(() => {
    void loadPage(0, false)
    void loadUnreadCounts()
  }, [filterKey, loadPage, loadUnreadCounts])

  async function runNotificationAction(id: string, action: "acknowledge" | "dismiss") {
    const previousItems = items
    const previousCounts = counts
    setActingId(id)
    setActingAction(action)
    setError(null)

    setItems((current) =>
      current.map((item) => (item.id === id ? patchItemStatus(item, action) : item)),
    )
    if (action === "acknowledge" && counts) {
      setCounts({
        ...counts,
        unreadTotal: Math.max(0, counts.unreadTotal - 1),
      })
    }
    if (action === "dismiss" && counts) {
      setCounts({
        ...counts,
        unreadTotal: Math.max(0, counts.unreadTotal - 1),
      })
    }

    try {
      const res = await fetch(`/api/platform/growth/notifications/${id}/${action}`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? `Could not ${action} notification.`)

      if (filters.status === "unread") {
        setItems((current) => current.filter((item) => item.id !== id))
      }

      await loadUnreadCounts()
    } catch (actionError) {
      setItems(previousItems)
      setCounts(previousCounts)
      setError(actionError instanceof Error ? actionError.message : `Could not ${action} notification.`)
    } finally {
      setActingId(null)
      setActingAction(null)
    }
  }

  return (
    <GrowthEngineCard title="Operator Notifications">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
            <Bell size={17} />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">
              Growth operator notification center — read and acknowledge persisted SN-2 events.
            </p>
            <p className="text-xs text-muted-foreground">{GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => {
            void loadPage(0, false)
            void loadUnreadCounts()
          }}
        >
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>

      {counts ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Unread" value={counts.unreadTotal} />
          <StatTile label="Critical" value={counts.unreadCritical} />
          <StatTile label="High" value={counts.unreadHigh} />
          <StatTile label="Medium" value={counts.unreadMedium} />
          <StatTile label="Low" value={counts.unreadLow} />
        </div>
      ) : null}

      <div className="mb-4">
        <GrowthNotificationFilters filters={filters} onChange={setFilters} />
      </div>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <GrowthNotificationList
        items={items}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        actingId={actingId}
        actingAction={actingAction}
        onLoadMore={() => void loadPage(offset + PAGE_SIZE, true)}
        onAcknowledge={(id) => void runNotificationAction(id, "acknowledge")}
        onDismiss={(id) => void runNotificationAction(id, "dismiss")}
      />
    </GrowthEngineCard>
  )
}
