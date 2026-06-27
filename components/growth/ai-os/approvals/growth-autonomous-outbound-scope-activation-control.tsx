"use client"

import { useMemo, useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { evaluateAutonomousOutboundActivationEligibility } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import type { GrowthHumanApprovalEvidence } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

type Props = {
  scopeId: string
  title: string
  evidence: GrowthHumanApprovalEvidence[]
  expiresAt?: string
  readModel: GrowthBoundedAutonomousOutboundReadModel | null
  onActivated?: () => void
}

function evidenceValue(evidence: GrowthHumanApprovalEvidence[], label: string): string | null {
  const row = evidence.find((item) => item.label === label)
  if (row?.value === undefined || row.value === null) return null
  return String(row.value)
}

export function GrowthAutonomousOutboundScopeActivationControl({
  scopeId,
  title,
  evidence,
  expiresAt,
  readModel,
  onActivated,
}: Props) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const scopeRow = useMemo(() => {
    if (!readModel) return null
    return (
      readModel.approvedScopes.find((row) => row.scope.id === scopeId) ??
      readModel.activeScopes.find((row) => row.scope.id === scopeId) ??
      null
    )
  }, [readModel, scopeId])

  const eligibility = useMemo(() => {
    if (!scopeRow || !readModel) {
      return { eligible: false, reasons: ["Scope read model unavailable. Refresh and try again."] }
    }
    return evaluateAutonomousOutboundActivationEligibility({
      scope: scopeRow.scope,
      nowIso: readModel.generatedAt,
      killSwitchStatus: readModel.killSwitchStatus,
    })
  }, [readModel, scopeRow, scopeId])

  const channels = evidenceValue(evidence, "Channels") ?? scopeRow?.scope.allowedChannels.join(", ") ?? "none"
  const audienceSize = evidenceValue(evidence, "Audience size") ?? "unknown"
  const dailyLimit = evidenceValue(evidence, "Daily limit") ?? String(scopeRow?.scope.limits.maxActionsPerDay ?? "—")
  const stopConditions = evidenceValue(evidence, "Stop conditions") ?? "none"
  const source = evidenceValue(evidence, "Source") ?? "unknown"

  async function handleActivate() {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/ai-os/bounded-autonomous-outbound/scopes/${encodeURIComponent(scopeId)}/activate`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      )
      const body = (await response.json()) as {
        ok?: boolean
        message?: string
        error?: string
        validation?: { reason?: string | null }
      }
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? body.validation?.reason ?? body.error ?? "Activation failed.")
      }
      setSuccess(body.message ?? "Scope activated.")
      setOpen(false)
      onActivated?.()
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Activation failed.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-2" data-qa-control="autonomous-outbound-scope-activation">
      <Button
        type="button"
        size="sm"
        disabled={!eligibility.eligible || submitting || Boolean(success)}
        onClick={() => setOpen(true)}
      >
        {success ? "Activated" : "Activate approved scope"}
      </Button>
      {!eligibility.eligible ? (
        <p className="text-xs text-muted-foreground">{eligibility.reasons.join(" · ")}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700">{success}</p> : null}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate autonomous outbound scope?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>{title}</strong> will move to active status after all activation gates pass. This does not
                  send outbound messages.
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Source: {source}</li>
                  <li>Channels: {channels}</li>
                  <li>Audience size: {audienceSize}</li>
                  <li>Daily action limit: {dailyLimit}</li>
                  <li>Expires: {expiresAt ? new Date(expiresAt).toLocaleString() : "unknown"}</li>
                  <li>Stop conditions: {stopConditions}</li>
                </ul>
                <p className="text-amber-800">{GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={submitting} onClick={() => void handleActivate()}>
              {submitting ? "Activating…" : "Confirm activation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function scopeIdFromApprovalEvidence(evidence: GrowthHumanApprovalEvidence[]): string | null {
  return evidenceValue(evidence, "Scope ID")
}
