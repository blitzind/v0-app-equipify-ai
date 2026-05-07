"use client"

/**
 * Certificates + Portal Release Workflow — Phase 2
 * Technician Signature Capture — Phase 3 (draw + upload)
 *
 * Self-contained card for managing a technician's stored signature image.
 * When a signature is on file, the certificate output uses it as a fallback
 * whenever no fresh visit signature was captured for the work order.
 *
 * Two save paths share the same storage:
 *   - Upload signature: choose a transparent PNG / JPEG / WEBP file.
 *   - Draw signature: open the shared `<SignaturePadDialog>`, draw on the
 *     canvas (mouse or touch), and save the resulting PNG.
 *
 * Both flows call `uploadTechnicianSignature`, so the certificate auto-
 * fallback, RLS, and tenant scoping behave identically regardless of how
 * the signature was produced.
 */

import * as React from "react"
import { Loader2, PenLine, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  deleteTechnicianSignature,
  loadTechnicianSignaturePath,
  signedUrlForTechnicianSignature,
  uploadTechnicianSignature,
  validateSignatureFile,
} from "@/lib/technicians/signature-storage"
import { SignaturePadDialog } from "@/components/signatures/signature-pad-dialog"
import type { SupabaseClient } from "@supabase/supabase-js"

export type TechnicianSignatureCardProps = {
  organizationId: string
  technicianId: string
  technicianName: string
  canManage?: boolean
  className?: string
}

function fmtUpdated(iso: string | null): string {
  if (!iso) return "Never"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function TechnicianSignatureCard({
  organizationId,
  technicianId,
  technicianName,
  canManage = true,
  className,
}: TechnicianSignatureCardProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [storagePath, setStoragePath] = React.useState<string | null>(null)
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null)
  const [drawDialogOpen, setDrawDialogOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const refresh = React.useCallback(async () => {
    if (!organizationId || !technicianId) return
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    try {
      const sig = await loadTechnicianSignaturePath(supabase, {
        organizationId,
        technicianId,
      })
      setStoragePath(sig?.storagePath ?? null)
      setUpdatedAt(sig?.updatedAt ?? null)
      if (sig?.storagePath) {
        const url = await signedUrlForTechnicianSignature(supabase, sig.storagePath)
        setSignedUrl(url)
      } else {
        setSignedUrl(null)
      }
    } finally {
      setLoading(false)
    }
  }, [organizationId, technicianId])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  /**
   * Persist a blob as the technician's stored signature. Used by both the
   * upload-from-file flow and the draw-on-canvas flow so storage path,
   * cleanup, and certificate fallback behavior stay identical.
   */
  async function persistSignatureBlob(
    blob: Blob | File,
    successTitle = "Signature saved",
  ): Promise<void> {
    const validation = validateSignatureFile(blob as File)
    if (validation) {
      throw new Error(validation)
    }
    setBusy(true)
    const supabase = createBrowserSupabaseClient()
    try {
      await uploadTechnicianSignature(supabase, {
        organizationId,
        technicianId,
        file: blob,
      })
      toast({
        title: successTitle,
        description: "Future certificates will use this signature as a fallback.",
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      await persistSignatureBlob(file)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please retry.",
      })
    }
  }

  async function handleDrawnSignature(blob: Blob) {
    // Convert the shared canvas blob into a File so the signature-storage
    // validator can attach the expected `image/png` MIME type and produce a
    // friendly extension. The dialog throws back to itself if this rejects.
    const file = new File([blob], "drawn-signature.png", { type: "image/png" })
    await persistSignatureBlob(file, "Signature saved")
  }

  async function handleDelete() {
    if (!canManage) return
    if (!window.confirm(`Remove the stored signature for ${technicianName}?`)) return
    setBusy(true)
    const supabase = createBrowserSupabaseClient()
    try {
      await deleteTechnicianSignature(supabase, {
        organizationId,
        technicianId,
      })
      toast({ title: "Signature removed" })
      await refresh()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not remove signature",
        description: err instanceof Error ? err.message : "Please retry.",
      })
    } finally {
      setBusy(false)
    }
  }

  const hasSignature = Boolean(signedUrl)
  const uploadLabel = hasSignature ? "Replace upload" : "Upload signature"
  const drawLabel = hasSignature ? "Replace by drawing" : "Draw signature"

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <PenLine className="w-3 h-3" /> Stored signature
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload an existing signature image or draw a signature to save for certificates.
            Auto-applied to calibration certificates when no fresh signature was captured on the visit.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading signature…</p>
      ) : hasSignature ? (
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="rounded-lg border border-border bg-background px-3 py-2 max-w-[260px]">
            {/* Storage signed URLs are external; using <img> avoids a Next.js domain whitelist. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl ?? ""}
              alt={`${technicianName} signature`}
              className="max-h-20 object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground">Last updated {fmtUpdated(updatedAt)}.</p>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={() => void handleDelete()}
                disabled={busy}
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">
          No signature on file yet.
        </p>
      )}

      {canManage ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => void handleFile(e)}
          />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5 text-xs"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploadLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              disabled={busy}
              onClick={() => setDrawDialogOpen(true)}
            >
              <PenLine className="w-3.5 h-3.5" />
              {drawLabel}
            </Button>
            {!hasSignature ? (
              <span className="text-[11px] text-muted-foreground">
                Accepts transparent PNG, JPEG, or WEBP up to 2 MB.
              </span>
            ) : null}
          </div>
          <SignaturePadDialog
            open={drawDialogOpen}
            onOpenChange={setDrawDialogOpen}
            title={`Draw ${technicianName}'s signature`}
            description="Sign with mouse or touch — saved as a PNG and used as a fallback on calibration certificates."
            saveLabel="Save signature"
            helperText="Draw signature using mouse or touch. Tap Clear to start over."
            onConfirm={async (blob) => {
              await handleDrawnSignature(blob)
            }}
          />
        </>
      ) : null}
    </div>
  )
}

/**
 * Variant that resolves the operational `technicians.id` from a user-id-like
 * identifier (auth.users.id, profiles.id, or technicians.id).
 *
 * Returns `null` (nothing rendered) when no `technicians` row is found in the
 * given organization — the cert auto-fallback already degrades gracefully when
 * the org has not migrated to the operational technicians table.
 */
export function TechnicianSignatureCardForMember({
  organizationId,
  memberOrTechId,
  technicianName,
  canManage = true,
  className,
}: {
  organizationId: string
  memberOrTechId: string
  technicianName: string
  canManage?: boolean
  className?: string
}) {
  const [resolvedTechId, setResolvedTechId] = React.useState<string | null>(null)
  const [resolving, setResolving] = React.useState(true)
  const [resolveError, setResolveError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setResolving(true)
    setResolveError(false)
    void (async () => {
      const supabase = createBrowserSupabaseClient() as SupabaseClient
      try {
        // 1. Treat identifier as technicians.id directly.
        const direct = await supabase
          .from("technicians")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("id", memberOrTechId)
          .maybeSingle()
        if (!cancelled && direct.data) {
          setResolvedTechId((direct.data as { id: string }).id)
          return
        }
        // 2. Resolve via organization_members.membership_id when identifier is a user_id.
        const om = await supabase
          .from("organization_members")
          .select("membership_id")
          .eq("organization_id", organizationId)
          .eq("user_id", memberOrTechId)
          .maybeSingle()
        const membershipId = (om.data as { membership_id?: string } | null)?.membership_id ?? null
        if (!membershipId) {
          if (!cancelled) setResolvedTechId(null)
          return
        }
        const tr = await supabase
          .from("technicians")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("membership_id", membershipId)
          .maybeSingle()
        if (!cancelled) {
          setResolvedTechId((tr.data as { id?: string } | null)?.id ?? null)
        }
      } catch {
        if (!cancelled) setResolveError(true)
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, memberOrTechId])

  if (resolving) return null
  if (resolveError) return null
  if (!resolvedTechId) return null

  return (
    <TechnicianSignatureCard
      organizationId={organizationId}
      technicianId={resolvedTechId}
      technicianName={technicianName}
      canManage={canManage}
      className={className}
    />
  )
}
