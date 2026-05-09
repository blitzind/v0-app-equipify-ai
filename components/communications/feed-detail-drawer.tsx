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

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  ExternalLink,
  Copy,
  FlaskConical,
  Loader2,
  RefreshCw,
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { eventTypeMeta } from "@/lib/communications/event-catalog"
import { buildLifecycle, explainFailure } from "@/lib/communications/lifecycle"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import { hrefForRelatedEntity } from "@/lib/notifications/event-links"
import { COMMUNICATION_KIND_LABEL } from "@/lib/communications/communication-kind"
import { FeedStatusPill } from "./feed-status-pill"
import { LifecycleTimeline } from "./lifecycle-timeline"
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
  const { toast } = useToast()
  const { permissions } = useOrgPermissions()
  const canManageCommunications = Boolean(permissions.canManageCommunications)
  const canViewCommunications = Boolean(permissions.canViewCommunications)

  const [detail, setDetail] = useState<FeedDetailClient | null>(null)
  const [showRawMetadata, setShowRawMetadata] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryDoneAt, setRetryDoneAt] = useState<string | null>(null)
  const [showMeta, setShowMeta] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendDoneAt, setSendDoneAt] = useState<string | null>(null)

  const [aiAssistOutput, setAiAssistOutput] = useState("")
  const [aiAssistBusy, setAiAssistBusy] = useState(false)
  const [aiAssistTone, setAiAssistTone] = useState<"professional" | "friendly" | "concise">(
    "professional",
  )

  const activeCommunicationId = detail?.id ?? initial?.id ?? null

  const runAiAssist = useCallback(
    async (action: "summarize" | "draft_reply" | "regenerate_tone") => {
      if (!activeCommunicationId || !organizationId || !canViewCommunications) return
      setAiAssistBusy(true)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/communications/${encodeURIComponent(activeCommunicationId)}/ai-assist`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              tone: action === "regenerate_tone" ? aiAssistTone : undefined,
            }),
          },
        )
        const body = (await res.json()) as { ok?: boolean; text?: string; error?: string; message?: string }
        if (!res.ok) throw new Error(body.message ?? body.error ?? "AI assist failed.")
        setAiAssistOutput(body.text ?? "")
        toast({
          title:
            action === "summarize"
              ? "Summary ready"
              : action === "draft_reply"
                ? "Draft reply generated"
                : "Tone updated",
          description: "Review the text below — nothing was sent automatically.",
        })
      } catch (e) {
        toast({
          title: "AI assist failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        })
      } finally {
        setAiAssistBusy(false)
      }
    },
    [
      activeCommunicationId,
      organizationId,
      canViewCommunications,
      aiAssistTone,
      toast,
    ],
  )

  useEffect(() => {
    setDetail(null)
    setError(null)
    setRetryDoneAt(null)
    setShowMeta(false)
    setSendDoneAt(null)
    setAiAssistOutput("")
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

  async function requeueFailedDelivery() {
    if (!detail || !canManageCommunications) return
    setRetrying(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/communications/${encodeURIComponent(detail.id)}/retry`,
        { method: "POST" },
      )
      const body = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Retry failed.")
      toast({ title: "Retry queued", description: body.message })
      setRetryDoneAt(new Date().toISOString())
      // Reflect the new status locally so the pill updates without
      // needing to refetch.
      setDetail({ ...detail, delivery_status: "queued", error_message: null })
    } catch (e) {
      toast({
        title: "Retry failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setRetrying(false)
    }
  }

  async function sendDraftNow() {
    if (!detail || !canManageCommunications) return
    setSending(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/communications/${encodeURIComponent(detail.id)}/send`,
        { method: "POST" },
      )
      const body = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || body.ok === false) {
        throw new Error(body.message ?? body.error ?? "Send failed.")
      }
      toast({ title: "Draft sent", description: body.message })
      setSendDoneAt(new Date().toISOString())
      const sentAt = new Date().toISOString()
      setDetail({
        ...detail,
        delivery_status: "sent",
        sent_at: sentAt,
        metadata: {
          ...((detail.metadata ?? {}) as Record<string, unknown>),
          is_draft: false,
          handoff_completed_at: sentAt,
        } as Record<string, unknown>,
      })
    } catch (e) {
      toast({
        title: "Could not send draft",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

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
  const lifecycle = useMemo(
    () =>
      item
        ? buildLifecycle({
            delivery_status: item.delivery_status,
            event_type: item.event_type,
            created_at: item.created_at,
            scheduled_at: item.scheduled_at ?? null,
            sent_at: item.sent_at ?? null,
            delivered_at: item.delivered_at ?? null,
            failed_at: item.failed_at ?? null,
            error_message: item.error_message ?? null,
            metadata: (item.metadata ?? null) as Record<string, unknown> | null,
          })
        : [],
    [item],
  )
  const failureHint = explainFailure(item?.error_message)
  const draftReady = item ? isDraft(item) && canSendDraft(item) : false
  const draftBlocker = item && isDraft(item) ? draftBlockerReason(item) : null
  const handoffRouteLabel =
    typeof md.handoff_route_label === "string" ? (md.handoff_route_label as string) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl flex flex-col overflow-hidden">
        <SheetHeader className="space-y-2 pr-6">
          <SheetTitle className="text-base text-pretty">{item?.title ?? "Communication"}</SheetTitle>
          <SheetDescription className="text-xs flex flex-wrap items-center gap-2">
            <FeedStatusPill status={status} />
            {item ? (
              <>
                <Badge variant="secondary" className="text-[10px] font-normal capitalize">
                  {item.direction === "inbound" ? "Inbound" : "Outbound"}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {COMMUNICATION_KIND_LABEL[item.communication_kind]}
                </Badge>
              </>
            ) : null}
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
                    handoffRouteLabel
                      ? ["Hand-off", `Sent via ${handoffRouteLabel}`]
                      : null,
                  ].filter(Boolean) as [string, React.ReactNode][]}
                />
                {item.error_message ? (
                  <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/[0.05] px-3 py-2 text-xs space-y-1">
                    <p className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-300">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                      Last failure
                    </p>
                    <p className="text-red-700/90 dark:text-red-300/90 leading-relaxed">
                      {item.error_message}
                    </p>
                    {failureHint ? (
                      <p className="text-[11px] text-red-700/80 dark:text-red-300/80 leading-snug">
                        {failureHint}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Section>

              {lifecycle.length > 0 ? (
                <Section label="Lifecycle">
                  <LifecycleTimeline steps={lifecycle} />
                </Section>
              ) : null}

              {isDraft(item) ? (
                <Section label="Draft hand-off">
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs space-y-1">
                    <p className="text-foreground/90">
                      Drafts hand off to the existing live send route based on the
                      related entity. Sending is permission-gated and never auto-fires.
                    </p>
                    {draftBlocker ? (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                        {draftBlocker}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Ready to dispatch via{" "}
                        <span className="font-medium">
                          {prettyEntityLabel(item.related_entity_type).toLowerCase()}
                        </span>
                        .
                      </p>
                    )}
                  </div>
                </Section>
              ) : null}

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

              {item && canViewCommunications ? (
                <Section label="AI assist (does not send)">
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2 space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Summaries and drafts are for review only. Paste into compose or your mail client
                      after approval — outbound sending stays on existing routes.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={aiAssistBusy}
                        onClick={() => void runAiAssist("summarize")}
                        className="gap-1"
                      >
                        {aiAssistBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" aria-hidden />
                        )}
                        Summarize
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={aiAssistBusy}
                        onClick={() => void runAiAssist("draft_reply")}
                        className="gap-1"
                      >
                        <Bot className="w-3.5 h-3.5" aria-hidden />
                        Draft customer reply
                      </Button>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={aiAssistTone}
                          onValueChange={(v) =>
                            setAiAssistTone(v as "professional" | "friendly" | "concise")
                          }
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="Tone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="concise">Concise</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={aiAssistBusy}
                          onClick={() => void runAiAssist("regenerate_tone")}
                          className="gap-1"
                        >
                          Regenerate tone
                        </Button>
                      </div>
                    </div>
                    {aiAssistOutput ? (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          readOnly
                          value={aiAssistOutput}
                          rows={10}
                          className="text-xs font-mono leading-relaxed min-h-[120px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1"
                          onClick={() => {
                            void navigator.clipboard.writeText(aiAssistOutput)
                            toast({ title: "Copied to clipboard" })
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" aria-hidden />
                          Copy
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Section>
              ) : null}

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
                  <details
                    open={showMeta}
                    onToggle={(e) => setShowMeta((e.target as HTMLDetailsElement).open)}
                    className="rounded-md border border-border bg-muted/30"
                  >
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                      {showMeta ? "Hide JSON" : "Show JSON"}
                    </summary>
                    <pre className="text-[11px] leading-relaxed whitespace-pre-wrap rounded-b-md border-t border-border bg-muted/30 px-3 py-2 font-mono overflow-x-auto">
                      {JSON.stringify(item.metadata, null, 2)}
                    </pre>
                  </details>
                  <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                    Raw metadata is restricted to admins / managers. Provider IDs and signed
                    URLs are intentionally redacted from this view.
                  </p>
                </Section>
              ) : null}

            </>
          ) : null}
        </div>

        <Separator />
        <SheetFooter className="gap-2 pt-3 flex-col sm:flex-row sm:items-center">
          {item && isDraft(item) ? (
            canManageCommunications ? (
              <Button
                type="button"
                onClick={() => void sendDraftNow()}
                disabled={sending || Boolean(sendDoneAt) || !draftReady}
                className="gap-1.5"
                title={draftBlocker ?? undefined}
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" aria-hidden />
                )}
                {sendDoneAt ? "Draft sent" : "Send draft now"}
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground sm:mr-auto">
                Sending drafts is restricted to managers and above.
              </p>
            )
          ) : null}

          {item && canManageCommunications && isRetriable(item) ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void requeueFailedDelivery()}
              disabled={retrying || Boolean(retryDoneAt)}
              className="gap-1.5"
            >
              {retrying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
              )}
              {retryDoneAt ? "Retry queued" : "Retry / resend"}
            </Button>
          ) : item &&
            (item.delivery_status === "queued" || item.delivery_status === "pending") &&
            !isDraft(item) ? (
            <p className="text-[11px] text-muted-foreground sm:mr-auto">
              Already in flight — wait for delivery to settle before retrying.
            </p>
          ) : item && isRetriable(item) ? (
            <p className="text-[11px] text-muted-foreground sm:mr-auto">
              Retry is restricted to managers and above.
            </p>
          ) : null}
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
  const md = (item.metadata ?? {}) as Record<string, unknown> | null
  if (md && (md.simulated === true || md.test === true)) return "simulated"
  if (item.event_type.includes("draft") || (md && md.is_draft === true)) return "draft"
  return item.delivery_status
}

function isRetriable(item: FeedItemClient | FeedDetailClient): boolean {
  return item.delivery_status === "failed" || item.delivery_status === "bounced"
}

/**
 * Phase 3 — recognize draft rows produced by the Phase 2 compose
 * dialog. Drafts use `event_type='communication_draft'` and/or
 * `metadata.is_draft=true` and stay in `delivery_status='pending'`
 * until they are dispatched.
 */
function isDraft(item: FeedItemClient | FeedDetailClient): boolean {
  if (item.event_type === "communication_draft") return true
  const md = item.metadata as Record<string, unknown> | null
  return Boolean(md && md.is_draft === true)
}

/** Whether the draft has the minimum context required to dispatch. */
function canSendDraft(item: FeedItemClient | FeedDetailClient): boolean {
  if (!item.related_entity_type || !item.related_entity_id) return false
  if (item.related_entity_type === "prospect") return true
  return Boolean(item.recipient_address?.trim())
}

/** Manager-friendly explanation for why a draft can't be sent yet. */
function draftBlockerReason(
  item: FeedItemClient | FeedDetailClient,
): string | null {
  if (!item.related_entity_type || !item.related_entity_id) {
    return "Link this draft to an invoice, quote, work order, or prospect before sending."
  }
  if (item.related_entity_type !== "prospect" && !item.recipient_address?.trim()) {
    return "Add a recipient email before sending."
  }
  const supported = new Set(["invoice", "quote", "work_order", "prospect"])
  if (!supported.has(item.related_entity_type)) {
    return `No live send route is wired for ${item.related_entity_type} drafts yet.`
  }
  return null
}
