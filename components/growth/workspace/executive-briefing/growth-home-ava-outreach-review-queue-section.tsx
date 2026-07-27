"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  bulkApproveReviewQueueRows,
  bulkSendReviewQueueRows,
  discardReviewQueueRow,
} from "@/lib/growth/home/growth-home-review-queue-preview-client-1b"
import {
  filterSelectableRecommendedRows,
  GROWTH_HOME_REVIEW_QUEUE_1B_QA_MARKER,
  GROWTH_HOME_REVIEW_QUEUE_SUBTITLE,
  GROWTH_HOME_REVIEW_QUEUE_TITLE,
  type GrowthHomeReviewQueuePresentation,
  type GrowthHomeReviewQueueRow,
} from "@/lib/growth/home/growth-home-review-queue-1b"
import {
  GrowthHomeAvaReviewQueuePreviewCard,
  useReviewQueuePreviewInteraction,
} from "@/components/growth/workspace/executive-briefing/growth-home-ava-review-queue-preview-card"

type Props = {
  queue: GrowthHomeReviewQueuePresentation
  onRefresh?: () => void | Promise<void>
}

function statusTone(status: GrowthHomeReviewQueueRow["status"]): string {
  if (status === "recommended") return "text-emerald-700 dark:text-emerald-300"
  if (status === "approved") return "text-indigo-700 dark:text-indigo-300"
  if (status === "needs_review") return "text-amber-700 dark:text-amber-300"
  return "text-muted-foreground"
}

export function GrowthHomeAvaOutreachReviewQueueSection({ queue, onRefresh }: Props) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState<"approve" | "send" | null>(null)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const preview = useReviewQueuePreviewInteraction()

  const rowsById = useMemo(() => new Map(queue.rows.map((row) => [row.id, row])), [queue.rows])
  const selectedRows = useMemo(
    () => queue.rows.filter((row) => selectedIds.has(row.id)),
    [queue.rows, selectedIds],
  )
  const recommendedSelectable = useMemo(() => filterSelectableRecommendedRows(queue.rows), [queue.rows])

  const toggleSelected = (row: GrowthHomeReviewQueueRow, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(row.id)
      else next.delete(row.id)
      return next
    })
  }

  const selectAllRecommended = () => {
    setSelectedIds(new Set(recommendedSelectable.map((row) => row.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const openEdit = useCallback(
    (row: GrowthHomeReviewQueueRow) => {
      router.push(row.editHref)
    },
    [router],
  )

  const handleApprove = async (row: GrowthHomeReviewQueueRow) => {
    setBusy(row.id)
    setBulkMessage(null)
    try {
      const result = await bulkApproveReviewQueueRows([row])
      const item = result.results[0]
      if (!item?.ok) {
        setBulkMessage(item?.message ?? "Approval failed.")
        return
      }
      await onRefresh?.()
    } finally {
      setBusy(null)
    }
  }

  const handleReject = async (row: GrowthHomeReviewQueueRow) => {
    setBusy(row.id)
    setBulkMessage(null)
    try {
      await discardReviewQueueRow(row)
      await onRefresh?.()
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : "Skip failed.")
    } finally {
      setBusy(null)
    }
  }

  const handleBulkApprove = async () => {
    const rows = selectedRows.filter((row) => row.selectable && row.showApproveEmailAction)
    if (rows.length === 0) return
    setBulkBusy("approve")
    setBulkMessage(null)
    try {
      const result = await bulkApproveReviewQueueRows(rows)
      setBulkMessage(
        result.failureCount > 0
          ? `${result.successCount} approved, ${result.failureCount} require attention.`
          : `${result.successCount} approved.`,
      )
      await onRefresh?.()
    } finally {
      setBulkBusy(null)
    }
  }

  const handleBulkSend = async () => {
    const rows = selectedRows.filter((row) => row.selectableForSend || row.showSendEmailAction)
    if (rows.length === 0) return
    setBulkBusy("send")
    setBulkMessage(null)
    try {
      const result = await bulkSendReviewQueueRows(rows)
      setBulkMessage(
        result.failureCount > 0
          ? `${result.successCount} sent, ${result.failureCount} failed individually.`
          : `${result.successCount} sent.`,
      )
      setSendConfirmOpen(false)
      await onRefresh?.()
    } finally {
      setBulkBusy(null)
    }
  }

  const activePreviewRow = preview.openRowId ? rowsById.get(preview.openRowId) ?? null : null

  if (queue.rows.length === 0) return null

  return (
    <section
      data-qa-section="home-outreach-review-queue"
      data-qa-marker-review-queue-1b={GROWTH_HOME_REVIEW_QUEUE_1B_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-4"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_REVIEW_QUEUE_TITLE}</h2>
        <p className="text-sm text-muted-foreground">{GROWTH_HOME_REVIEW_QUEUE_SUBTITLE}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={selectAllRecommended}>
          Select All Recommended
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
          Clear Selection
        </Button>
        {selectedRows.length > 0 ? (
          <span className="text-sm text-muted-foreground">{selectedRows.length} selected</span>
        ) : null}
      </div>

      {selectedRows.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bulkBusy != null}
            onClick={() => {
              const first = selectedRows[0]
              if (!first) return
              const anchor = document.querySelector(`[data-preview-anchor="${first.id}"]`) as HTMLElement | null
              if (anchor) preview.openPreview(first.id, anchor, true)
            }}
          >
            Preview Selected
          </Button>
          <Button type="button" size="sm" disabled={bulkBusy != null} onClick={() => void handleBulkApprove()}>
            {bulkBusy === "approve" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Approve Selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={bulkBusy != null}
            onClick={() => setSendConfirmOpen(true)}
          >
            Send Selected
          </Button>
        </div>
      ) : null}

      {bulkMessage ? <p className="text-sm text-muted-foreground">{bulkMessage}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30 text-left">
            <tr>
              <th className="px-3 py-2 w-10" scope="col">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Website</th>
              <th className="px-3 py-2 font-medium">Primary Contact</th>
              <th className="px-3 py-2 font-medium">Fit</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Preview</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.rows.map((row) => {
              const isSelected = selectedIds.has(row.id)
              const isPreviewOpen = preview.openRowId === row.id
              return (
                <tr key={row.id} className="border-t border-border/50 align-top">
                  <td className="px-3 py-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={!row.selectable}
                      aria-label={`Select ${row.companyName}`}
                      onCheckedChange={(checked) => toggleSelected(row, checked === true)}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">{row.companyName}</td>
                  <td className="px-3 py-3">
                    {row.website.href ? (
                      <a
                        href={row.website.href}
                        target="_blank"
                        rel="noreferrer"
                        title={row.website.canonicalUrl ?? undefined}
                        className="inline-flex items-center gap-1 text-indigo-700 hover:underline dark:text-indigo-300"
                      >
                        {row.website.rootDomain}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{row.website.label}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{row.primaryContact ?? "—"}</td>
                  <td className="px-3 py-3 tabular-nums">{row.fitPercent != null ? `${row.fitPercent}%` : "—"}</td>
                  <td className={cn("px-3 py-3 font-medium", statusTone(row.status))}>
                    <div>{row.statusLabel}</div>
                    {row.senderEmail ? (
                      <div className="text-xs font-normal text-muted-foreground">
                        Sending from: {row.senderEmail}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      data-preview-anchor={row.id}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-medium hover:bg-muted/60",
                        isPreviewOpen ? "bg-muted/60 text-foreground" : "text-indigo-700 dark:text-indigo-300",
                      )}
                      aria-expanded={isPreviewOpen}
                      onMouseEnter={(event) => preview.scheduleOpenPreview(row.id, event.currentTarget)}
                      onMouseLeave={preview.closePreview}
                      onFocus={(event) => preview.openPreview(row.id, event.currentTarget)}
                      onBlur={preview.closePreview}
                      onClick={(event) => preview.togglePin(row.id, event.currentTarget)}
                    >
                      Preview
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.showApproveEmailAction ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy === row.id || bulkBusy != null}
                          onClick={() => void handleApprove(row)}
                        >
                          {busy === row.id ? (
                            <>
                              <Loader2 className="size-4 animate-spin mr-1" aria-hidden />
                              Approving…
                            </>
                          ) : (
                            "Approve"
                          )}
                        </Button>
                      ) : null}
                      {row.showSendEmailAction ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy === row.id || bulkBusy != null}
                          onClick={() => {
                            setSelectedIds(new Set([row.id]))
                            setSendConfirmOpen(true)
                          }}
                        >
                          Send Email
                        </Button>
                      ) : null}
                      {row.showApproveEmailAction ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy === row.id || bulkBusy != null}
                          onClick={() => void handleReject(row)}
                        >
                          Skip
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {activePreviewRow ? (
        <GrowthHomeAvaReviewQueuePreviewCard
          row={activePreviewRow}
          open={Boolean(preview.openRowId)}
          pinned={preview.pinnedRowId === activePreviewRow.id}
          anchorRect={preview.anchorRect}
          onOpenChange={(next) => {
            if (!next && preview.pinnedRowId !== activePreviewRow.id) {
              preview.setOpenRowId(null)
              preview.setAnchorRect(null)
            }
          }}
          onPinChange={(next) => {
            preview.setPinnedRowId(next ? activePreviewRow.id : null)
            if (!next) {
              preview.setOpenRowId(null)
              preview.setAnchorRect(null)
            }
          }}
          onEdit={openEdit}
        />
      ) : null}

      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send {selectedRows.filter((row) => row.selectableForSend || row.showSendEmailAction).length} emails
            </DialogTitle>
            <DialogDescription>
              Each package sends independently with its own approval verification, sender mailbox, signature, and receipt.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {selectedRows
              .filter((row) => row.selectableForSend || row.showSendEmailAction)
              .map((row) => (
                <li key={row.id}>
                  {row.companyName} · {row.primaryContact ?? "Recipient pending"}
                </li>
              ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSendConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={bulkBusy != null} onClick={() => void handleBulkSend()}>
              {bulkBusy === "send" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Send {selectedRows.filter((row) => row.selectableForSend || row.status === "approved").length} Emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
