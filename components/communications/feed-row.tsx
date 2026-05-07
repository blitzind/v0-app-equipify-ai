"use client"

/**
 * Communications Center Phase 1 — single timeline row.
 *
 * Renders one event in the unified feed. Click anywhere on the row
 * to open the detail drawer. The "View record" / "View customer"
 * deep-links short-circuit propagation so they navigate without
 * also opening the drawer.
 */

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Bot, ChevronRight, FlaskConical, Sparkles, Zap } from "lucide-react"
import { communicationEventPresentation } from "@/lib/notifications/event-icons"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { eventTypeMeta } from "@/lib/communications/event-catalog"
import { FeedStatusPill } from "./feed-status-pill"
import type { FeedItemClient } from "./types-client"

export function FeedRow({
  item,
  onSelect,
  compact = false,
}: {
  item: FeedItemClient
  onSelect: (item: FeedItemClient) => void
  /** Compact mode used inside embedded "Recent communications" cards. */
  compact?: boolean
}) {
  const { Icon, iconColor } = communicationEventPresentation(item.event_type, item.channel)
  const meta = eventTypeMeta(item.event_type)
  const status = effectiveStatus(item)
  const isFailed = status === "failed" || status === "bounced"
  const isAi = isAiGenerated(item)
  const isSimulated = isSimulated_(item)
  const md = (item.metadata ?? {}) as Record<string, unknown>
  const workflowName = typeof md.workflow_name === "string" ? (md.workflow_name as string) : null

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(item)
        }
      }}
      className={cn(
        "group flex flex-col sm:flex-row sm:items-start gap-3 transition-colors cursor-pointer",
        compact ? "px-3 py-3" : "px-4 py-4",
        "hover:bg-muted/40 focus:bg-muted/50 focus:outline-none",
        isFailed && "border-l-2 border-l-red-500/60",
      )}
    >
      <div className="flex gap-3 flex-1 min-w-0">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted",
            compact && "h-8 w-8",
          )}
          aria-hidden
        >
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "text-sm font-semibold text-foreground line-clamp-1",
                compact && "text-[13px]",
              )}
            >
              {item.title}
            </span>
            <FeedStatusPill status={isSimulated ? "simulated" : status} />
            {item.automated ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 border-violet-500/30 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300"
                title={
                  workflowName
                    ? `Triggered by automation: ${workflowName}`
                    : "Triggered by automation"
                }
              >
                <Zap className="w-3 h-3" aria-hidden />
                Automated
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Manual
              </Badge>
            )}
            {isAi ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300"
              >
                <Bot className="w-3 h-3" aria-hidden />
                AI-assisted
              </Badge>
            ) : null}
            {isSimulated ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 border-violet-500/30 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300"
              >
                <FlaskConical className="w-3 h-3" aria-hidden />
                Test run
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-muted-foreground/60" aria-hidden />
              {meta.label}
            </span>
            {item.customer_label ? (
              <>
                <span aria-hidden>·</span>
                {item.customer_href ? (
                  <Link
                    href={item.customer_href}
                    onClick={(e) => e.stopPropagation()}
                    className="text-foreground/80 hover:text-foreground hover:underline underline-offset-2"
                  >
                    {item.customer_label}
                  </Link>
                ) : (
                  <span className="text-foreground/80">{item.customer_label}</span>
                )}
              </>
            ) : item.recipient_address ? (
              <>
                <span aria-hidden>·</span>
                <span>{item.recipient_address}</span>
              </>
            ) : null}
            {item.entity_label ? (
              <>
                <span aria-hidden>·</span>
                {item.entity_href ? (
                  <Link
                    href={item.entity_href}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 text-primary hover:underline underline-offset-2"
                  >
                    {item.entity_label}
                    <ChevronRight className="w-3 h-3" aria-hidden />
                  </Link>
                ) : (
                  <span>{item.entity_label}</span>
                )}
              </>
            ) : null}
          </div>

          {!compact && (item.summary || item.body) ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.summary ?? item.body}
            </p>
          ) : null}

          {isFailed && item.error_message ? (
            <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2 mt-1">
              {item.error_message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex sm:flex-col items-center sm:items-end gap-1 shrink-0 sm:text-right pl-12 sm:pl-0">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {formatRelativeTime(item.created_at)}
        </span>
      </div>
    </li>
  )
}

function effectiveStatus(item: FeedItemClient): string {
  if (isSimulated_(item)) return "simulated"
  if (isDraft(item)) return "draft"
  return item.delivery_status
}

function isSimulated_(item: FeedItemClient): boolean {
  const md = item.metadata as Record<string, unknown> | null
  return Boolean(md && (md.simulated === true || md.test === true))
}

function isDraft(item: FeedItemClient): boolean {
  if (item.event_type.includes("draft")) return true
  const md = item.metadata as Record<string, unknown> | null
  return Boolean(md && md.is_draft === true)
}

function isAiGenerated(item: FeedItemClient): boolean {
  if (item.event_type.startsWith("prospect_ai_") || item.event_type.startsWith("ai_")) return true
  const md = item.metadata as Record<string, unknown> | null
  return Boolean(md && md.ai_generated === true)
}
