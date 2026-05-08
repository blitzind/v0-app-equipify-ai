"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, FileText, Loader2, Paperclip, Trash2, UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  formatAttachmentSize,
  visibilityLabel,
  type AttachmentEntityType,
  type AttachmentType,
  type AttachmentVisibilityScope,
  type DocumentAttachmentRow,
} from "@/lib/attachments/document-attachments"

type Props = {
  entityType: AttachmentEntityType
  entityId: string
  title?: string
  description?: string
  defaultAttachmentType?: AttachmentType
  compact?: boolean
}

const ATTACHMENT_TYPE_OPTIONS: Array<{ value: AttachmentType; label: string }> = [
  { value: "external_certificate", label: "External certificate PDF" },
  { value: "service_report", label: "Service report" },
  { value: "photo", label: "Photo" },
  { value: "manual", label: "Manual" },
  { value: "compliance_document", label: "Compliance document" },
  { value: "signed_paperwork", label: "Signed paperwork" },
  { value: "document", label: "Document" },
  { value: "other", label: "Other" },
]

const VISIBILITY_OPTIONS: Array<{ value: AttachmentVisibilityScope; label: string; description: string }> = [
  { value: "internal", label: "Internal only", description: "Staff only" },
  { value: "portal_visible", label: "Portal visible", description: "Available to customers after portal checks" },
  { value: "pending_release", label: "Pending release", description: "Prepared for portal, not released yet" },
  { value: "released_after_payment", label: "Released after payment", description: "Compatible with payment-gated release flows" },
  { value: "released_manual", label: "Released manually", description: "Manually released customer-facing document" },
]

function dateLabel(value: string) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function mimeLabel(value: string) {
  if (value === "application/pdf") return "PDF"
  if (value.startsWith("image/")) return value.replace("image/", "").toUpperCase()
  if (value.includes("word")) return "DOC"
  if (value.includes("sheet") || value.includes("excel")) return "XLS"
  if (value === "text/plain") return "TXT"
  return "File"
}

export function DocumentAttachmentsPanel({
  entityType,
  entityId,
  title = "Attachments",
  description = "Upload PDFs, photos, and documents. Storage stays private and downloads use signed URLs.",
  defaultAttachmentType = "document",
  compact = false,
}: Props) {
  const { organizationId, status } = useActiveOrganization()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [attachments, setAttachments] = useState<DocumentAttachmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachmentType, setAttachmentType] = useState<AttachmentType>(defaultAttachmentType)
  const [visibility, setVisibility] = useState<AttachmentVisibilityScope>("internal")
  const [sourceSystem, setSourceSystem] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (status !== "ready" || !organizationId || !entityId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ entityType, entityId })
      const res = await fetch(`/api/organizations/${organizationId}/attachments?${params.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || "Could not load attachments.")
      setAttachments((json.attachments ?? []) as DocumentAttachmentRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load attachments.")
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType, organizationId, status])

  useEffect(() => {
    void load()
  }, [load])

  function upload(file: File) {
    if (status !== "ready" || !organizationId) return
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    const form = new FormData()
    form.set("file", file)
    form.set("entityType", entityType)
    form.set("entityId", entityId)
    form.set("attachmentType", attachmentType)
    form.set("visibilityScope", visibility)
    form.set("sourceSystem", sourceSystem)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/api/organizations/${organizationId}/attachments`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      setUploading(false)
      setUploadProgress(null)
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const parsed = JSON.parse(xhr.responseText) as { message?: string }
          setError(parsed.message || "Upload failed.")
        } catch {
          setError("Upload failed.")
        }
        return
      }
      if (inputRef.current) inputRef.current.value = ""
      void load()
    }
    xhr.onerror = () => {
      setUploading(false)
      setUploadProgress(null)
      setError("Upload failed.")
    }
    xhr.send(form)
  }

  async function updateVisibility(id: string, next: AttachmentVisibilityScope) {
    if (status !== "ready" || !organizationId) return
    const res = await fetch(`/api/organizations/${organizationId}/attachments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibilityScope: next }),
    })
    if (res.ok) void load()
  }

  async function remove(id: string) {
    if (status !== "ready" || !organizationId) return
    if (!window.confirm("Remove this attachment? This deletes the stored file and cannot be undone.")) return
    const res = await fetch(`/api/organizations/${organizationId}/attachments/${id}`, { method: "DELETE" })
    if (res.ok) void load()
  }

  return (
    <section className={cn("rounded-lg border border-border bg-card", compact ? "p-3" : "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select
          value={attachmentType}
          onChange={(e) => setAttachmentType(e.target.value as AttachmentType)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
        >
          {ATTACHMENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as AttachmentVisibilityScope)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          value={sourceSystem}
          onChange={(e) => setSourceSystem(e.target.value)}
          placeholder="Source system (optional)"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
        />
        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
          Upload
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,image/*,.txt,.doc,.docx,.xls,.xlsx"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload(file)
            }}
          />
        </label>
      </div>
      {uploadProgress !== null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading attachments...
          </div>
        ) : attachments.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs font-medium text-muted-foreground">No attachments yet</p>
          </div>
        ) : (
          attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-3 bg-background px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{attachment.file_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {mimeLabel(attachment.mime_type)} · {formatAttachmentSize(attachment.file_size_bytes)} · {dateLabel(attachment.uploaded_at)}
                </p>
              </div>
              <select
                value={attachment.visibility_scope}
                onChange={(e) => void updateVisibility(attachment.id, e.target.value as AttachmentVisibilityScope)}
                className="hidden rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground sm:block"
                title={visibilityLabel(attachment.visibility_scope)}
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <a
                href={organizationId ? `/api/organizations/${organizationId}/attachments/${attachment.id}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => void remove(attachment.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
