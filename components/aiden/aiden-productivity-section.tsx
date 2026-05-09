"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, ChevronDown, Copy, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PRODUCTIVITY_PLAN_MESSAGE } from "@/lib/aiden/productivity-messages"
import type {
  AidenCustomerSummaryAnswer,
  AidenDraftGenerationAnswer,
  AidenWorkOrderProductivityAnswer,
  DraftKind,
} from "@/lib/aiden/productivity-schemas"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const DRAFT_LABELS: Record<DraftKind, string> = {
  service_note: "Service note",
  customer_update: "Customer update",
  quote_explanation: "Quote explanation",
  payment_reminder: "Payment reminder copy",
  technician_handoff: "Technician handoff",
}

type Props =
  | {
      organizationId: string
      mode: "customer"
      customerId: string
    }
  | {
      organizationId: string
      mode: "work_order"
      workOrderId: string
    }

function BulletList({ items, title }: { items: string[]; title: string }) {
  if (!items.length) return null
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="list-disc pl-4 text-sm space-y-1">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  )
}

export function AidenProductivitySection(props: Props) {
  const { toast } = useToast()
  const [eligibilityReady, setEligibilityReady] = useState(false)
  const [productivityEnabled, setProductivityEnabled] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [customerAnswer, setCustomerAnswer] = useState<AidenCustomerSummaryAnswer | null>(null)
  const [workOrderAnswer, setWorkOrderAnswer] = useState<AidenWorkOrderProductivityAnswer | null>(null)
  const [draftAnswer, setDraftAnswer] = useState<AidenDraftGenerationAnswer | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(props.organizationId)}/aiden/productivity/eligibility`,
          { method: "GET" },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          productivityEnabled?: boolean
        }
        if (!cancelled) {
          setProductivityEnabled(Boolean(res.ok && data.ok && data.productivityEnabled))
          setEligibilityReady(true)
        }
      } catch {
        if (!cancelled) {
          setProductivityEnabled(false)
          setEligibilityReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.organizationId])

  const copyText = useCallback(
    async (label: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        toast({ title: "Copied", description: `${label} copied to clipboard.` })
      } catch {
        toast({ variant: "destructive", title: "Copy failed", description: "Clipboard unavailable." })
      }
    },
    [toast],
  )

  async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`/api/organizations/${encodeURIComponent(props.organizationId)}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      answer?: T
      message?: string
      error?: string
    }
    if (!res.ok || !data.ok || data.answer === undefined) {
      throw new Error(data.message ?? data.error ?? "Request failed.")
    }
    return data.answer
  }

  async function runCustomerSummary() {
    if (props.mode !== "customer") return
    setBusy("summary")
    setError(null)
    setCustomerAnswer(null)
    try {
      const answer = await postJson<AidenCustomerSummaryAnswer>("/aiden/productivity/customer-summary", {
        customerId: props.customerId,
      })
      setCustomerAnswer(answer)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate summary."
      setError(msg)
      toast({ variant: "destructive", title: "Summary unavailable", description: msg })
    } finally {
      setBusy(null)
    }
  }

  async function runWorkOrderSummary() {
    if (props.mode !== "work_order") return
    setBusy("summary")
    setError(null)
    setWorkOrderAnswer(null)
    try {
      const answer = await postJson<AidenWorkOrderProductivityAnswer>("/aiden/productivity/work-order-summary", {
        workOrderId: props.workOrderId,
      })
      setWorkOrderAnswer(answer)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate summary."
      setError(msg)
      toast({ variant: "destructive", title: "Summary unavailable", description: msg })
    } finally {
      setBusy(null)
    }
  }

  async function runDraft(kind: DraftKind) {
    setBusy(`draft:${kind}`)
    setError(null)
    setDraftAnswer(null)
    try {
      const body: Record<string, unknown> = { draftKind: kind }
      if (props.mode === "customer") {
        body.customerId = props.customerId
      } else {
        body.workOrderId = props.workOrderId
      }
      const answer = await postJson<AidenDraftGenerationAnswer>("/aiden/productivity/draft", body)
      setDraftAnswer(answer)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate draft."
      setError(msg)
      toast({ variant: "destructive", title: "Draft unavailable", description: msg })
    } finally {
      setBusy(null)
    }
  }

  const planGateCard =
    eligibilityReady && !productivityEnabled ?
      <p className="text-sm text-muted-foreground leading-relaxed">{PRODUCTIVITY_PLAN_MESSAGE}</p>
    : null

  const summaryPrimary =
    props.mode === "customer" ?
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="gap-1.5"
        disabled={!productivityEnabled || Boolean(busy)}
        onClick={() => void runCustomerSummary()}
      >
        {busy === "summary" ?
          <Loader2 className="size-3.5 animate-spin" />
        : <Sparkles className="size-3.5" />}
        Customer summary
      </Button>
    : <Button
        type="button"
        size="sm"
        variant="secondary"
        className="gap-1.5"
        disabled={!productivityEnabled || Boolean(busy)}
        onClick={() => void runWorkOrderSummary()}
      >
        {busy === "summary" ?
          <Loader2 className="size-3.5 animate-spin" />
        : <Sparkles className="size-3.5" />}
        Work order summary
      </Button>

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border bg-muted/20">
        <div className="flex items-start gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-400">
            <Bot size={16} aria-hidden />
          </span>
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base">AIden productivity</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Read-only summaries and copy-ready drafts — nothing is saved or sent automatically.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {!eligibilityReady ?
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Checking workspace…
          </div>
        : null}

        {planGateCard}

        {eligibilityReady && productivityEnabled ?
          <div className="flex flex-wrap gap-2 items-center">
            {summaryPrimary}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={Boolean(busy)}
                >
                  Draft… <ChevronDown className="size-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {(Object.keys(DRAFT_LABELS) as DraftKind[]).map((kind) => (
                  <DropdownMenuItem
                    key={kind}
                    disabled={Boolean(busy)}
                    onClick={() => void runDraft(kind)}
                  >
                    {DRAFT_LABELS[kind]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        : null}

        {error ?
          <p className="text-xs text-destructive">{error}</p>
        : null}

        {customerAnswer ?
          <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex justify-between gap-2">
              <p className="font-medium text-foreground">Customer summary</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() =>
                  void copyText(
                    "Summary",
                    [
                      customerAnswer.profileSummary,
                      customerAnswer.recentWorkSummary,
                      customerAnswer.openWorkSummary,
                      customerAnswer.notableIssues.length ?
                        `Notable issues:\n${customerAnswer.notableIssues.map((x) => `• ${x}`).join("\n")}`
                      : "",
                      customerAnswer.suggestedNextSteps.length ?
                        `Suggested next steps:\n${customerAnswer.suggestedNextSteps.map((x) => `• ${x}`).join("\n")}`
                      : "",
                    ]
                      .filter(Boolean)
                      .join("\n\n"),
                  )
                }
              >
                <Copy className="size-3" /> Copy all
              </Button>
            </div>
            <SectionBlock title="Profile" body={customerAnswer.profileSummary} />
            <SectionBlock title="Recent work" body={customerAnswer.recentWorkSummary} />
            <SectionBlock title="Open work" body={customerAnswer.openWorkSummary} />
            <BulletList items={customerAnswer.notableIssues} title="Notable issues" />
            <BulletList items={customerAnswer.suggestedNextSteps} title="Suggested next steps" />
          </div>
        : null}

        {workOrderAnswer ?
          <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex justify-between gap-2 flex-wrap">
              <p className="font-medium text-foreground">Work order summary</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() =>
                  void copyText(
                    "Summary",
                    [
                      workOrderAnswer.issueAndStatusSummary,
                      workOrderAnswer.equipmentSummary,
                      workOrderAnswer.tasksSummary,
                      workOrderAnswer.notesSummary,
                      workOrderAnswer.partsSummary,
                      workOrderAnswer.customerFriendlyUpdateDraft,
                    ].join("\n\n"),
                  )
                }
              >
                <Copy className="size-3" /> Copy all
              </Button>
            </div>
            <SectionBlock title="Issue & status" body={workOrderAnswer.issueAndStatusSummary} />
            <SectionBlock title="Equipment" body={workOrderAnswer.equipmentSummary} />
            <SectionBlock title="Tasks" body={workOrderAnswer.tasksSummary} />
            <SectionBlock title="Notes" body={workOrderAnswer.notesSummary} />
            <SectionBlock title="Parts" body={workOrderAnswer.partsSummary} />
            <BulletList items={workOrderAnswer.missingInformation} title="Missing information" />
            <BulletList items={workOrderAnswer.suggestedNextSteps} title="Suggested next steps" />
            <div className="rounded-md border border-sky-500/25 bg-sky-500/5 p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Customer-friendly update (draft)
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => void copyText("Customer update draft", workOrderAnswer.customerFriendlyUpdateDraft)}
                >
                  <Copy className="size-3" /> Copy
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm">{workOrderAnswer.customerFriendlyUpdateDraft}</p>
            </div>
          </div>
        : null}

        {draftAnswer ?
          <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex justify-between gap-2">
              <p className="font-medium text-foreground">Draft</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void copyText("Draft", draftAnswer.draft)}
              >
                <Copy className="size-3" /> Copy draft
              </Button>
            </div>
            <p className="whitespace-pre-wrap">{draftAnswer.draft}</p>
            {draftAnswer.copyReminder.length ?
              <ul className={cn("text-xs text-muted-foreground list-disc pl-4 space-y-1")}>
                {draftAnswer.copyReminder.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            : null}
          </div>
        : null}
      </CardContent>
    </Card>
  )
}

function SectionBlock({ title, body }: { title: string; body: string }) {
  if (!body?.trim()) return null
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="whitespace-pre-wrap text-foreground/95">{body}</p>
    </div>
  )
}
