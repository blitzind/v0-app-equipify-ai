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
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
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

export type CertificateAttachmentsCardProps = {
  organizationId: string
  workOrderId: string
  /** When set, attachments are filtered to this asset (multi-asset work orders). */
  equipmentId?: string | null
  /** When set, links freshly uploaded attachments to the saved cert record. */
  calibrationRecordId?: string | null
  /** Default upload category. */
  defaultCategory?: CertificateAttachmentCategory
  canManage?: boolean
  className?: string
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
  canManage = true,
  className,
}: CertificateAttachmentsCardProps) {
  const { toast } = useToast()
  const [items, setItems] = React.useState<CertificateAttachment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [openingId, setOpeningId] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

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
      })
      toast({ title: "Attachment uploaded" })
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

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading attachments…</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No attachments yet. PDF, PNG, JPEG, or WEBP up to{" "}
          {Math.round(CERT_ATTACH_MAX_BYTES / (1024 * 1024))} MB.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 -mx-1">
          {visible.map((att) => (
            <li key={att.id} className="flex items-center gap-3 px-1 py-2">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => void handleOpen(att)}
                  className="block text-xs font-medium text-foreground hover:text-primary truncate text-left"
                  title={att.fileName}
                >
                  {att.fileName}
                </button>
                <p className="text-[10px] text-muted-foreground truncate">
                  {att.category === "external_calibration" ? "External calibration" : "Supplementary"}
                  <span className="mx-1">·</span>
                  {formatAttachmentSize(att.fileSizeBytes)}
                  <span className="mx-1">·</span>
                  Uploaded {fmtDate(att.uploadedAt)}
                </p>
              </div>
              {openingId === att.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              ) : null}
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  disabled={busy}
                  aria-label={`Delete ${att.fileName}`}
                  onClick={() => void handleDelete(att)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
