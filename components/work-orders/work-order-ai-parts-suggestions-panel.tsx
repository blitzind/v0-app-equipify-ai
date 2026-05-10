"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Copy, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRODUCTIVITY_PLAN_MESSAGE } from "@/lib/aiden/productivity-messages"
import {
  formatPartsSuggestionsPlainText,
  type WorkOrderPartsSuggestionItem,
} from "@/lib/work-orders/parts-suggest-schema"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function confidenceClass(c: WorkOrderPartsSuggestionItem["confidence"]): string {
  switch (c) {
    case "high":
      return "text-emerald-700 dark:text-emerald-300"
    case "medium":
      return "text-amber-800 dark:text-amber-200"
    default:
      return "text-muted-foreground"
  }
}

export function WorkOrderAiPartsSuggestionsPanel(props: {
  organizationId: string
  workOrderId: string
  workOrderArchived?: boolean
  canEdit: boolean
}) {
  const { toast } = useToast()
  const [eligibilityReady, setEligibilityReady] = useState(false)
  const [productivityEnabled, setProductivityEnabled] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<WorkOrderPartsSuggestionItem[] | null>(null)
  const [catalogContextIncluded, setCatalogContextIncluded] = useState<boolean | null>(null)
  const [copyBusy, setCopyBusy] = useState(false)

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

  useEffect(() => {
    setItems(null)
    setCatalogContextIncluded(null)
    setError(null)
  }, [props.workOrderId])

  const disabled = props.workOrderArchived || !props.canEdit || !productivityEnabled || !eligibilityReady

  const runGenerate = useCallback(async () => {
    if (disabled) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(props.organizationId)}/work-orders/${encodeURIComponent(props.workOrderId)}/ai-parts-suggestions`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        suggestions?: WorkOrderPartsSuggestionItem[]
        catalogContextIncluded?: boolean
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !Array.isArray(data.suggestions)) {
        throw new Error(data.message ?? data.error ?? "Could not generate suggestions.")
      }
      setItems(data.suggestions)
      setCatalogContextIncluded(typeof data.catalogContextIncluded === "boolean" ? data.catalogContextIncluded : null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate suggestions."
      setError(msg)
      toast({ variant: "destructive", title: "Suggestions unavailable", description: msg })
    } finally {
      setGenerating(false)
    }
  }, [disabled, props.organizationId, props.workOrderId, toast])

  const copyText = useCallback(
    async (label: string, text: string) => {
      const t = text.trim()
      if (!t) return
      setCopyBusy(true)
      try {
        await navigator.clipboard.writeText(t)
        toast({ title: "Copied", description: `${label} copied to clipboard.` })
      } catch {
        toast({ variant: "destructive", title: "Copy failed", description: "Clipboard unavailable." })
      } finally {
        setCopyBusy(false)
      }
    },
    [toast],
  )

  if (!props.canEdit) return null

  if (!eligibilityReady) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin shrink-0" />
        Checking AI productivity access…
      </div>
    )
  }

  if (!productivityEnabled) {
    return (
      <div className="rounded-xl border border-border bg-muted/15 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          AI parts &amp; catalog suggestions
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">{PRODUCTIVITY_PLAN_MESSAGE}</p>
      </div>
    )
  }

  return (
    <div
      id="work-order-ai-parts-suggestions-panel"
      className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="border-b border-border bg-muted/25 dark:bg-muted/10 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            AI parts &amp; catalog suggestions
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Review-only — nothing is added to this work order, ordered, or deducted from stock automatically. Confirm
            before using parts.
          </p>
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide mt-2 rounded px-1.5 py-0.5 w-fit",
              "bg-amber-500/15 text-amber-900 dark:text-amber-100 border border-amber-500/25",
            )}
          >
            AI draft — human review required
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-11 gap-1.5 text-xs w-full sm:h-8 sm:w-auto touch-manipulation"
            disabled={disabled || generating}
            onClick={() => void runGenerate()}
          >
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {items?.length ? "Regenerate" : "Generate suggestions"}
          </Button>
          {items?.length ?
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 gap-1.5 text-xs w-full sm:h-8 sm:w-auto touch-manipulation"
              disabled={copyBusy}
              onClick={() =>
                void copyText("Suggestions list", formatPartsSuggestionsPlainText({ suggestions: items }))
              }
            >
              <Copy className="size-3.5" />
              Copy list
            </Button>
          : null}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {catalogContextIncluded !== null ?
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {catalogContextIncluded ?
              "Catalog names/SKUs (no pricing) were included as reference for this workspace user."
            : "Catalog reference was not sent — requires inventory-related permission and at least one active catalog item, or your catalog is empty."}
          </p>
        : null}

        {error ?
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        : null}

        {!items?.length && !generating && !error ?
          <p className="text-sm text-muted-foreground">
            Generate suggested parts, tools, and consumables. Optional matches reference your catalog only when your role
            allows inventory catalog context.
          </p>
        : null}

        {generating ?
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Generating suggestions…
          </p>
        : null}

        {items?.length ?
          <ul className="space-y-3">
            {items.map((s, idx) => (
              <li
                key={`${s.name}-${idx}`}
                className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wide", confidenceClass(s.confidence))}>
                    {s.confidence} confidence · {s.itemKind}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>
                {s.catalogMatch?.catalogItemId || s.catalogMatch?.displayLabel ?
                  <p className="text-[11px] text-foreground/90">
                    <span className="font-medium">Catalog match: </span>
                    {s.catalogMatch.displayLabel ?? s.catalogMatch.catalogItemId}
                  </p>
                : null}
              </li>
            ))}
          </ul>
        : null}
      </div>
    </div>
  )
}
