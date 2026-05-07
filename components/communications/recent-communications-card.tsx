"use client"

/**
 * Communications Center Phase 1 — embeddable "Recent communications"
 * card for customer/prospect/work-order/invoice/quote drawers and
 * detail pages.
 *
 * Lightweight read-only panel: latest N events tied to the entity,
 * with a "View all" link into the central Communications page
 * pre-filtered by entityType/entityId or customerId. Clicking a row
 * opens the same Phase 1 detail drawer used in the central feed so
 * managers don't bounce between pages.
 *
 * No mutation actions live here — Phase 1 keeps embedded panels
 * read-only by design (Phase 2 will add quick resend / retry).
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Bell, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { FeedRow } from "./feed-row"
import { FeedDetailDrawer } from "./feed-detail-drawer"
import type { FeedItemClient, FeedResponseClient } from "./types-client"
import type { RelatedEntityType } from "@/lib/notifications/types"

export function RecentCommunicationsCard({
  customerId,
  entityType,
  entityId,
  limit = 5,
  title = "Recent communications",
  description,
  className,
}: {
  /** When set, restricts to events with `recipient_customer_id = customerId`. */
  customerId?: string
  /** When set together with `entityId`, restricts to that related entity. */
  entityType?: RelatedEntityType
  entityId?: string
  limit?: number
  title?: string
  description?: string
  className?: string
}) {
  const { organizationId } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const canView = Boolean(permissions.canViewCommunications)

  const [items, setItems] = useState<FeedItemClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FeedItemClient | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!organizationId || !canView) return
    if (!customerId && !(entityType && entityId)) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set("limit", String(limit))
        if (customerId) params.set("customerId", customerId)
        if (entityType) params.set("entityType", entityType)
        if (entityId) params.set("entityId", entityId)
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/communications/feed?${params.toString()}`,
          { cache: "no-store" },
        )
        const body = (await res.json()) as FeedResponseClient & { error?: string }
        if (!res.ok) throw new Error(body.error ?? "Failed to load communications.")
        if (!cancelled) setItems(body.items ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, canView, customerId, entityType, entityId, limit])

  if (!canView || !organizationId) return null

  const viewAllParams = new URLSearchParams()
  if (customerId) viewAllParams.set("customerId", customerId)
  if (entityType) viewAllParams.set("entityType", entityType)
  if (entityId) viewAllParams.set("entityId", entityId)

  return (
    <section
      className={
        "rounded-xl border border-border bg-card overflow-hidden " +
        (className ?? "")
      }
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
          ) : null}
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
          <Link href={`/communications?${viewAllParams.toString()}`}>
            View all
            <ArrowRight className="w-3 h-3" aria-hidden />
          </Link>
        </Button>
      </header>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-6 text-muted-foreground text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="px-4 py-4 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground space-y-1.5">
          <Bell className="w-6 h-6 mx-auto text-muted-foreground/50" aria-hidden />
          No communications logged yet.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <FeedRow
              key={it.id}
              item={it}
              compact
              onSelect={(item) => {
                setSelected(item)
                setDrawerOpen(true)
              }}
            />
          ))}
        </ul>
      )}
      <FeedDetailDrawer
        organizationId={organizationId}
        initial={selected}
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o)
          if (!o) setSelected(null)
        }}
      />
    </section>
  )
}
