"use client"

/**
 * Communications Center Phase 1 — right-side detail drawer.
 *
 * Loads the full event from `/communications/[id]` so the drawer has
 * the metadata block (admins-only), AI/automation flags, and the
 * resolved entity label. The drawer is intentionally read-only in
 * Phase 1; the future-prep section advertises retry/resend/SMS/etc.
 * coming later without rendering live actions.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Bot,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { eventTypeMeta } from "@/lib/communications/event-catalog"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { hrefForRelatedEntity } from "@/lib/notifications/event-links"
import { FeedStatusPill } from "./feed-status-pill"
import type { FeedDetailClient, FeedItemClient } from "./types-client"

export function FeedDetailDrawer({
  organizationId,
  initial,
  open,
  onOpenChange,
}: {
  organizationId: string
  initial: FeedItemClient | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [detail, setDetail] = useState<FeedDetailClient | null>(null)
  const [showRawMetadata, setShowRawMetadata] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    if (!open || !initial) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/communications/${encodeURIComponent(initial.id)}`,
          { cache: "no-store" },
        )
        const body = (await res.json()) as {
          item?: FeedDetailClient
          showRawMetadata?: boolean
          error?: string
        }
        if (!res.ok) throw new Error(body.error ?? "Failed to load communication.")
        if (!cancelled) {
          setDetail(body.item ?? null)
          setShowRawMetadata(Boolean(body.showRawMetadata))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, initial, organizationId])

  const item = detail ?? initial
  const meta = item ? eventTypeMeta(item.event_type) : null
  const md = (item?.metadata ?? {}) as Record<string, unknown>
  const workflowName = typeof md.workflow_name === "string" ? (md.workflow_name as string) : null
  const automationId =
    typeof md.automation_id === "string" ? (md.automation_id as string) : null
  const triggerType = typeof md.trigger_type === "string" ? (md.trigger_type as string) : null
  const aiAssistantName =
    typeof md.assistant_name === "string" ? (md.assistant_name as string) : null
  const status = item ? effectiveStatus(item) : "—"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl flex flex-col overflow-hidden">
        <SheetHeader className="space-y-2 pr-6">
          <SheetTitle className="text-base text-pretty">{item?.title ?? "Communication"}</SheetTitle>
          <SheetDescription className="text-xs flex flex-wrap items-center gap-2">
            <FeedStatusPill status={status} />
            {meta ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Sparkles className="w-3 h-3" aria-hidden />
                {meta.label}
              </Badge>
            ) : null}
            {item?.automated ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 border-violet-500/30 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300"
              >
                <Zap className="w-3 h-3" aria-hidden />
                Automated
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Manual send
              </Badge>
            )}
            {detail?.ai_generated ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300"
              >
                <Bot className="w-3 h-3" aria-hidden />
                AI-assisted
              </Badge>
            ) : null}
            {detail?.simulated ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 border-violet-500/30 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300"
              >
                <FlaskConical className="w-3 h-3" aria-hidden />
                Test run
              </Badge>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pt-2 pr-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading communication…
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {item ? (
            <>
              <Section label="Message">
                <div className="space-y-2">
                  {item.summary ? (
                    <p className="text-sm text-foreground/90 leading-relaxed">{item.summary}</p>
                  ) : null}
                  {item.body ? (
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2 font-mono">
                      {item.body}
                    </pre>
                  ) : !item.summary ? (
                    <p className="text-xs text-muted-foreground italic">
                      No message body captured for this event.
                    </p>
                  ) : null}
                </div>
              </Section>

              <Section label="Delivery">
                <DefList
                  items={[
                    ["Status", <FeedStatusPill key="s" status={status} />],
                    ["Channel", item.channel],
                    ["Provider", item.provider],
                    [
                      "Recipient",
                      item.recipient_address ?? item.customer_label ?? "—",
                    ],
                    ["Created", formatRelativeTime(item.created_at)],
                    item.sent_at ? ["Sent", formatRelativeTime(item.sent_at)] : null,
                    item.delivered_at
                      ? ["Delivered", formatRelativeTime(item.delivered_at)]
                      : null,
                    item.failed_at ? ["Failed", formatRelativeTime(item.failed_at)] : null,
                  ].filter(Boolean) as [string, React.ReactNode][]}
                />
                {item.error_message ? (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2 leading-relaxed">
                    {item.error_message}
                  </p>
                ) : null}
              </Section>

              {(item.entity_label ||
                item.customer_label ||
                item.related_entity_type ||
                item.recipient_customer_id) && (
                <Section label="Related">
                  <div className="flex flex-col gap-2">
                    {item.customer_label ? (
                      <EntityLink
                        label="Customer"
                        text={item.customer_label}
                        href={item.customer_href}
                      />
                    ) : null}
                    {item.entity_label ? (
                      <EntityLink
                        label={prettyEntityLabel(item.related_entity_type)}
                        text={item.entity_label}
                        href={
                          item.entity_href ??
                          hrefForRelatedEntity(
                            item.related_entity_type,
                            item.related_entity_id,
                          )
                        }
                      />
                    ) : null}
                  </div>
                </Section>
              )}

              {(item.automated || automationId || workflowName || triggerType) && (
                <Section label="Automation">
                  <div className="rounded-md border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-xs text-violet-900 dark:text-violet-100 space-y-1">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Workflow className="w-3.5 h-3.5" aria-hidden />
                      Triggered by automation
                    </p>
                    {workflowName ? (
                      <p>
                        Workflow: <span className="font-medium">{workflowName}</span>
                      </p>
                    ) : null}
                    {triggerType ? (
                      <p>
                        Trigger: <span className="font-mono">{triggerType}</span>
                      </p>
                    ) : null}
                    {automationId ? (
                      <p className="text-[11px] opacity-80">
                        Open Settings → Workflow Automations to view the run.
                      </p>
                    ) : null}
                  </div>
                </Section>
              )}

              {detail?.ai_generated || aiAssistantName ? (
                <Section label="AI assistant">
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100 space-y-1">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Bot className="w-3.5 h-3.5" aria-hidden />
                      AI-generated content
                    </p>
                    {aiAssistantName ? (
                      <p>
                        Assistant: <span className="font-medium">{aiAssistantName}</span>
                      </p>
                    ) : null}
                  </div>
                </Section>
              ) : null}

              {showRawMetadata && item.metadata ? (
                <Section label="Raw metadata (admin)">
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-3 py-2 font-mono overflow-x-auto">
                    {JSON.stringify(item.metadata, null, 2)}
                  </pre>
                </Section>
              ) : null}

              <Section label="Coming in Phase 2">
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-center gap-1.5">
                    <Send className="w-3 h-3" aria-hidden /> Resend / retry
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3" aria-hidden /> Threaded conversations
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3" aria-hidden /> SMS, voicemail, call logs
                  </li>
                </ul>
              </Section>
            </>
          ) : null}
        </div>

        <Separator />
        <SheetFooter className="gap-2 pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {item?.entity_href ? (
            <Button asChild>
              <Link href={item.entity_href}>
                Open record
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
        {label}
      </p>
      {children}
    </section>
  )
}

function DefList({
  items,
}: {
  items: [string, React.ReactNode][]
}) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
      {items.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="contents">
          <dt className="text-muted-foreground capitalize">{k}</dt>
          <dd className="text-foreground/90 capitalize">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function EntityLink({
  label,
  text,
  href,
}: {
  label: string
  text: string
  href: string | null
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="font-medium truncate">{text}</p>
      </div>
      {href ? (
        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
          <Link href={href}>
            Open
            <ChevronRight className="w-3 h-3 ml-0.5" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

function prettyEntityLabel(type: string | null): string {
  if (!type) return "Record"
  const map: Record<string, string> = {
    work_order: "Work order",
    invoice: "Invoice",
    quote: "Quote",
    customer: "Customer",
    prospect: "Prospect",
    equipment: "Equipment",
    maintenance_plan: "Maintenance plan",
    organization: "Organization",
  }
  return map[type] ?? type.replace(/_/g, " ")
}

function effectiveStatus(item: FeedItemClient | FeedDetailClient): string {
  const md = (item.metadata ?? {}) as Record<string, unknown>
  if (md.simulated === true || md.test === true) return "simulated"
  if (item.event_type.includes("draft") || md.is_draft === true) return "draft"
  return item.delivery_status
}
