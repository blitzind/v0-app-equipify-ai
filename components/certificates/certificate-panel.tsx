"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useCertificates } from "@/lib/certificate-store"
import type { CalibrationCertificate } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import {
  Upload, FileText, Trash2, Download, Link2, LinkSlash,
  ShieldCheck, Calendar, AlertTriangle,
} from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function expiryStatus(expiryDate: string): "none" | "ok" | "soon" | "expired" {
  if (!expiryDate) return "none"
  const diff = (new Date(expiryDate).getTime() - Date.now()) / 86_400_000
  if (diff < 0) return "expired"
  if (diff <= 60) return "soon"
  return "ok"
}

// ─── Certificate row ──────────────────────────────────────────────────────────

function CertRow({
  cert,
  invoiceId,
  onDelete,
  onAttach,
  onDetach,
}: {
  cert: CalibrationCertificate
  invoiceId?: string
  onDelete: () => void
  onAttach?: () => void
  onDetach?: () => void
}) {
  const status = expiryStatus(cert.expiryDate)
  const isAttached = invoiceId ? cert.attachedToInvoices.includes(invoiceId) : false

  const statusIcon = {
    ok: <ShieldCheck className="w-3 h-3 text-[color:var(--status-success)]" />,
    soon: <AlertTriangle className="w-3 h-3 text-[color:var(--status-warning)]" />,
    expired: <AlertTriangle className="w-3 h-3 text-destructive" />,
    none: null,
  }[status]

  const statusText = {
    ok: `Expires ${fmtDate(cert.expiryDate)}`,
    soon: `Expires ${fmtDate(cert.expiryDate)} — soon`,
    expired: `Expired ${fmtDate(cert.expiryDate)}`,
    none: "No expiry",
  }[status]

  function handleDownload() {
    const a = document.createElement("a")
    a.href = cert.dataUrl
    a.download = cert.fileName
    a.click()
  }

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors group">
      {/* File icon */}
      <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
        <FileText className="w-4 h-4 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{cert.fileName}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {statusIcon && <span className="flex items-center gap-1 text-[10px]">{statusIcon}</span>}
          <span className={cn(
            "text-[10px]",
            status === "expired" ? "text-destructive" :
            status === "soon" ? "text-[color:var(--status-warning)]" :
            "text-muted-foreground"
          )}>{statusText}</span>
          <span className="text-[10px] text-muted-foreground">· {fmtBytes(cert.fileSize)}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Uploaded {fmtDate(cert.uploadedAt)} by {cert.uploadedBy}
        </p>
        {cert.notes && (
          <p className="text-[10px] text-muted-foreground italic mt-0.5 truncate">{cert.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={handleDownload}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title="Download"
          aria-label="Download certificate"
        >
          <Download className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
        </button>
        {invoiceId && (
          isAttached ? (
            <button
              type="button"
              onClick={onDetach}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title="Detach from invoice"
              aria-label="Detach from invoice"
            >
              <LinkSlash className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onAttach}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title="Attach to invoice"
              aria-label="Attach to invoice"
            >
              <Link2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )
        )}
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
          title="Delete"
          aria-label="Delete certificate"
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  )
}

// ─── Upload dropzone ──────────────────────────────────────────────────────────

function UploadZone({ onUpload }: { onUpload: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 px-4 text-center transition-colors cursor-pointer",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        multiple
        onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files) }}
      />
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Upload className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-xs font-semibold text-foreground">Upload certificates</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">PDF, JPG, PNG, DOC — drag & drop or click</p>
      </div>
    </div>
  )
}

// ─── Expiry date picker row ───────────────────────────────────────────────────

function ExpiryRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <label className="text-[11px] text-muted-foreground shrink-0">Expiry date</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
      />
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface CertificatePanelProps {
  equipmentId: string
  equipmentName: string
  customerId: string
  customerName: string
  /** When provided, shows attach/detach controls per cert row */
  invoiceId?: string
  uploadedBy?: string
}

export function CertificatePanel({
  equipmentId,
  equipmentName,
  customerId,
  customerName,
  invoiceId,
  uploadedBy = "Admin",
}: CertificatePanelProps) {
  const {
    addCertificate,
    deleteCertificate,
    attachToInvoice,
    detachFromInvoice,
    getCertsByEquipment,
  } = useCertificates()

  const [pendingExpiry, setPendingExpiry] = useState("")
  const [pendingNotes, setPendingNotes] = useState("")

  const certs = getCertsByEquipment(equipmentId)

  function handleUpload(files: FileList) {
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const cert: CalibrationCertificate = {
          id: `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          equipmentId,
          equipmentName,
          customerId,
          customerName,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          dataUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy,
          expiryDate: pendingExpiry,
          notes: pendingNotes,
          attachedToInvoices: [],
        }
        addCertificate(cert)
      }
      reader.readAsDataURL(file)
    })
    setPendingExpiry("")
    setPendingNotes("")
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Upload controls */}
      <div className="flex flex-col gap-2">
        <ExpiryRow value={pendingExpiry} onChange={setPendingExpiry} />
        <input
          type="text"
          value={pendingNotes}
          onChange={(e) => setPendingNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
        />
        <UploadZone onUpload={handleUpload} />
      </div>

      {/* Certificate list */}
      {certs.length > 0 && (
        <div className="flex flex-col gap-2">
          {certs.map((cert) => (
            <CertRow
              key={cert.id}
              cert={cert}
              invoiceId={invoiceId}
              onDelete={() => deleteCertificate(cert.id)}
              onAttach={invoiceId ? () => attachToInvoice(cert.id, invoiceId) : undefined}
              onDetach={invoiceId ? () => detachFromInvoice(cert.id, invoiceId) : undefined}
            />
          ))}
        </div>
      )}

      {certs.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No certificates uploaded yet.
        </p>
      )}
    </div>
  )
}
