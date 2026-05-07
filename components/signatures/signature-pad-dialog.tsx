"use client"

/**
 * Shared signature capture dialog.
 *
 * Wraps `<SignaturePad>` inside a Dialog with Clear / Cancel / Save buttons.
 * The signer-name input is optional so the same dialog powers:
 *   - Work order customer signature capture (signer name required)
 *   - Technician stored signature draw flow (no signer name; the technician
 *     is the implied signer)
 *
 * `onConfirm` is awaited so callers can perform an upload before the dialog
 * closes; on rejection the dialog stays open so the user can retry.
 */

import * as React from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/signatures/signature-pad"

export type SignaturePadDialogProps = {
  open: boolean
  onOpenChange: (next: boolean) => void
  /**
   * Work order flow uses `(blob, name) => Promise`; the technician flow only
   * needs the blob. Both shapes are supported via discriminated overloads.
   */
  onConfirm: (blob: Blob, signerName?: string) => Promise<void>
  /** When true, requires a signer name before Save is enabled. */
  requireSignerName?: boolean
  /** Pre-fill the signer name field. */
  initialSignerName?: string
  title?: string
  description?: string
  /** Override Save button label (defaults to "Save"). */
  saveLabel?: string
  /** Disable the Save button externally (e.g. while a parent persists state). */
  disabled?: boolean
  /** Optional helper text shown beneath the canvas. */
  helperText?: string
}

export function SignaturePadDialog({
  open,
  onOpenChange,
  onConfirm,
  requireSignerName = false,
  initialSignerName = "",
  title = "Capture signature",
  description = "Sign with mouse or touch, then save.",
  saveLabel = "Save",
  disabled = false,
  helperText = "Draw signature using mouse or touch",
}: SignaturePadDialogProps) {
  const padRef = React.useRef<SignaturePadHandle>(null)
  const [signerName, setSignerName] = React.useState(initialSignerName)
  const [hasStrokes, setHasStrokes] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSignerName(initialSignerName)
    setError(null)
    setHasStrokes(false)
    // Defer until the canvas renders.
    queueMicrotask(() => padRef.current?.clear())
  }, [open, initialSignerName])

  function handleClear() {
    padRef.current?.clear()
    setHasStrokes(false)
    setError(null)
  }

  async function handleSave() {
    const trimmedName = signerName.trim()
    if (requireSignerName && !trimmedName) {
      setError("Enter the signer's full name to save.")
      return
    }
    const blob = await padRef.current?.toBlob()
    if (!blob) {
      setError("Draw a signature before saving.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(blob, requireSignerName ? trimmedName : undefined)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save signature.")
    } finally {
      setSubmitting(false)
    }
  }

  const saveDisabled =
    submitting ||
    disabled ||
    !hasStrokes ||
    (requireSignerName && !signerName.trim())

  return (
    <Dialog open={open} onOpenChange={(next) => (submitting ? null : onOpenChange(next))}>
      <DialogContent
        className="max-h-[min(90vh,560px)] overflow-y-auto sm:max-w-xl"
        showCloseButton={!submitting}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {requireSignerName ? (
            <Input
              placeholder="Signer's full name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="max-w-full sm:max-w-md"
              disabled={submitting}
              autoFocus
            />
          ) : null}
          <SignaturePad
            ref={padRef}
            onStrokesChange={setHasStrokes}
            disabled={submitting}
            ariaLabel={title}
          />
          <p className="text-xs text-muted-foreground">{helperText}</p>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={handleClear} disabled={submitting}>
            Clear
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saveDisabled}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? "Saving…" : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
