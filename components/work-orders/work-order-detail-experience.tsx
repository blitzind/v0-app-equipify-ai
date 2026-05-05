"use client"

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  User,
  Wrench,
  MapPin,
  Calendar,
  Clock,
  FileText,
  Package,
  Camera,
  PenLine,
  Trash2,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  Save,
  X,
  ExternalLink,
  Download,
  File,
  Upload,
  ClipboardList,
  Hammer,
  Paperclip,
  StickyNote,
  History,
  Pencil,
  UserPlus,
  Receipt,
  Printer,
  AlertOctagon,
  FileBadge2,
  Boxes,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Part, RepairLog, WorkOrder, WorkOrderPriority, WorkOrderStatus } from "@/lib/mock-data"
import type {
  WorkOrderCertificateStatus,
  WorkOrderEquipmentAsset,
} from "@/lib/work-orders/detail-load"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MaintenancePlansLucideIcon } from "@/lib/navigation/module-icons"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DrawerTimeline } from "@/components/detail-drawer"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ─── Styles (match existing WO page) ─────────────────────────────────────────

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  Open: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  Scheduled: "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
  "In Progress":
    "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  Completed: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Completed Pending Signature":
    "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30",
  Invoiced: "bg-muted text-muted-foreground border-border",
}

const PRIORITY_STYLE: Record<WorkOrderPriority, string> = {
  Low: "text-muted-foreground",
  Normal: "text-foreground",
  High: "text-[color:var(--status-warning)]",
  Critical: "text-destructive font-semibold",
}

function formatDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function certificateStatusLabel(s: WorkOrderCertificateStatus): string {
  if (s === "completed") return "Certificate complete"
  if (s === "in_progress") return "Certificate in progress"
  return "Certificate not started"
}

function certificateStatusBadgeClass(s: WorkOrderCertificateStatus): string {
  if (s === "completed") {
    return "border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
  }
  if (s === "in_progress") {
    return "border-amber-500/40 text-amber-800 dark:text-amber-200"
  }
  return "border-border text-muted-foreground"
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—"
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

function documentAttachmentIcon(fileType: string) {
  const t = fileType.toLowerCase()
  if (t === "application/pdf" || t.includes("pdf")) {
    return <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
  }
  return <File className="w-4 h-4 shrink-0 text-muted-foreground" />
}

function initialsFromTechnicianName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export type WorkOrderActivityItem = {
  date: string
  label: string
  description?: string
  accent?: "muted" | "success" | "warning"
}

export function buildWorkOrderActivityItems(wo: WorkOrder): WorkOrderActivityItem[] {
  const items: WorkOrderActivityItem[] = [
    {
      date: formatDate(wo.createdAt.slice(0, 10)),
      label: "Work order created",
      description: wo.createdByPmAutomation ? "Created by PM automation" : "Recorded in your workspace",
      accent: "muted",
    },
  ]
  if (wo.scheduledDate) {
    items.push({
      date: formatDate(wo.scheduledDate),
      label: `Scheduled${wo.scheduledTime ? ` at ${wo.scheduledTime}` : ""}`,
      description: `Technician: ${wo.technicianName}`,
      accent: "muted",
    })
  }
  if (wo.completedDate) {
    items.push({
      date: formatDate(wo.completedDate),
      label:
        wo.status === "Completed Pending Signature"
          ? "Completed (pending customer signature)"
          : "Completed",
      description: wo.repairLog.technicianNotes?.slice(0, 120) || "Service completed",
      accent: wo.status === "Completed Pending Signature" ? "warning" : "success",
    })
  }
  if (wo.invoiceNumber) {
    items.push({
      date: "—",
      label: `Invoiced — ${wo.invoiceNumber}`,
      accent: "success",
    })
  }
  return items
}

function planServiceLabel(s: unknown, i: number): string {
  if (typeof s === "string") return s
  if (s && typeof s === "object") {
    const o = s as Record<string, unknown>
    if (typeof o.name === "string") return o.name
    if (typeof o.label === "string") return o.label
    if (typeof o.description === "string") return o.description
  }
  try {
    return JSON.stringify(s)
  } catch {
    return `Service ${i + 1}`
  }
}

// ─── Parts table (shared with page behavior) ──────────────────────────────────

function PartsTable({
  parts,
  editable,
  onChange,
}: {
  parts: Part[]
  editable: boolean
  onChange: (parts: Part[]) => void
}) {
  function update(id: string, field: keyof Part, value: string | number) {
    onChange(parts.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }
  function remove(id: string) {
    onChange(parts.filter((p) => p.id !== id))
  }
  function addRow() {
    onChange([...parts, { id: `P-${Date.now()}`, name: "", partNumber: "", quantity: 1, unitCost: 0 }])
  }
  const total = parts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Part Name</TableHead>
              <TableHead>Part #</TableHead>
              <TableHead className="w-20 text-right">Qty</TableHead>
              <TableHead className="w-28 text-right">Unit Cost</TableHead>
              <TableHead className="w-28 text-right">Total</TableHead>
              {editable && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={editable ? 6 : 5}
                  className="text-center text-muted-foreground text-sm py-6"
                >
                  No parts recorded.
                </TableCell>
              </TableRow>
            )}
            {parts.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {editable ? (
                    <Input
                      value={p.name}
                      onChange={(e) => update(p.id, "name", e.target.value)}
                      placeholder="Part name"
                      className="h-8 text-sm"
                    />
                  ) : (
                    <span className="text-sm">{p.name || "—"}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editable ? (
                    <Input
                      value={p.partNumber}
                      onChange={(e) => update(p.id, "partNumber", e.target.value)}
                      placeholder="PN-0000"
                      className="h-8 text-sm font-mono"
                    />
                  ) : (
                    <span className="text-sm font-mono text-muted-foreground">{p.partNumber || "—"}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min={1}
                      value={p.quantity}
                      onChange={(e) => update(p.id, "quantity", Number(e.target.value))}
                      className="h-8 text-sm text-right w-16 ml-auto"
                    />
                  ) : (
                    <span className="text-sm">{p.quantity}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editable ? (
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={p.unitCost}
                      onChange={(e) => update(p.id, "unitCost", Number(e.target.value))}
                      className="h-8 text-sm text-right w-24 ml-auto"
                    />
                  ) : (
                    <span className="text-sm">${p.unitCost.toFixed(2)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  ${(p.quantity * p.unitCost).toFixed(2)}
                </TableCell>
                {editable && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        {editable && (
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Part
          </Button>
        )}
        <div className="ml-auto text-sm font-medium">
          Parts total:{" "}
          <span className="text-foreground font-semibold tabular-nums">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

export type WorkOrderDocumentAttachmentView = {
  id: string
  fileName: string
  fileType: string
  url: string
  uploadedAt: string
  fileSizeBytes?: number | null
}

const ATTACHMENT_INPUT_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function PhotoSection({
  photos,
  photoAttachmentIds,
  documents,
  editable,
  uploading,
  uploadProgress,
  uploadStatusLabel,
  onChange,
  onAttachmentUpload,
  onRemoveAttachmentPhoto,
  onRemoveLegacyPhoto,
  onRemoveDocument,
}: {
  photos: string[]
  /** Parallel to `photos`: set when the URL comes from `work_order_attachments`. */
  photoAttachmentIds?: (string | undefined)[]
  documents?: WorkOrderDocumentAttachmentView[]
  editable: boolean
  uploading?: boolean
  /** 0–100 while uploading, or null/undefined for indeterminate text only. */
  uploadProgress?: number | null
  uploadStatusLabel?: string
  onChange: (photos: string[]) => void
  onAttachmentUpload?: (files: FileList) => void | Promise<void>
  onRemoveAttachmentPhoto?: (attachmentId: string) => void | Promise<void>
  onRemoveLegacyPhoto?: (index: number) => void
  onRemoveDocument?: (attachmentId: string) => void | Promise<void>
}) {
  function handleFileLegacy(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) onChange([...photos, ev.target.result as string])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files
    if (list?.length && onAttachmentUpload) void onAttachmentUpload(list)
    e.target.value = ""
  }

  function removeAt(index: number) {
    const aid = photoAttachmentIds?.[index]
    if (aid && onRemoveAttachmentPhoto) void onRemoveAttachmentPhoto(aid)
    else if (onRemoveLegacyPhoto) onRemoveLegacyPhoto(index)
    else onChange(photos.filter((_, j) => j !== index))
  }

  const showUploader = Boolean(onAttachmentUpload)
  const docList = documents ?? []

  return (
    <div className="flex flex-col gap-6">
      {editable ? (
        <div className="space-y-2">
          {uploading ? (
            <div className="w-full max-w-md space-y-1.5">
              {typeof uploadProgress === "number" && uploadProgress >= 0 ? (
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-150 ease-out"
                    style={{ width: `${Math.min(100, uploadProgress)}%` }}
                  />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground truncate">
                {uploadStatusLabel || "Uploading…"}
              </p>
            </div>
          ) : null}
          <label
            className={cn(
              "flex w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-all text-muted-foreground",
              uploading ? "pointer-events-none opacity-60" : "hover:border-primary/50 hover:bg-primary/5 hover:text-primary",
            )}
          >
            {showUploader ? (
              <Upload className="h-6 w-6 shrink-0" aria-hidden />
            ) : (
              <Camera className="h-6 w-6 shrink-0" aria-hidden />
            )}
            <span className="text-sm font-medium text-foreground">
              {uploading ? "Uploading…" : showUploader ? "Upload photos or documents" : "Add photo"}
            </span>
            {showUploader ? (
              <span className="text-xs text-muted-foreground max-w-sm leading-snug">
                Supports images, PDFs, and common document files.
              </span>
            ) : (
              <span className="text-xs text-muted-foreground max-w-sm leading-snug">
                Images are saved on this work order.
              </span>
            )}
            <input
              type="file"
              accept={showUploader ? ATTACHMENT_INPUT_ACCEPT : "image/*"}
              multiple
              className="hidden"
              disabled={Boolean(uploading)}
              onChange={showUploader ? handleUpload : handleFileLegacy}
            />
          </label>
        </div>
      ) : null}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Photos</p>
        <div className="flex flex-wrap gap-3">
          {photos.map((src, i) => (
            <div
              key={`${src.slice(0, 48)}-${i}`}
              className="relative group w-28 h-28 rounded-lg overflow-hidden border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
              {editable && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {photos.length === 0 && !editable && (
          <p className="text-sm text-muted-foreground mt-2">No images yet.</p>
        )}
        {photos.length === 0 && editable && (
          <p className="text-sm text-muted-foreground mt-2">No photos yet. Use the upload area above.</p>
        )}
      </div>

      {docList.length > 0 || editable ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Documents</p>
          {docList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No PDFs or documents yet. Use the upload area above.
            </p>
          ) : (
            <ul className="space-y-2">
              {docList.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 bg-muted/20"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    {documentAttachmentIcon(d.fileType)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{d.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(d.fileSizeBytes)} · {formatDateTime(d.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8" asChild>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open or download"
                        aria-label="Open or download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                    {editable && onRemoveDocument ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void onRemoveDocument(d.id)}
                        aria-label="Delete attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
  id,
}: {
  title: string
  icon: LucideIcon
  children: React.ReactNode
  id?: string
}) {
  return (
    <Card id={id} className="border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ─── Customer signature (preview + modal canvas) ─────────────────────────────

function signatureCanvasGetPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  if ("touches" in e) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY,
    }
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

function SignatureCaptureDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  onConfirm: (blob: Blob, name: string) => Promise<void>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [signerName, setSignerName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }, [])

  useEffect(() => {
    if (!open) return
    setSignerName("")
    resetCanvas()
  }, [open, resetCanvas])

  function startDraw(e: MouseEvent | TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const pos = signatureCanvasGetPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  function draw(e: MouseEvent | TouchEvent) {
    if (!drawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const pos = signatureCanvasGetPos(e, canvas)
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.strokeStyle = "#1a1a2e"
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasStrokes(true)
  }

  function endDraw() {
    setDrawing(false)
  }

  async function handleSave() {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokes || !signerName.trim()) return
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create PNG"))), "image/png")
    })
    setSubmitting(true)
    try {
      await onConfirm(blob, signerName.trim())
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>Customer signature</DialogTitle>
          <DialogDescription>
            Sign with mouse or touch, enter the signer&apos;s name, then save.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Signer&apos;s full name"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            className="max-w-full sm:max-w-md"
            disabled={submitting}
          />
          <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white touch-none select-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={160}
              className="w-full cursor-crosshair max-h-40"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <p className="text-xs text-muted-foreground">Draw signature using mouse or touch</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => resetCanvas()} disabled={submitting}>
            Clear
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={submitting || !hasStrokes || !signerName.trim()}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CustomerSignatureSection({
  legacySigData,
  customerSignaturePreviewUrl,
  customerSignatureCapturedAt,
  signedBy,
  signedAt,
  captureEnabled,
  onCustomerSignatureSave,
}: {
  legacySigData: string
  customerSignaturePreviewUrl?: string | null
  customerSignatureCapturedAt?: string | null
  signedBy: string
  signedAt: string
  captureEnabled: boolean
  onCustomerSignatureSave?: (blob: Blob, name: string) => Promise<void>
}) {
  const [modalOpen, setModalOpen] = useState(false)

  const previewFromStorage = customerSignaturePreviewUrl?.trim() || null
  const legacySignedMarker = legacySigData === "SIGNED"
  const legacyDataUrl =
    !legacySignedMarker && legacySigData?.trim() ? legacySigData : null
  const imageSrc = previewFromStorage || legacyDataUrl
  const capturedLabel = customerSignatureCapturedAt || signedAt
  const showCheckOnly = legacySignedMarker && !previewFromStorage

  return (
    <div className="flex flex-col gap-3">
      {showCheckOnly ? (
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          <div className="flex items-center gap-2 h-20">
            <CheckCircle2 className="w-5 h-5 text-[color:var(--status-success)]" />
            <div>
              <p className="text-sm font-medium text-foreground">Signed by {signedBy || "Customer"}</p>
              {capturedLabel ? <p className="text-xs text-muted-foreground">{formatDateTime(capturedLabel)}</p> : null}
            </div>
          </div>
        </div>
      ) : imageSrc ? (
        <div className="border border-border rounded-lg p-4 bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="Customer signature" className="max-h-32 w-auto object-contain mx-auto" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No signature captured.</p>
      )}

      {!showCheckOnly && (signedBy || capturedLabel) ? (
        <p className="text-xs text-muted-foreground">
          {signedBy ? (
            <>
              Signed by <strong>{signedBy}</strong>
              {capturedLabel ? <> · {formatDateTime(capturedLabel)}</> : null}
            </>
          ) : capturedLabel ? (
            <>{formatDateTime(capturedLabel)}</>
          ) : null}
        </p>
      ) : null}

      {captureEnabled && onCustomerSignatureSave ? (
        <>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setModalOpen(true)}>
            <PenLine className="w-3.5 h-3.5 mr-1.5" />
            {imageSrc || showCheckOnly ? "Replace signature" : "Capture signature"}
          </Button>
          <SignatureCaptureDialog
            open={modalOpen}
            onOpenChange={setModalOpen}
            onConfirm={onCustomerSignatureSave}
          />
        </>
      ) : null}
    </div>
  )
}

export interface WorkOrderDetailExperienceProps {
  workOrder: WorkOrder
  internalNotes: string
  onInternalNotesChange?: (v: string) => void
  internalNotesEditable?: boolean
  planServices: unknown[] | null
  activityItems: WorkOrderActivityItem[]
  /** Repair log fields (controlled) */
  problemReported: string
  onProblemReportedChange: (v: string) => void
  diagnosis: string
  onDiagnosisChange: (v: string) => void
  technicianNotes: string
  onTechnicianNotesChange: (v: string) => void
  parts: Part[]
  onPartsChange: (parts: Part[]) => void
  laborHours: number
  onLaborHoursChange: (n: number) => void
  laborRatePerHour: number
  photos: string[]
  onPhotosChange: (photos: string[]) => void
  /** When supplied, indices align with `photos` for Supabase-backed rows. */
  photoAttachmentIds?: (string | undefined)[]
  documentAttachments?: WorkOrderDocumentAttachmentView[]
  onAttachmentUpload?: (files: FileList) => void | Promise<void>
  onRemoveAttachmentPhoto?: (attachmentId: string) => void | Promise<void>
  onRemoveLegacyPhoto?: (index: number) => void
  onRemoveDocument?: (attachmentId: string) => void | Promise<void>
  attachmentUploading?: boolean
  /** 0–100 while a batch upload is in progress. */
  attachmentUploadProgress?: number | null
  attachmentUploadStatusLabel?: string
  tasks: { id: string; label: string; done: boolean; description?: string }[]
  onTasksChange: (tasks: { id: string; label: string; done: boolean; description?: string }[]) => void
  /** Legacy repair_log canvas data URL or `"SIGNED"` marker (shown if no storage preview). */
  sigData: string
  signedBy: string
  signedAt: string
  customerSignaturePreviewUrl?: string | null
  customerSignatureCapturedAt?: string | null
  onCustomerSignatureSave?: (blob: Blob, signerName: string) => Promise<void>
  /** When true, show Capture/Replace and modal (independent of repair-log edit mode). */
  signatureCaptureEnabled?: boolean
  /** Field editors */
  fieldsEditable: boolean
  /** When false, problem reported stays read-only even if `fieldsEditable` (e.g. drawer). */
  problemEditable?: boolean
  /** When true, Problem reported is always a textarea (e.g. drawer inline save). */
  problemReportedInlineEditable?: boolean
  /** e.g. Unsaved / Save / Cancel above Problem reported (drawer). */
  problemReportedToolbar?: ReactNode
  partsPhotosEditable: boolean
  tasksEditable: boolean
  /** Quick actions */
  onEditWorkOrder: () => void
  onAssignTechnician: () => void
  onMarkComplete: () => void | Promise<void>
  quoteHref: string
  onInvoicePlaceholder: () => void
  onPrint?: () => void
  onArchive?: () => void
  /** Optional link to full page (drawer) */
  fullPageHref?: string
  /** Leading slot (e.g. back button on page) */
  leading?: React.ReactNode
  /** `drawer` aligns chrome with `EquipmentDrawer` (underline tabs, KPI cards, quick actions). */
  layout?: "page" | "drawer"
  /** Controlled tabs (e.g. confirm before leaving Parts tab with unsaved edits). Requires both. */
  tabsValue?: string
  onTabsValueChange?: (value: string) => void
  /** Inserted above the parts table (e.g. save / revert bar in the drawer). */
  partsTabToolbar?: ReactNode
  /** Inserted above the tasks checklist (e.g. save / revert bar). */
  tasksTabToolbar?: ReactNode
  /** Inserted above Labor hours (e.g. save / revert bar). */
  laborTabToolbar?: ReactNode
  /** Inserted above Notes sections (e.g. drawer inline notes save bar). */
  notesTabToolbar?: ReactNode
  /** Optional calibration/certificate tab content. */
  certificateTabContent?: ReactNode
  /** Optional toolbar shown above certificate content. */
  certificateTabToolbar?: ReactNode
  /**
   * When true, Diagnosis / Technician / Internal notes use textareas regardless of `fieldsEditable`
   * (e.g. work order drawer Notes tab without global edit mode).
   */
  notesFieldsEditable?: boolean
  /** Certificate / customer signature status chips (drawer + page). */
  workflowHints?: {
    certificateAssigned: boolean
    certificateComplete: boolean
    signatureCaptured: boolean
  }
  /** Shown after work is completed (e.g. PDF, signature, invoice shortcuts). */
  postCompletionActions?: ReactNode
  /** Multi-asset jobs: equipment rows from `work_order_equipment` (+ fallback primary). */
  equipmentAssets?: WorkOrderEquipmentAsset[]
  /** Opens Certificate tab and focuses the asset (parent controls tab state). */
  onNavigateToCertificateForEquipment?: (equipmentId: string) => void
  /** Remove asset from work order (`work_order_equipment` row); optional. */
  onRemoveEquipmentAsset?: (joinRowId: string) => void
  /** Open modal to attach more customer equipment (e.g. work order drawer). */
  onOpenAddEquipment?: () => void
}

export function WorkOrderDetailExperience({
  workOrder,
  internalNotes,
  onInternalNotesChange,
  internalNotesEditable = false,
  planServices,
  activityItems,
  problemReported,
  onProblemReportedChange,
  diagnosis,
  onDiagnosisChange,
  technicianNotes,
  onTechnicianNotesChange,
  parts,
  onPartsChange,
  laborHours,
  onLaborHoursChange,
  laborRatePerHour,
  photos,
  onPhotosChange,
  photoAttachmentIds,
  documentAttachments,
  onAttachmentUpload,
  onRemoveAttachmentPhoto,
  onRemoveLegacyPhoto,
  onRemoveDocument,
  attachmentUploading,
  attachmentUploadProgress,
  attachmentUploadStatusLabel,
  tasks,
  onTasksChange,
  sigData,
  signedBy,
  signedAt,
  customerSignaturePreviewUrl,
  customerSignatureCapturedAt,
  onCustomerSignatureSave,
  signatureCaptureEnabled = false,
  fieldsEditable,
  problemEditable,
  problemReportedInlineEditable = false,
  problemReportedToolbar,
  partsPhotosEditable,
  tasksEditable,
  onEditWorkOrder,
  onAssignTechnician,
  onMarkComplete,
  quoteHref,
  onInvoicePlaceholder,
  onPrint,
  onArchive,
  fullPageHref,
  leading,
  layout = "page",
  tabsValue,
  onTabsValueChange,
  partsTabToolbar,
  tasksTabToolbar,
  laborTabToolbar,
  notesTabToolbar,
  certificateTabContent,
  certificateTabToolbar,
  notesFieldsEditable = false,
  workflowHints,
  postCompletionActions,
  equipmentAssets = [],
  onNavigateToCertificateForEquipment,
  onRemoveEquipmentAsset,
  onOpenAddEquipment,
}: WorkOrderDetailExperienceProps) {
  const [fallbackTab, setFallbackTab] = useState("overview")
  const tabsControlled = tabsValue !== undefined && onTabsValueChange !== undefined
  const activeTab = tabsControlled ? tabsValue : fallbackTab
  const handleTabChange = (v: string) => {
    if (tabsControlled) onTabsValueChange(v)
    else setFallbackTab(v)
  }

  const isDrawer = layout === "drawer"
  const laborCost = laborHours * laborRatePerHour
  const partsCost = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0)
  const canMarkComplete =
    workOrder.status !== "Completed" &&
    workOrder.status !== "Invoiced" &&
    workOrder.status !== "Completed Pending Signature"
  const canEditProblem = problemEditable ?? fieldsEditable
  const notesInlineEditable = Boolean(notesFieldsEditable)
  const diagnosisNotesEditable = notesInlineEditable || fieldsEditable
  const technicianNotesEditable = notesInlineEditable || fieldsEditable
  const internalNotesTabEditable =
    (notesInlineEditable || internalNotesEditable) && Boolean(onInternalNotesChange)
  const qaVariant = isDrawer ? "secondary" : "outline"
  const qaBtnClass = isDrawer ? "h-8 gap-1.5 text-xs shadow-sm" : "gap-1.5"
  const kpiCellClass = isDrawer
    ? "bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
    : "flex items-start gap-2.5 p-3 rounded-lg bg-card border border-border"
  const kpiLabelClass = isDrawer
    ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
    : "text-xs text-muted-foreground"
  const kpiValueClass = isDrawer ? "text-xl font-bold tracking-tight text-foreground truncate" : "text-sm font-medium text-foreground truncate"

  function toggleTask(id: string) {
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function addTask() {
    onTasksChange([
      ...tasks,
      { id: `task-${Date.now()}`, label: "", done: false },
    ])
  }

  function updateTask(id: string, patch: Partial<{ label: string; description: string | undefined; done: boolean }>) {
    onTasksChange(tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  const tabListClass = isDrawer
    ? "h-auto min-h-0 w-full flex flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain justify-start gap-0 rounded-none bg-background p-0 border-0 border-b border-border shrink-0 z-[11] px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "h-auto min-h-10 w-full flex flex-wrap justify-start gap-1 rounded-xl bg-muted/60 p-1 border border-border"

  const tabTriggerClass = (extra?: string) =>
    cn(
      "text-xs font-medium gap-1.5 whitespace-nowrap shrink-0 transition-colors",
      isDrawer
        ? cn(
            "grow-0 basis-auto",
            "rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 shadow-none",
            "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
            "text-muted-foreground hover:text-foreground hover:border-border",
            extra,
          )
        : cn(
            "data-[state=active]:bg-card rounded-md border border-transparent px-2 py-1",
            extra,
          ),
    )

  const tabScrollWrapClass = isDrawer
    ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 space-y-5"
    : undefined

  return (
    <div
      className={cn(
        "flex flex-col",
        isDrawer ? "min-h-0 flex-1 gap-0 overflow-hidden" : "gap-5",
      )}
    >
      {leading}

      {!isDrawer && (
        <>
          {/* Premium header (full page) */}
          <div className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                      {getWorkOrderDisplay(workOrder)}
                    </h1>
                    <Badge variant="secondary" className={cn("border text-xs", STATUS_STYLE[workOrder.status])}>
                      {workOrder.status}
                    </Badge>
                    <span className={cn("text-xs font-semibold uppercase tracking-wide", PRIORITY_STYLE[workOrder.priority])}>
                      {workOrder.priority} priority
                    </span>
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      {workOrder.type}
                    </Badge>
                    {workOrder.createdByPmAutomation ? (
                      <Badge variant="secondary" className="text-xs border border-border">
                        Created by PM automation
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">{workOrder.description}</p>
                </div>
                {fullPageHref && (
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link href={fullPageHref}>Open full page</Link>
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/25 border border-border/80">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
                    <Link
                      href={`/customers?open=${workOrder.customerId}`}
                      className="text-sm font-semibold text-primary hover:underline block truncate"
                    >
                      {workOrder.customerName}
                    </Link>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/25 border border-border/80">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Equipment</p>
                    <Link
                      href={`/equipment/${workOrder.equipmentId}`}
                      className="text-sm font-semibold text-primary hover:underline block truncate"
                    >
                      {workOrder.equipmentName}
                    </Link>
                    {workOrder.location ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{workOrder.location}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {workOrder.maintenancePlanId && !isDrawer && (
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <MaintenancePlansLucideIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Maintenance plan source
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/maintenance-plans?open=${workOrder.maintenancePlanId}`}
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              {workOrder.maintenancePlanName?.trim() || "View plan"}
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </Link>
            <span className="text-xs text-muted-foreground">
              · {workOrder.createdByPmAutomation ? "Created by PM automation" : "Created from this recurring plan"}
            </span>
          </div>
        </div>
      )}

      {!isDrawer && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={qaVariant} className={qaBtnClass} onClick={onEditWorkOrder}>
            <Pencil className="w-3.5 h-3.5" />
            Edit work order
          </Button>
          <Button size="sm" variant={qaVariant} className={qaBtnClass} onClick={onAssignTechnician}>
            <UserPlus className="w-3.5 h-3.5" />
            Assign technician
          </Button>
          {canMarkComplete && (
            <Button size="sm" variant={qaVariant} className={qaBtnClass} onClick={() => void onMarkComplete()}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete Work Order
            </Button>
          )}
          <Button size="sm" variant={qaVariant} className={qaBtnClass} asChild>
            <Link href={quoteHref}>
              <FileText className="w-3.5 h-3.5" />
              Create quote
            </Link>
          </Button>
          <Button
            size="sm"
            variant={qaVariant}
            className={cn(qaBtnClass, !isDrawer && "opacity-70")}
            type="button"
            onClick={onInvoicePlaceholder}
            title="Create an invoice for this work"
          >
            <Receipt className="w-3.5 h-3.5" />
            Create invoice
          </Button>
          {onPrint && (
            <Button size="sm" variant={qaVariant} className={qaBtnClass} type="button" onClick={onPrint}>
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
          )}
          {onArchive && (
            <Button
              size="sm"
              variant={qaVariant}
              className={cn(
                qaBtnClass,
                "border-destructive/40 text-destructive hover:bg-destructive/10",
              )}
              type="button"
              onClick={onArchive}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              Archive
            </Button>
          )}
        </div>
      )}

      {!isDrawer && workflowHints ? (
        <div className="flex flex-wrap gap-2">
          {workflowHints.certificateAssigned ? (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                workflowHints.certificateComplete
                  ? "border-[color:var(--status-success)]/40 text-[color:var(--status-success)]"
                  : "border-amber-500/40 text-amber-800 dark:text-amber-200",
              )}
            >
              Certificates {workflowHints.certificateComplete ? "complete" : "incomplete"}
            </Badge>
          ) : null}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              workflowHints.signatureCaptured
                ? "border-[color:var(--status-success)]/40 text-[color:var(--status-success)]"
                : "border-destructive/35 text-destructive",
            )}
          >
            Signature {workflowHints.signatureCaptured ? "captured" : "missing"}
          </Badge>
        </div>
      ) : null}
      {!isDrawer && postCompletionActions ? (
        <div className="rounded-xl border border-border bg-muted/15 px-4 py-3 space-y-2">{postCompletionActions}</div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className={cn(isDrawer ? "flex min-h-0 flex-1 flex-col gap-0 overflow-hidden" : "gap-4")}
      >
        <TabsList className={tabListClass}>
          <TabsTrigger value="overview" className={tabTriggerClass()}>
            <ClipboardList className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className={tabTriggerClass()}>
            <Hammer className="w-3.5 h-3.5" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="parts" className={tabTriggerClass()}>
            <Package className="w-3.5 h-3.5" />
            Parts / Materials
          </TabsTrigger>
          <TabsTrigger value="labor" className={tabTriggerClass()}>
            <Clock className="w-3.5 h-3.5" />
            Labor
          </TabsTrigger>
          {certificateTabContent ? (
            <TabsTrigger value="certificates" className={tabTriggerClass()}>
              <FileBadge2 className="w-3.5 h-3.5" />
              Certificates
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="attachments" className={tabTriggerClass()}>
            <Paperclip className="w-3.5 h-3.5" />
            Attachments
          </TabsTrigger>
          <TabsTrigger value="notes" className={tabTriggerClass()}>
            <StickyNote className="w-3.5 h-3.5" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="activity" className={tabTriggerClass()}>
            <History className="w-3.5 h-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        <div className={tabScrollWrapClass}>

        <TabsContent value="overview" className="space-y-4 mt-0">
          {isDrawer && workOrder.description?.trim() && (
            <p className="text-sm text-muted-foreground leading-snug">{workOrder.description}</p>
          )}

          {isDrawer && workOrder.maintenancePlanId && (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <MaintenancePlansLucideIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Maintenance plan source
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/maintenance-plans?open=${workOrder.maintenancePlanId}`}
                  className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  {workOrder.maintenancePlanName?.trim() || "View plan"}
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </Link>
                <span className="text-xs text-muted-foreground">
                  · {workOrder.createdByPmAutomation ? "Created by PM automation" : "Created from this recurring plan"}
                </span>
              </div>
            </div>
          )}

          {(equipmentAssets.length > 0 || onOpenAddEquipment) && (
            <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Boxes className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Equipment on this work order
                  </p>
                </div>
                {onOpenAddEquipment ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={onOpenAddEquipment}
                  >
                    + Add Equipment
                  </Button>
                ) : null}
              </div>
              <div className="divide-y divide-border/70 px-3 py-2 sm:px-4 sm:py-3 space-y-0">
                {equipmentAssets.map((asset) => {
                  const categoryLocation = [asset.category, asset.locationLabel].filter((x) => x?.trim()).join(" · ") || "—"
                  return (
                    <div
                      key={`${asset.id}-${asset.joinRowId ?? "legacy"}`}
                      className={cn(
                        "py-3 first:pt-1 last:pb-1 rounded-lg px-2 -mx-1 transition-colors",
                        asset.isPrimary && "bg-primary/[0.04] ring-1 ring-primary/15",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground leading-snug">{asset.name}</p>
                            {asset.isPrimary ? (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 text-primary">
                                Primary
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="text-muted-foreground/80">Code:</span>{" "}
                            {(asset.equipmentCode ?? "").trim() || "—"}
                            <span className="mx-1.5 text-border">·</span>
                            <span className="text-muted-foreground/80">Serial:</span>{" "}
                            {(asset.serialNumber ?? "").trim() || "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            <span className="text-muted-foreground/80">Category / location:</span> {categoryLocation}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 shrink-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {asset.typeLabel}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[10px] font-normal", PRIORITY_STYLE[asset.priorityLabel])}>
                              {asset.priorityLabel}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[10px] font-normal", certificateStatusBadgeClass(asset.certificateStatus))}>
                              {certificateStatusLabel(asset.certificateStatus)}
                            </Badge>
                          </div>
                          {onRemoveEquipmentAsset && asset.joinRowId && equipmentAssets.length > 1 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground"
                                  aria-label="Equipment actions"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[120]">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => onRemoveEquipmentAsset(asset.joinRowId!)}
                                >
                                  Remove from work order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" asChild>
                          <Link href={`/equipment/${asset.id}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                            View equipment
                          </Link>
                        </Button>
                        {certificateTabContent && onNavigateToCertificateForEquipment ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => onNavigateToCertificateForEquipment(asset.id)}
                          >
                            <FileBadge2 className="w-3.5 h-3.5" />
                            Certificates
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {workOrder.priority === "Critical" && (
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Critical priority — dispatch and document promptly.
            </div>
          )}
          {workOrder.equipmentWarrantyActive ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-[color:var(--status-warning)]/35 bg-[color:var(--status-warning)]/10 p-3 text-sm font-medium text-[color:var(--status-warning)]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              This asset may be under warranty. Review coverage before billing customer.
            </div>
          ) : null}

          {isDrawer && !fieldsEditable && (
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick actions</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" onClick={onEditWorkOrder}>
                  <Pencil className="w-3.5 h-3.5" />
                  Edit work order
                </Button>
                <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" onClick={onAssignTechnician}>
                  <UserPlus className="w-3.5 h-3.5" />
                  Assign technician
                </Button>
                {canMarkComplete && (
                  <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" onClick={() => void onMarkComplete()}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete Work Order
                  </Button>
                )}
                <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" asChild>
                  <Link href={quoteHref}>
                    <FileText className="w-3.5 h-3.5" />
                    Create quote
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1.5 text-xs shadow-sm opacity-80"
                  type="button"
                  onClick={onInvoicePlaceholder}
                  title="Create an invoice for this work"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Create invoice
                </Button>
                {onPrint && (
                  <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs shadow-sm" type="button" onClick={onPrint}>
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </Button>
                )}
                {onArchive && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 text-xs shadow-sm border-destructive/40 text-destructive hover:bg-destructive/10"
                    type="button"
                    onClick={onArchive}
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    Archive
                  </Button>
                )}
              </div>
            </div>
          )}

          {isDrawer && workflowHints ? (
            <div className="flex flex-wrap gap-2">
              {workflowHints.certificateAssigned ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    workflowHints.certificateComplete
                      ? "border-[color:var(--status-success)]/40 text-[color:var(--status-success)]"
                      : "border-amber-500/40 text-amber-800 dark:text-amber-200",
                  )}
                >
                  Certificates {workflowHints.certificateComplete ? "complete" : "incomplete"}
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  workflowHints.signatureCaptured
                    ? "border-[color:var(--status-success)]/40 text-[color:var(--status-success)]"
                    : "border-destructive/35 text-destructive",
                )}
              >
                Signature {workflowHints.signatureCaptured ? "captured" : "missing"}
              </Badge>
            </div>
          ) : null}
          {isDrawer && postCompletionActions ? (
            <div className="rounded-xl border border-border bg-muted/15 px-4 py-3 space-y-2">{postCompletionActions}</div>
          ) : null}

          <div className={cn("grid", isDrawer ? "grid-cols-2 lg:grid-cols-4 gap-2" : "grid-cols-2 lg:grid-cols-4 gap-3")}>
            {isDrawer ? (
              <>
                <div className={kpiCellClass}>
                  <p className={kpiLabelClass}>Site / location</p>
                  <p className={kpiValueClass}>{workOrder.location || "—"}</p>
                </div>
                <div className={kpiCellClass}>
                  <p className={kpiLabelClass}>Technician</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <TechnicianAvatar
                      userId={workOrder.technicianId === "unassigned" ? "—" : workOrder.technicianId}
                      name={workOrder.technicianName}
                      initials={initialsFromTechnicianName(workOrder.technicianName)}
                      avatarUrl={workOrder.technicianAvatarUrl}
                      size="sm"
                    />
                    {workOrder.technicianId !== "unassigned" ? (
                      <Link
                        href={`/technicians?open=${workOrder.technicianId}`}
                        className={cn(kpiValueClass, "hover:underline text-primary truncate")}
                      >
                        {workOrder.technicianName}
                      </Link>
                    ) : (
                      <p className={kpiValueClass}>{workOrder.technicianName}</p>
                    )}
                  </div>
                </div>
                <div className={kpiCellClass}>
                  <p className={kpiLabelClass}>Scheduled</p>
                  <p className={kpiValueClass}>{formatDate(workOrder.scheduledDate)}</p>
                  {workOrder.scheduledTime ? (
                    <p className="text-[10px] text-muted-foreground leading-snug">at {workOrder.scheduledTime}</p>
                  ) : null}
                </div>
                <div className={kpiCellClass}>
                  <p className={kpiLabelClass}>Created</p>
                  <p className={kpiValueClass}>{formatDate(workOrder.createdAt.slice(0, 10))}</p>
                </div>
              </>
            ) : (
              <>
                <div className={kpiCellClass}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className={kpiLabelClass}>Site / location</p>
                      <p className={kpiValueClass}>{workOrder.location || "—"}</p>
                    </div>
                  </div>
                </div>
                <div className={kpiCellClass}>
                  <div className="flex items-start gap-2.5">
                    <TechnicianAvatar
                      userId={workOrder.technicianId === "unassigned" ? "—" : workOrder.technicianId}
                      name={workOrder.technicianName}
                      initials={initialsFromTechnicianName(workOrder.technicianName)}
                      avatarUrl={workOrder.technicianAvatarUrl}
                      size="sm"
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className={kpiLabelClass}>Technician</p>
                      {workOrder.technicianId !== "unassigned" ? (
                        <Link
                          href={`/technicians?open=${workOrder.technicianId}`}
                          className={cn(kpiValueClass, "hover:underline text-primary block truncate")}
                        >
                          {workOrder.technicianName}
                        </Link>
                      ) : (
                        <p className={kpiValueClass}>{workOrder.technicianName}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className={kpiCellClass}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className={kpiLabelClass}>Scheduled</p>
                      <p className={kpiValueClass}>{formatDate(workOrder.scheduledDate)}</p>
                      {workOrder.scheduledTime ? (
                        <p className="text-xs text-muted-foreground truncate">at {workOrder.scheduledTime}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className={kpiCellClass}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className={kpiLabelClass}>Created</p>
                      <p className={kpiValueClass}>{formatDate(workOrder.createdAt.slice(0, 10))}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {workOrder.location && (
            <AppointmentActions
              address={workOrder.location}
              emailParams={{
                customerName: workOrder.customerName,
                equipmentName: workOrder.equipmentName,
                technicianName: workOrder.technicianName,
                scheduledDate: workOrder.scheduledDate,
                scheduledTime: workOrder.scheduledTime,
                address: workOrder.location,
                workOrderId: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber ?? null,
                workOrderTitle: workOrder.description,
                ccEmails: ["service@equipify.ai"],
              }}
            />
          )}

          <div className={cn("grid grid-cols-1 sm:grid-cols-3", isDrawer ? "gap-2" : "gap-3")}>
            <div
              className={
                isDrawer
                  ? "bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
                  : "p-3 rounded-lg bg-card border border-border"
              }
            >
              <p className={cn(isDrawer ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "text-xs text-muted-foreground mb-1")}>
                Labor (est.)
              </p>
              <p className={cn(isDrawer ? "text-xl font-bold tracking-tight tabular-nums" : "text-lg font-bold tabular-nums")}>
                ${laborCost.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                {laborHours} hrs × ${laborRatePerHour}/hr
              </p>
            </div>
            <div
              className={
                isDrawer
                  ? "bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
                  : "p-3 rounded-lg bg-card border border-border"
              }
            >
              <p className={cn(isDrawer ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "text-xs text-muted-foreground mb-1")}>
                Parts (line items)
              </p>
              <p className={cn(isDrawer ? "text-xl font-bold tracking-tight tabular-nums" : "text-lg font-bold tabular-nums")}>
                ${partsCost.toFixed(2)}
              </p>
            </div>
            <div
              className={
                isDrawer
                  ? "bg-card rounded-xl border border-border p-3 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[88px]"
                  : "p-3 rounded-lg bg-card border border-border"
              }
            >
              <p className={cn(isDrawer ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "text-xs text-muted-foreground mb-1")}>
                Stored totals
              </p>
              <p className={cn(isDrawer ? "text-xl font-bold tracking-tight tabular-nums" : "text-lg font-bold tabular-nums")}>
                ${(workOrder.totalLaborCost + workOrder.totalPartsCost).toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Labor + parts on work order</p>
            </div>
          </div>

          <Section title="Problem reported" icon={AlertTriangle}>
            {problemReportedInlineEditable ? (
              <>
                {problemReportedToolbar ? <div className="mb-2">{problemReportedToolbar}</div> : null}
                <Textarea
                  value={problemReported}
                  onChange={(e) => onProblemReportedChange(e.target.value)}
                  rows={3}
                  placeholder="Describe the problem reported by the customer…"
                />
              </>
            ) : canEditProblem ? (
              <Textarea
                value={problemReported}
                onChange={(e) => onProblemReportedChange(e.target.value)}
                rows={3}
                placeholder="Describe the problem reported by the customer…"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed">
                {problemReported?.trim() ? (
                  problemReported
                ) : (
                  <span className="text-muted-foreground">No problem description provided</span>
                )}
              </p>
            )}
          </Section>

          <Section title="Warranty billing status" icon={Receipt}>
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs border">
                  {workOrder.billableToCustomer === false ? "Bill vendor / warranty" : "Bill customer"}
                </Badge>
                {workOrder.warrantyReviewRequired ? (
                  <Badge variant="secondary" className="text-xs border border-[color:var(--status-warning)]/35 bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]">
                    Warranty review required
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs border border-[color:var(--status-success)]/30 bg-[color:var(--status-success)]/10 text-[color:var(--status-success)]">
                    Review complete
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Warranty vendor: <span className="text-foreground font-medium">{workOrder.warrantyVendorName || "Not linked"}</span>
              </p>
            </div>
          </Section>

          <Section title="Customer signature" icon={PenLine} id="customer-signature-section">
            <CustomerSignatureSection
              legacySigData={sigData}
              customerSignaturePreviewUrl={customerSignaturePreviewUrl}
              customerSignatureCapturedAt={customerSignatureCapturedAt}
              signedBy={signedBy}
              signedAt={signedAt}
              captureEnabled={signatureCaptureEnabled}
              onCustomerSignatureSave={onCustomerSignatureSave}
            />
          </Section>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 mt-0">
          {tasksTabToolbar ? <div className="mb-3">{tasksTabToolbar}</div> : null}
          {planServices && planServices.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Plan services (source)</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Lines from the maintenance plan that generated this visit.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {planServices.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm border border-border rounded-lg px-3 py-2.5 bg-muted/20"
                    >
                      <span className="text-muted-foreground font-mono text-xs shrink-0 w-6">{i + 1}.</span>
                      <span className="text-foreground leading-snug">{planServiceLabel(s, i)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Work order tasks</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tasks.length > 0
                    ? `${tasks.filter((x) => x.done).length} / ${tasks.length} complete`
                    : "Checklist for this job"}
                </p>
              </div>
              {tasksEditable && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addTask}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add task
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No tasks yet. Add tasks to track work on this job.</p>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/30"
                  >
                    {tasksEditable ? (
                      <>
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-2 rounded border-input shrink-0"
                            checked={t.done}
                            onChange={() => toggleTask(t.id)}
                            aria-label="Completed"
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <Input
                              value={t.label}
                              onChange={(e) => updateTask(t.id, { label: e.target.value })}
                              placeholder="Task title"
                              className="h-9 text-sm"
                            />
                            <Textarea
                              value={t.description ?? ""}
                              onChange={(e) =>
                                updateTask(t.id, {
                                  description: e.target.value.trim() ? e.target.value : undefined,
                                })
                              }
                              placeholder="Description (optional)"
                              rows={2}
                              className="text-xs resize-none min-h-[52px]"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => onTasksChange(tasks.filter((x) => x.id !== t.id))}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-input shrink-0"
                          checked={t.done}
                          disabled
                          readOnly
                          aria-label="Completed"
                        />
                        <div className="min-w-0 flex-1">
                          <span className={cn("text-sm", t.done && "line-through text-muted-foreground")}>
                            {t.label || "—"}
                          </span>
                          {t.description ? (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug whitespace-pre-wrap">
                              {t.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parts" className="mt-0">
          {partsTabToolbar ? <div className="mb-3">{partsTabToolbar}</div> : null}
          <Section title="Parts / materials" icon={Package}>
            <PartsTable parts={parts} editable={partsPhotosEditable} onChange={onPartsChange} />
          </Section>
        </TabsContent>

        <TabsContent value="labor" className="mt-0 space-y-4">
          {laborTabToolbar ? <div className="mb-3">{laborTabToolbar}</div> : null}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Labor hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {partsPhotosEditable ? (
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={Number.isFinite(laborHours) ? laborHours : 0}
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value)
                    onLaborHoursChange(Number.isFinite(v) ? v : 0)
                  }}
                  className="max-w-[10rem] h-10 text-lg font-semibold"
                />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{laborHours} hrs</p>
              )}
              <p className="text-xs text-muted-foreground">
                Estimated labor value at ${laborRatePerHour}/hr:{" "}
                <span className="font-semibold text-foreground">${laborCost.toFixed(2)}</span>
              </p>
              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Stored labor total on work order:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  ${workOrder.totalLaborCost.toFixed(2)}
                </span>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {certificateTabContent ? (
          <TabsContent value="certificates" className="space-y-4 mt-0">
            {certificateTabToolbar ? <div className="mb-1">{certificateTabToolbar}</div> : null}
            {certificateTabContent}
          </TabsContent>
        ) : null}

        <TabsContent value="attachments" className="mt-0">
          <Section title="Attachments" icon={Paperclip}>
            <PhotoSection
              photos={photos}
              photoAttachmentIds={photoAttachmentIds}
              documents={documentAttachments}
              editable={partsPhotosEditable}
              uploading={attachmentUploading}
              uploadProgress={attachmentUploadProgress}
              uploadStatusLabel={attachmentUploadStatusLabel}
              onChange={onPhotosChange}
              onAttachmentUpload={onAttachmentUpload}
              onRemoveAttachmentPhoto={onRemoveAttachmentPhoto}
              onRemoveLegacyPhoto={onRemoveLegacyPhoto}
              onRemoveDocument={onRemoveDocument}
            />
          </Section>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4 mt-0">
          {notesTabToolbar ? <div className="mb-1">{notesTabToolbar}</div> : null}
          <Section title="Diagnosis" icon={FileText}>
            {diagnosisNotesEditable ? (
              <Textarea
                value={diagnosis}
                onChange={(e) => onDiagnosisChange(e.target.value)}
                rows={4}
                placeholder="Technician diagnosis and root cause…"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed">
                {diagnosis || <span className="text-muted-foreground">Not recorded.</span>}
              </p>
            )}
          </Section>
          <Section title="Technician notes" icon={PenLine}>
            {technicianNotesEditable ? (
              <Textarea
                value={technicianNotes}
                onChange={(e) => onTechnicianNotesChange(e.target.value)}
                rows={4}
                placeholder="Internal notes, follow-up recommendations…"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed">
                {technicianNotes || <span className="text-muted-foreground">No notes.</span>}
              </p>
            )}
          </Section>
          <Section title="Internal notes (work order)" icon={StickyNote}>
            {internalNotesTabEditable && onInternalNotesChange ? (
              <Textarea
                value={internalNotes}
                onChange={(e) => onInternalNotesChange(e.target.value)}
                rows={4}
                placeholder="Office / dispatcher notes…"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {internalNotes || <span className="text-muted-foreground">None.</span>}
              </p>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-0">
          <Section title="Timeline" icon={History}>
            <DrawerTimeline items={activityItems} />
          </Section>
        </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
