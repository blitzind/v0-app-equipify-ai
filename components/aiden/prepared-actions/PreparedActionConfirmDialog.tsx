"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { normalizeBulkInvoiceConfirmationPhrase } from "@/lib/aiden/actions/bulk-invoice-confirmation"
import { isFinancialRiskLevel, type AidenPreparedWorkspaceActionRiskLevel } from "@/lib/aiden/actions/action-risk"
import { cn } from "@/lib/utils"

export function PreparedActionConfirmDialog({
  open,
  onOpenChange,
  riskLevel,
  actionTitle,
  children,
  onConfirm,
  busy,
  confirmLabel = "Create Draft Invoice",
  financialNote,
  requireTypedPhrase,
  confirmDisabled = false,
  policyBlockedHint,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  riskLevel: string
  actionTitle: string
  children?: ReactNode
  onConfirm: (opts?: { typedPhrase?: string }) => void | Promise<void>
  busy: boolean
  /** Explicit primary action label (never use vague “Approve” / “Run” for billing). */
  confirmLabel?: string
  /** Optional override for the red financial disclaimer (e.g. payment link vs draft invoice). */
  financialNote?: ReactNode
  /** When set, user must type the phrase exactly (case-insensitive, collapsed spaces) before confirming. */
  requireTypedPhrase?: { expectedPhrase: string; label?: string }
  /** When true, primary confirm is disabled (e.g. workspace approval policy blocks this user). */
  confirmDisabled?: boolean
  /** Extra copy shown when confirmDisabled (e.g. who can approve). */
  policyBlockedHint?: ReactNode
}) {
  const financial = isFinancialRiskLevel(riskLevel as AidenPreparedWorkspaceActionRiskLevel)

  const [typedPhrase, setTypedPhrase] = useState("")
  useEffect(() => {
    if (!open) setTypedPhrase("")
  }, [open])

  const phraseOk =
    !requireTypedPhrase ||
    normalizeBulkInvoiceConfirmationPhrase(typedPhrase) ===
      normalizeBulkInvoiceConfirmationPhrase(requireTypedPhrase.expectedPhrase)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          "sm:max-w-md",
          financial && "border-destructive/50 shadow-md shadow-destructive/10",
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className={cn(financial && "text-destructive")}>
            {financial ? "Confirm billing action" : "Confirm action"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm text-muted-foreground">
            <span className="block">
              You are about to run: <strong className="text-foreground">{actionTitle}</strong>
            </span>
            {financial ? (
              <span className="mt-3 block rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {financialNote ?? (
                  <>
                    This updates financial records in your workspace. It does not email customers, take payment, or sync
                    to QuickBooks from this step — only what the preview describes (e.g. a draft invoice) will be
                    created.
                  </>
                )}
              </span>
            ) : (
              <>
                <span className="mt-2 block text-xs">Review the preview, then continue only if the details look correct.</span>
                {financialNote ? (
                  <span className="mt-2 block rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
                    {financialNote}
                  </span>
                ) : null}
              </>
            )}
            {children ? <span className="mt-3 block">{children}</span> : null}
            {policyBlockedHint && confirmDisabled ?
              <span className="mt-3 block rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {policyBlockedHint}
              </span>
            : null}
            {requireTypedPhrase ? (
              <span className="mt-3 block space-y-1.5">
                <Label htmlFor="aiden-bulk-confirm-phrase" className="text-xs text-foreground">
                  {requireTypedPhrase.label ?? "Confirmation phrase"}
                </Label>
                <Input
                  id="aiden-bulk-confirm-phrase"
                  autoComplete="off"
                  spellCheck={false}
                  value={typedPhrase}
                  onChange={(e) => setTypedPhrase(e.target.value)}
                  placeholder={requireTypedPhrase.expectedPhrase}
                  className="font-mono text-xs"
                  disabled={busy}
                />
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={busy || !phraseOk || confirmDisabled}
            className={cn(
              financial &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40",
            )}
            onClick={(e) => {
              e.preventDefault()
              void onConfirm(requireTypedPhrase ? { typedPhrase } : undefined)
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
