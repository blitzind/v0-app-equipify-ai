"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Copy, FileDown, Loader2, Mail, Receipt } from "lucide-react"
import type { WorkOrder } from "@/lib/mock-data"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export function WorkOrderCustomerEmailDraftDialog({
  open,
  onOpenChange,
  workOrder,
  diagnosis,
  technicianNotes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrder: WorkOrder
  diagnosis: string
  technicianNotes: string
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const woLabel = getWorkOrderDisplay(workOrder)
  const draftSubject = useMemo(
    () => `Service summary — ${woLabel} (${workOrder.customerName})`,
    [woLabel, workOrder.customerName],
  )
  const draftBody = useMemo(() => {
    const lines = [
      `Hello ${workOrder.customerName},`,
      "",
      `This follows up on completed service for ${workOrder.equipmentName}${workOrder.location ? ` at ${workOrder.location}` : ""}.`,
      "",
      workOrder.description?.trim() ? `Scope: ${workOrder.description.trim()}` : null,
      diagnosis.trim() ? `Diagnosis / findings: ${diagnosis.trim()}` : null,
      technicianNotes.trim() ? `Technician notes: ${technicianNotes.trim()}` : null,
      "",
      "Please reply if you need copies of documentation or have questions about this visit.",
      "",
      "Thank you,",
      "Equipify Service Team",
    ].filter(Boolean) as string[]
    return lines.join("\n")
  }, [workOrder.customerName, workOrder.equipmentName, workOrder.location, workOrder.description, diagnosis, technicianNotes])

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`Subject: ${draftSubject}\n\n${draftBody}`)
      setCopied(true)
      toast({ title: "Copied", description: "Draft email copied to clipboard." })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Copy failed", description: "Select text manually from the draft.", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Draft customer email</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <Label>Subject</Label>
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">{draftSubject}</p>
          <Label>Body</Label>
          <Textarea readOnly rows={12} value={draftBody} className="text-sm font-sans resize-y min-h-[200px]" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => void copyDraft()}>
            <Copy className="w-4 h-4 mr-1" />
            {copied ? "Copied" : "Copy all"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STEPS = 5

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrder: WorkOrder
  certificateAssigned: boolean
  certificateComplete: boolean
  certificateBlockingMessage?: string
  signatureCaptured: boolean
  diagnosis: string
  technicianNotes: string
  /** Whether notes differ from saved — finalize will save first */
  notesDirty: boolean
  onGoToCertificateTab: () => void
  onGoToNotesTab: () => void
  onGoToSignature: () => void
  onFinalize: () => Promise<boolean>
  onPrintCertificate: () => void | Promise<void>
  onSaveCertificate: () => void
  onCreateInvoice: () => void
}

export function WorkOrderCloseOutDialog({
  open,
  onOpenChange,
  workOrder,
  certificateAssigned,
  certificateComplete,
  certificateBlockingMessage,
  signatureCaptured,
  diagnosis,
  technicianNotes,
  notesDirty,
  onGoToCertificateTab,
  onGoToNotesTab,
  onGoToSignature,
  onFinalize,
  onPrintCertificate,
  onSaveCertificate,
  onCreateInvoice,
}: Props) {
  const [step, setStep] = useState(1)
  const [finalizing, setFinalizing] = useState(false)
  const [notesReviewed, setNotesReviewed] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setStep(1)
      setFinalizing(false)
      setNotesReviewed(false)
      setDraftOpen(false)
    }
  }, [open])

  const woLabel = getWorkOrderDisplay(workOrder)
  const notesDone =
    Boolean(diagnosis.trim()) ||
    Boolean(technicianNotes.trim()) ||
    Boolean(workOrder.repairLog?.problemReported?.trim())

  const certBlocksNext = certificateAssigned && !certificateComplete

  async function handleFinalize() {
    if (!notesReviewed) return
    setFinalizing(true)
    try {
      const ok = await onFinalize()
      if (ok) setStep(5)
      else setStep(4)
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Close out work order</DialogTitle>
            <DialogDescription>
              Step {step} of {STEPS} · {woLabel}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Confirm you are ready to mark this job complete. You will review the certificate (if required), customer
                signature, and notes before updating status and moving to billing follow-up.
              </p>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Status will update from <span className="font-medium text-foreground">{workOrder.status}</span> to{" "}
                <span className="font-medium text-foreground">Completed</span>
                {signatureCaptured ? "" : " or Completed (pending signature)"} when you finish.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-1">
              {!certificateAssigned ? (
                <p className="text-sm text-muted-foreground">
                  No calibration certificate template is assigned to this work order. You can continue.
                </p>
              ) : certBlocksNext ? (
                <div className="space-y-3">
                  <div
                    className={cn(
                      "flex gap-2 rounded-lg border px-3 py-2.5 text-sm",
                      "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
                    )}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Certificate not completed</p>
                      <p className="text-xs opacity-90 mt-1">
                        {certificateBlockingMessage ?? "Save each certificate and fill required fields on the Certificates tab."}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => onGoToCertificateTab()}>
                    Open Certificates tab
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 rounded-lg border border-[color:var(--status-success)]/35 bg-[color:var(--status-success)]/10 px-3 py-2.5 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[color:var(--status-success)]" />
                  <span>Certificate requirements are satisfied.</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-1">
              {!signatureCaptured ? (
                <>
                  <div className="flex gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">Customer signature not captured</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You can still complete the job — status will be set to &quot;Completed (pending signature)&quot; until a
                        signature is recorded.
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => onGoToSignature()}>
                    Open signature section
                  </Button>
                </>
              ) : (
                <div className="flex gap-2 rounded-lg border border-[color:var(--status-success)]/35 bg-[color:var(--status-success)]/10 px-3 py-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[color:var(--status-success)]" />
                  <span>Customer signature is on file.</span>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 py-1">
              {notesDirty ? (
                <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-800 dark:text-amber-200" />
                  <span>
                    You have unsaved note edits. They will be saved automatically when you finish close-out, or open the Notes
                    tab to review first.
                  </span>
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Diagnosis</p>
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm min-h-[3rem] whitespace-pre-wrap">
                  {diagnosis.trim() ? diagnosis : "—"}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Technician notes</p>
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm min-h-[3rem] whitespace-pre-wrap">
                  {technicianNotes.trim() ? technicianNotes : "—"}
                </div>
              </div>
              {!notesDone ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  No diagnosis or technician notes yet — add detail on the Notes tab if needed.
                </p>
              ) : null}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="wo-notes-ack"
                  checked={notesReviewed}
                  onCheckedChange={(v) => setNotesReviewed(v === true)}
                />
                <Label htmlFor="wo-notes-ack" className="text-sm font-normal leading-snug cursor-pointer">
                  I have reviewed the job notes above.
                </Label>
              </div>
              <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => onGoToNotesTab()}>
                Open Notes tab
              </Button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 py-1">
              <p className="text-sm font-medium text-foreground">Close-out summary</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[color:var(--status-success)] shrink-0" />
                  <span>
                    {certificateAssigned
                      ? certificateComplete
                        ? "Certificate ready"
                        : "Certificate (pending — reopen wizard if needed)"
                      : "Certificate not required"}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[color:var(--status-success)] shrink-0" />
                  <span>{signatureCaptured ? "Signature captured" : "Signature pending — customer sign-off still needed"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[color:var(--status-success)] shrink-0" />
                  <span>{notesReviewed ? "Notes reviewed" : "Notes"}</span>
                </li>
              </ul>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-2">Next steps</p>
              <div className="flex flex-wrap gap-2">
                {workOrder.calibrationTemplateId ? (
                  <>
                    <div className="w-full space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Print / Save Certificate
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => void onPrintCertificate()}
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Print certificate
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onSaveCertificate}>
                          Save certificate (HTML)
                        </Button>
                      </div>
                    </div>
                  </>
                ) : null}
                <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={onCreateInvoice}>
                  <Receipt className="w-3.5 h-3.5" />
                  Create Invoice
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setDraftOpen(true)}>
                  <Mail className="w-3.5 h-3.5" />
                  Draft Email
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
            <div className="flex gap-2 mr-auto">
              {step > 1 && step < 5 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  disabled={finalizing}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {step < 5 ? (
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={finalizing}>
                  Cancel
                </Button>
              ) : (
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              )}
              {step === 1 && (
                <Button type="button" onClick={() => setStep(2)}>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
              {step === 2 && (
                <Button type="button" onClick={() => setStep(3)} disabled={certBlocksNext}>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
              {step === 3 && (
                <Button type="button" onClick={() => setStep(4)}>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
              {step === 4 && (
                <Button type="button" onClick={() => void handleFinalize()} disabled={!notesReviewed || finalizing}>
                  {finalizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finishing…
                    </>
                  ) : (
                    <>
                      Complete job
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkOrderCustomerEmailDraftDialog
        open={draftOpen}
        onOpenChange={setDraftOpen}
        workOrder={workOrder}
        diagnosis={diagnosis}
        technicianNotes={technicianNotes}
      />
    </>
  )
}
