"use client"

/**
 * Certificates + Portal Release Workflow — Phase 2
 *
 * Compact attachments card embedded in the Work Order Certificates tab.
 * Lists uploaded calibration PDFs / supplementary docs for one work order
 * (or one equipment asset within a multi-asset work order) and allows
 * managers to upload + delete files.
 *
 * Uses the existing `work-order-attachments` storage bucket via the
 * `lib/certificates/certificate-attachments.ts` helpers.
 */

import * as React from "react"
import { ExternalLink, Loader2, Paperclip, Shield, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  releaseStatusForVisibility,
  visibilityLabel,
  type AttachmentVisibilityScope,
} from "@/lib/attachments/document-attachments"
import type { CertificateReleaseMode } from "@/lib/portal/certificate-release"
import {
  CERT_ATTACH_MAX_BYTES,
  deleteCertificateAttachment,
  formatAttachmentSize,
  listCertificateAttachmentsForWorkOrder,
  signedUrlForCertificateAttachment,
  uploadCertificateAttachment,
  validateCertificateAttachmentFile,
  type CertificateAttachment,
  type CertificateAttachmentCategory,
} from "@/lib/certificates/certificate-attachments"
import { AttachmentTypeIcon } from "@/components/attachments/attachment-preview"
import { attachmentKindLabel, displayAttachmentFileName } from "@/lib/attachments/attachment-media-kind"

export type CertificateAttachmentsCardProps = {
  organizationId: string
  workOrderId: string
  /** When set, attachments are filtered to this asset (multi-asset work orders). */
  equipmentId?: string | null
  /** When set, links freshly uploaded attachments to the saved cert record. */
  calibrationRecordId?: string | null
  /** Default upload category. */
  defaultCategory?: CertificateAttachmentCategory
  linkedInvoices?: Array<{
    id: string
    label: string
    status?: string
    releaseOverride?: CertificateReleaseMode | null
  }>
  releaseModeSnapshot?: CertificateReleaseMode | string | null
  defaultVisibility?: AttachmentVisibilityScope
  canManage?: boolean
  canReleaseToPortal?: boolean
  className?: string
}

const VISIBILITY_OPTIONS: Array<{ value: AttachmentVisibilityScope; label: string }> = [
  { value: "internal", label: "Internal only" },
  { value: "pending_release", label: "Pending release" },
  { value: "released_manual", label: "Released manually" },
  { value: "released_after_payment", label: "Released after payment" },
]

function visibilityForReleaseMode(
  mode: CertificateReleaseMode | string | null | undefined,
  linkedInvoiceStatus?: string | null,
): AttachmentVisibilityScope {
  if (mode === "immediate_release") return "portal_visible"
  if (mode === "release_on_payment") {
    return linkedInvoiceStatus === "paid" ? "portal_visible" : "released_after_payment"
  }
  if (mode === "internal_only") return "internal"
  return "pending_release"
}

function fmtDate(iso: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function CertificateAttachmentsCard({
  organizationId,
  workOrderId,
  equipmentId = null,
  calibrationRecordId = null,
  defaultCategory = "external_calibration",
  linkedInvoices = [],
  releaseModeSnapshot = null,
  defaultVisibility = "pending_release",
  canManage = true,
  canReleaseToPortal = canManage,
  className,
}: CertificateAttachmentsCardProps) {
  const { toast } = useToast()
  const [items, setItems] = React.useState<CertificateAttachment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [openingId, setOpeningId] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState("")
  const [issueDate, setIssueDate] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [visibility, setVisibility] = React.useState<AttachmentVisibilityScope>(defaultVisibility)
  const [invoiceId, setInvoiceId] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const selectedInvoice = React.useMemo(
    () => linkedInvoices.find((invoice) => invoice.id === invoiceId) ?? null,
    [invoiceId, linkedInvoices],
  )
  const uploadReleaseMode = selectedInvoice?.releaseOverride ?? releaseModeSnapshot

  const refresh = React.useCallback(async () => {
    if (!organizationId || !workOrderId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    try {
      const rows = await listCertificateAttachmentsForWorkOrder(supabase, {
        organizationId,
        workOrderId,
      })
      setItems(rows)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load attachments."
      toast({ variant: "destructive", title: "Couldn’t load attachments", description: msg })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, workOrderId, toast])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = React.useMemo(() => {
    if (!equipmentId) return items
    return items.filter((a) => !a.equipmentId || a.equipmentId === equipmentId)
  }, [items, equipmentId])

  React.useEffect(() => {
    setVisibility(defaultVisibility)
  }, [defaultVisibility])

  function handleInvoiceChange(nextInvoiceId: string) {
    setInvoiceId(nextInvoiceId)
    const invoice = linkedInvoices.find((item) => item.id === nextInvoiceId) ?? null
    setVisibility(
      invoice?.releaseOverride
        ? visibilityForReleaseMode(invoice.releaseOverride, invoice.status ?? null)
        : defaultVisibility,
    )
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const validation = validateCertificateAttachmentFile(file)
    if (validation) {
      toast({ variant: "destructive", title: "Cannot upload", description: validation })
      return
    }
    setBusy(true)
    const supabase = createBrowserSupabaseClient()
    try {
      await uploadCertificateAttachment(supabase, {
        organizationId,
        workOrderId,
        equipmentId,
        calibrationRecordId,
        category: defaultCategory,
        file,
        title: title.trim() || null,
        issueDate: issueDate || null,
        expiresAt: expiresAt || null,
        visibilityScope: visibility,
        invoiceId: invoiceId || null,
        releaseModeSnapshot: uploadReleaseMode,
        notes: notes.trim() || null,
      })
      toast({ title: "Attachment uploaded" })
      setTitle("")
      setIssueDate("")
      setExpiresAt("")
      setNotes("")
      setVisibility(defaultVisibility)
      await refresh()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please retry.",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleOpen(att: CertificateAttachment) {
    setOpeningId(att.id)
    try {
      const supabase = createBrowserSupabaseClient()
      const url = await signedUrlForCertificateAttachment(supabase, att.storagePath)
      if (!url) throw new Error("Could not generate download link.")
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn’t open file",
        description: err instanceof Error ? err.message : "Please retry.",
      })
    } finally {
      setOpeningId(null)
    }
  }

  async function handleDelete(att: CertificateAttachment) {
    if (!canManage) return
    if (!window.confirm(`Delete "${att.fileName}"? This cannot be undone.`)) return
    setBusy(true)
    const supabase = createBrowserSupabaseClient()
    try {
      await deleteCertificateAttachment(supabase, {
        organizationId,
        attachmentId: att.id,
      })
      toast({ title: "Attachment removed" })
      await refresh()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Please retry.",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleVisibility(att: CertificateAttachment, next: AttachmentVisibilityScope) {
    if (!canManage || !att.documentAttachmentId) return
    setBusy(true)
    const supabase = createBrowserSupabaseClient()
    try {
      const { error } = await supabase
        .from("org_document_attachments")
        .update({
          visibility_scope: next,
          portal_visible: next !== "internal",
          portal_release_status: releaseStatusForVisibility(next),
          released_at: releaseStatusForVisibility(next) === "released" ? new Date().toISOString() : null,
          revoked_at: next === "internal" ? new Date().toISOString() : null,
          withheld_reason:
            next === "internal"
              ? "Internal only"
              : next === "released_after_payment"
                ? "Invoice unpaid"
                : next === "pending_release"
                  ? "Manual release required"
                  : null,
        })
        .eq("organization_id", organizationId)
        .eq("id", att.documentAttachmentId)
      if (error) throw new Error(error.message)
      toast({ title: "Certificate visibility updated" })
      await refresh()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please retry.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Paperclip className="w-3 h-3" /> Certificate attachments
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload external calibration PDFs or supplementary documents. Stored alongside this work order.
          </p>
        </div>
        {canManage ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => void handleFile(e)}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5 text-xs shrink-0"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload
            </Button>
          </>
        ) : null}
      </div>

      {canManage ? (
        <div className="rounded-lg border border-border bg-muted/15 p-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Certificate label/title (optional)"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            />
            {canReleaseToPortal ? (
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as AttachmentVisibilityScope)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : (
              <div className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground">
                Pending release
              </div>
            )}
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              title="Issue date"
            />
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              title="Expiration / next due date"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={invoiceId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            >
              <option value="">No invoice link</option>
              {linkedInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>{invoice.label}</option>
              ))}
            </select>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Uploads use the customer certificate rule by default. An invoice rule only applies when the selected invoice has
            an explicit override.
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading attachments…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">No certificate files yet</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            PDF, PNG, JPEG, or WEBP up to {Math.round(CERT_ATTACH_MAX_BYTES / (1024 * 1024))} MB.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 -mx-1">
          {visible.map((att) => {
            const label = displayAttachmentFileName(att.fileName)
            return (
            <li key={att.id} className="flex items-center gap-3 px-1 py-2">
              <AttachmentTypeIcon mimeType={att.fileType} fileName={att.fileName} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => void handleOpen(att)}
                  className="block text-xs font-medium text-foreground hover:text-primary truncate text-left w-full"
                  title={att.fileName}
                  aria-label={`Open ${label}`}
                >
                  {label}
                </button>
                <p className="text-[10px] text-muted-foreground truncate">
                  {attachmentKindLabel(att.fileType, att.fileName)}
                  <span className="mx-1">·</span>
                  {att.title?.trim() || (att.category === "external_calibration" ? "External calibration" : "Supplementary")}
                  <span className="mx-1">·</span>
                  {formatAttachmentSize(att.fileSizeBytes)}
                  <span className="mx-1">·</span>
                  Uploaded {fmtDate(att.uploadedAt)}
                  {att.issueDate ? (
                    <>
                      <span className="mx-1">·</span>
                      Issued {fmtDate(att.issueDate)}
                    </>
                  ) : null}
                  {att.invoiceId ? (
                    <>
                      <span className="mx-1">·</span>
                      Invoice linked
                    </>
                  ) : null}
                </p>
              </div>
              {att.visibilityScope ? (
                canReleaseToPortal && att.documentAttachmentId ? (
                  <select
                    value={att.visibilityScope}
                    onChange={(e) => void handleVisibility(att, e.target.value as AttachmentVisibilityScope)}
                    className="hidden rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground sm:block"
                    title={visibilityLabel(att.visibilityScope)}
                    aria-label={`Visibility for ${label}`}
                    disabled={busy}
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="hidden items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
                    <Shield className="h-3 w-3" /> {visibilityLabel(att.visibilityScope)}
                  </span>
                )
              ) : null}
              {openingId === att.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" aria-hidden />
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground shrink-0"
                  disabled={busy}
                  aria-label={`Open ${label}`}
                  onClick={() => void handleOpen(att)}
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </Button>
              )}
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  disabled={busy}
                  aria-label={`Delete ${label}`}
                  onClick={() => void handleDelete(att)}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden />
                </Button>
              ) : null}
            </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
