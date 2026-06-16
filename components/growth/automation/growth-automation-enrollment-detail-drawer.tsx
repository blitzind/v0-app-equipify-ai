"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { GrowthAutomationEnrollmentStatusBadge } from "@/components/growth/automation/growth-automation-enrollment-status-badge"
import { GrowthAutomationRuntimeExecutionPanel } from "@/components/growth/automation/growth-automation-runtime-execution-panel"
import type { GrowthAutomationEnrollmentRecord } from "@/lib/growth/automation/growth-automation-enrollment-types"

type Props = {
  flowId: string
  enrollment: GrowthAutomationEnrollmentRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GrowthAutomationEnrollmentDetailDrawer({ flowId, enrollment, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Enrollment detail</SheetTitle>
          <SheetDescription>
            SR-3 enrollment metadata · no execution · human review required
          </SheetDescription>
        </SheetHeader>

        {!enrollment ? (
          <p className="mt-6 text-sm text-muted-foreground">Select an enrollment to inspect.</p>
        ) : (
          <div className="mt-6 space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <GrowthAutomationEnrollmentStatusBadge
                status={enrollment.status}
                duplicate={enrollment.duplicateEnrollment}
              />
              {enrollment.duplicateEnrollment ? (
                <span className="text-xs text-muted-foreground">duplicate protection</span>
              ) : null}
            </div>

            <dl className="grid gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Enrollment ID</dt>
                <dd className="font-mono text-xs break-all">{enrollment.enrollmentId}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lead</dt>
                <dd className="font-mono text-xs break-all">{enrollment.leadId}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Runtime pattern</dt>
                <dd className="font-mono text-xs break-all">{enrollment.compiledPatternId}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Trigger</dt>
                <dd>
                  {enrollment.triggerSource}
                  {enrollment.triggerEvent ? ` · ${enrollment.triggerEvent}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Entry reason</dt>
                <dd>{enrollment.entryReason}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Entry step</dt>
                <dd className="font-mono text-xs break-all">{enrollment.entryStepId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd>{new Date(enrollment.createdAt).toLocaleString()}</dd>
              </div>
            </dl>

            {enrollment.warnings.length > 0 ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Warnings</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {enrollment.warnings.map((warning) => (
                    <li key={warning.ruleCode}>{warning.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {enrollment.errors.length > 0 ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
                <p className="text-xs font-medium text-red-800 dark:text-red-200">Errors</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {enrollment.errors.map((error) => (
                    <li key={error.ruleCode}>{error.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <GrowthAutomationRuntimeExecutionPanel
              flowId={flowId}
              enrollmentId={enrollment.enrollmentId}
              leadId={enrollment.leadId}
            />

            <div className="rounded-md border border-dashed border-border p-3 text-[10px] uppercase tracking-wide text-muted-foreground">
              enrollment only · sequence execution disabled · no send controls
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
