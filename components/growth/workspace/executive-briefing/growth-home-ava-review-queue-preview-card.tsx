"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  fetchReviewQueuePreview,
  GROWTH_HOME_REVIEW_QUEUE_PREVIEW_CLIENT_1B_QA_MARKER,
  type GrowthHomeReviewQueuePreviewData,
} from "@/lib/growth/home/growth-home-review-queue-preview-client-1b"
import type { GrowthHomeReviewQueueRow } from "@/lib/growth/home/growth-home-review-queue-1b"

type Props = {
  row: GrowthHomeReviewQueueRow
  pinned: boolean
  open: boolean
  anchorRect: DOMRect | null
  onOpenChange: (open: boolean) => void
  onPinChange: (pinned: boolean) => void
  onEdit: (row: GrowthHomeReviewQueueRow) => void
}

const HOVER_OPEN_DELAY_MS = 280

export function GrowthHomeAvaReviewQueuePreviewCard({
  row,
  pinned,
  open,
  anchorRect,
  onOpenChange,
  onPinChange,
  onEdit,
}: Props) {
  const titleId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<GrowthHomeReviewQueuePreviewData | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReviewQueuePreview(row)
      setPreview(data)
    } catch (err) {
      setPreview(null)
      setError(err instanceof Error ? err.message : "Review package unavailable")
    } finally {
      setLoading(false)
    }
  }, [row])

  useEffect(() => {
    if (!open) return
    void loadPreview()
  }, [open, loadPreview])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onPinChange(false)
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange, onPinChange])

  if (!open || !anchorRect) return null

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
  const cardWidth = Math.min(520, viewportWidth - 24)
  const preferredLeft = Math.min(Math.max(12, anchorRect.right + 12), viewportWidth - cardWidth - 12)
  const preferredTop = Math.min(Math.max(12, anchorRect.top - 8), viewportHeight - 420)

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby={titleId}
      data-qa-section="home-review-queue-preview"
      data-qa-marker-preview-client-1b={GROWTH_HOME_REVIEW_QUEUE_PREVIEW_CLIENT_1B_QA_MARKER}
      data-preview-pinned={pinned ? "true" : "false"}
      className={cn(
        "fixed z-50 rounded-xl border border-border/70 bg-card shadow-xl",
        "max-h-[min(70vh,560px)] overflow-hidden",
      )}
      style={{ width: cardWidth, left: preferredLeft, top: preferredTop }}
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => {
        if (!pinned) onOpenChange(false)
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p id={titleId} className="truncate text-base font-semibold text-foreground">
            {preview?.companyName ?? row.companyName}
          </p>
          {preview?.websiteHref ? (
            <a
              href={preview.websiteHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline dark:text-indigo-300"
            >
              {preview.websiteLabel}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">{preview?.websiteLabel ?? row.website.label}</p>
          )}
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Close preview"
          onClick={() => {
            onPinChange(false)
            onOpenChange(false)
          }}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto px-4 py-3 text-sm" style={{ maxHeight: "calc(min(70vh, 560px) - 4.5rem)" }}>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading preview…
          </div>
        ) : null}
        {error ? <p className="text-destructive">{error}</p> : null}
        {preview ? (
          <>
            <PreviewField label="Recipient" value={preview.recipient ?? "—"} />
            <PreviewField label="Subject" value={preview.subject} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-foreground">
                {preview.body}
              </pre>
            </div>
            <PreviewField label="Sending mailbox" value={preview.mailboxLabel ?? "—"} />
            <PreviewField label="Confidence" value={preview.confidenceLabel ?? "—"} />
            {preview.rationale ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why Ava recommends it</p>
                <p className="mt-1 text-foreground">{preview.rationale}</p>
              </div>
            ) : null}
            {preview.warnings.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Warnings</p>
                <ul className="mt-1 space-y-1 text-amber-800 dark:text-amber-200">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <PreviewField label="Approval state" value={preview.approvalStateLabel} />
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
        <Button type="button" size="sm" onClick={() => onEdit(row)}>
          Edit
        </Button>
        {row.reviewHref ? (
          <Button asChild size="sm" variant="outline">
            <Link href={row.reviewHref}>Open review drawer</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  )
}

export function useReviewQueuePreviewInteraction() {
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const [pinnedRowId, setPinnedRowId] = useState<string | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const hoverTimerRef = useRef<number | null>(null)

  const clearHoverTimer = () => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  const openPreview = (rowId: string, anchor: HTMLElement, pin = false) => {
    clearHoverTimer()
    setOpenRowId(rowId)
    setAnchorRect(anchor.getBoundingClientRect())
    if (pin) setPinnedRowId(rowId)
  }

  const scheduleOpenPreview = (rowId: string, anchor: HTMLElement) => {
    clearHoverTimer()
    hoverTimerRef.current = window.setTimeout(() => {
      setOpenRowId(rowId)
      setAnchorRect(anchor.getBoundingClientRect())
    }, HOVER_OPEN_DELAY_MS)
  }

  const closePreview = () => {
    clearHoverTimer()
    if (!pinnedRowId) {
      setOpenRowId(null)
      setAnchorRect(null)
    }
  }

  const togglePin = (rowId: string, anchor: HTMLElement) => {
    if (pinnedRowId === rowId) {
      setPinnedRowId(null)
      setOpenRowId(null)
      setAnchorRect(null)
      return
    }
    openPreview(rowId, anchor, true)
  }

  useEffect(() => () => clearHoverTimer(), [])

  return {
    openRowId,
    pinnedRowId,
    anchorRect,
    openPreview,
    scheduleOpenPreview,
    closePreview,
    togglePin,
    setPinnedRowId,
    setOpenRowId,
    setAnchorRect,
  }
}
