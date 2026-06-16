"use client"

import Link from "next/link"
import { Check, ExternalLink, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  formatGrowthOperatorNotificationEventLabel,
  formatGrowthOperatorNotificationRecipientRoleLabel,
  growthOperatorNotificationSeverityTone,
  type GrowthOperatorNotificationCenterListItem,
} from "@/lib/growth/notifications/growth-notification-center-utils"

export function GrowthNotificationCard({
  item,
  acting,
  onAcknowledge,
  onDismiss,
}: {
  item: GrowthOperatorNotificationCenterListItem
  acting?: "acknowledge" | "dismiss" | null
  onAcknowledge: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const isDismissed = item.status === "dismissed"
  const isAcknowledged = item.status === "acknowledged"

  return (
    <article
      className={`rounded-lg border px-4 py-3 transition-colors ${
        item.status === "unread"
          ? "border-indigo-200/70 bg-indigo-50/40 dark:border-indigo-900/50 dark:bg-indigo-950/20"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={item.severity} tone={growthOperatorNotificationSeverityTone(item.severity)} />
            <GrowthBadge label={formatGrowthOperatorNotificationEventLabel(item.eventType)} tone="neutral" />
            <GrowthBadge
              label={formatGrowthOperatorNotificationRecipientRoleLabel(item.recipientRole)}
              tone="neutral"
            />
            {isAcknowledged ? <GrowthBadge label="Acknowledged" tone="neutral" /> : null}
            {isDismissed ? <GrowthBadge label="Dismissed" tone="neutral" /> : null}
          </div>
          <h3 className="mt-1 font-medium text-foreground">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.body}</p>
          <p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.entityHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={item.entityHref}>
                <ExternalLink className="mr-2 size-4" />
                {item.entityLabel ?? "Open"}
              </Link>
            </Button>
          ) : null}

          {!isDismissed ? (
            <>
              {!isAcknowledged ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting != null}
                  onClick={() => onAcknowledge(item.id)}
                >
                  {acting === "acknowledge" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="mr-2 size-4" />
                      Acknowledge
                    </>
                  )}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                disabled={acting != null}
                onClick={() => onDismiss(item.id)}
              >
                {acting === "dismiss" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <X className="mr-2 size-4" />
                    Dismiss
                  </>
                )}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  )
}
