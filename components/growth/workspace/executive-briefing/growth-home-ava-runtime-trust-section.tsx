"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { Check, Circle, Loader2, Play } from "lucide-react"
import {
  GROWTH_AVA_ACTIVATION_API_PATH,
  GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import {
  GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER,
  GROWTH_HOME_OPERATOR_CLOSURE_WHAT_HAPPENS_NEXT_TITLE,
} from "@/lib/growth/home/growth-home-operator-closure-1a"
import {
  GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER,
  type GrowthHomeRuntimeTrustViewModel,
} from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import { GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER } from "@/lib/growth/home/growth-home-runtime-execution-presentation-1b"

type Props = {
  runtimeTrust: GrowthHomeRuntimeTrustViewModel | null
  onActivated?: () => void
  /** GE-AIOS-HOME-UX-CLOSURE-1A — compact operator surface above the fold */
  operatorClosureMode?: boolean
}

export function GrowthHomeAvaRuntimeTrustSection({
  runtimeTrust,
  onActivated,
  operatorClosureMode = false,
}: Props) {
  const [activateBusy, setActivateBusy] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)

  const activate = useCallback(async () => {
    setActivateBusy(true)
    setActivateError(null)
    try {
      const response = await fetch(GROWTH_AVA_ACTIVATION_API_PATH, { method: "POST" })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Activation failed.")
      }
      onActivated?.()
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : "Activation failed.")
    } finally {
      setActivateBusy(false)
    }
  }, [onActivated])

  if (!runtimeTrust) return null
  if (runtimeTrust.showActivationScreen) return null

  const { startStatus, currentActivity, activityFeed, heartbeat, employment, employeeMode } = runtimeTrust
  const closureMode = operatorClosureMode && employeeMode
  const showEmployeeBanner =
    employeeMode && (startStatus.mode === "employee_active" || startStatus.mode === "autonomous_active")
  const showLinkAction = startStatus.primaryActionKind === "link" && startStatus.primaryActionHref
  const showActivateAction = startStatus.primaryActionKind === "activate" && startStatus.primaryActionLabel

  return (
    <section
      data-qa-section="home-ava-runtime-trust"
      data-qa-marker-launch-1b={GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER}
      data-qa-marker-launch-1c={GROWTH_AVA_ACTIVATION_1C_QA_MARKER}
      data-qa-marker-closure-1a={GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER}
      data-operator-closure-mode={closureMode ? "true" : "false"}
      data-employee-mode={employeeMode ? "true" : "false"}
      data-qa-marker-runtime-authority-1b={GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-5"
    >
      {closureMode && runtimeTrust.primaryMissionLabel ? (
        <div
          className="rounded-xl border border-indigo-200/70 bg-indigo-50/30 px-4 py-4 space-y-4 dark:border-indigo-900/40 dark:bg-indigo-950/20"
          data-home-runtime-authority-grid="true"
        >
          <AuthorityRow label="Primary mission" value={runtimeTrust.primaryMissionLabel} />
          <AuthorityRow label="Current activity" value={runtimeTrust.currentActivityLabel} />
          <AuthorityRow
            label="Current lead"
            value={runtimeTrust.currentLeadCompanyName ?? "None"}
            muted={!runtimeTrust.currentLeadCompanyName}
          />
          {runtimeTrust.operatorFocusCompanyName ? (
            runtimeTrust.operatorFocusHref ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  Operator focus
                </p>
                <Link
                  href={runtimeTrust.operatorFocusHref}
                  className="mt-1 inline-block text-lg font-semibold text-foreground hover:underline"
                >
                  {runtimeTrust.operatorFocusCompanyName}
                </Link>
              </div>
            ) : (
              <AuthorityRow label="Operator focus" value={runtimeTrust.operatorFocusCompanyName} />
            )
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-tight">
            {employeeMode ? runtimeTrust.employeePresenceLine ?? runtimeTrust.operatorStateLabel : runtimeTrust.operatorStateLabel}
          </p>
          {!employeeMode ? (
            <p className="text-sm text-muted-foreground">{runtimeTrust.statusExplanation}</p>
          ) : startStatus.detail ? (
            <p className="text-sm text-muted-foreground">{startStatus.detail}</p>
          ) : null}
        </div>
        {showEmployeeBanner ? (
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            Autonomous mode: Active
          </div>
        ) : null}
      </div>

      {runtimeTrust.nextMilestoneLabel && employeeMode ? (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Next milestone:</span> {runtimeTrust.nextMilestoneLabel}
        </div>
      ) : null}

      {runtimeTrust.idleReason && runtimeTrust.operatorState !== "working" && !employeeMode ? (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 text-sm text-foreground dark:border-amber-900/40 dark:bg-amber-950/20">
          {runtimeTrust.idleReason}
        </div>
      ) : null}

      {runtimeTrust.blockedReason && !employeeMode ? (
        <div className="rounded-xl border border-red-200/70 bg-red-50/40 px-4 py-3 text-sm text-foreground dark:border-red-900/40 dark:bg-red-950/20">
          {runtimeTrust.blockedReason}
        </div>
      ) : null}

      {(showLinkAction || showActivateAction) && !employeeMode ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4 space-y-3">
          <p className="font-medium text-foreground">{startStatus.headline}</p>
          {startStatus.detail ? <p className="text-sm text-muted-foreground">{startStatus.detail}</p> : null}
          {showLinkAction ? (
            <Link
              href={startStatus.primaryActionHref!}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Play className="size-4" aria-hidden />
              {startStatus.primaryActionLabel}
            </Link>
          ) : null}
          {showActivateAction ? (
            <button
              type="button"
              disabled={activateBusy}
              onClick={() => void activate()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {activateBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {startStatus.primaryActionLabel}
            </button>
          ) : null}
          {activateError ? <p className="text-sm text-destructive">{activateError}</p> : null}
        </div>
      ) : null}

      {employeeMode && startStatus.primaryActionLabel && startStatus.primaryActionHref ? (
        <Link
          href={startStatus.primaryActionHref}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {startStatus.primaryActionLabel}
        </Link>
      ) : null}

      {employment && employeeMode && !closureMode ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">My work with you</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employment.daysActive != null ? (
              <Stat label="Days active" value={String(employment.daysActive)} />
            ) : null}
            <Stat label="Companies researched" value={String(employment.companiesResearched)} />
            <Stat label="Opportunities prepared" value={String(employment.opportunitiesPrepared)} />
            {employment.approvalsCompleted != null ? (
              <Stat label="Approvals you've completed" value={String(employment.approvalsCompleted)} />
            ) : null}
            {employment.companiesRejected != null ? (
              <Stat label="Companies I passed on" value={String(employment.companiesRejected)} />
            ) : null}
            {employment.autonomousMinutesToday != null ? (
              <Stat label="Autonomous minutes today" value={String(employment.autonomousMinutesToday)} />
            ) : null}
          </div>
        </div>
      ) : null}

      {currentActivity ? (
        <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/30 px-4 py-4 space-y-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              {employeeMode ? "Current assignment" : "Current activity"}
            </p>
            {currentActivity.companyName && currentActivity.taskLabel ? (
              <p className="mt-1 text-base font-medium text-foreground">
                {currentActivity.taskLabel} — {currentActivity.companyName}
              </p>
            ) : currentActivity.taskLabel ? (
              <p className="mt-1 text-base font-medium text-foreground">{currentActivity.taskLabel}</p>
            ) : currentActivity.companyName ? (
              <p className="mt-1 text-base font-medium text-foreground">{currentActivity.companyName}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            {currentActivity.currentStepLabel ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current step</p>
                <p className="mt-1 text-foreground">{currentActivity.currentStepLabel}</p>
              </div>
            ) : null}
            {currentActivity.startedLabel ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Started</p>
                <p className="mt-1 text-foreground">{currentActivity.startedLabel}</p>
              </div>
            ) : null}
            {currentActivity.expectedCompletionLabel ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Expected completion
                </p>
                <p className="mt-1 text-foreground">{currentActivity.expectedCompletionLabel}</p>
              </div>
            ) : null}
          </div>

          {currentActivity.pipelineSteps.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Progress</p>
              <ul className="space-y-1.5">
                {currentActivity.pipelineSteps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2 text-sm">
                    {step.complete ? (
                      <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                    ) : step.active ? (
                      <Circle className="size-4 shrink-0 text-indigo-600 animate-pulse" aria-hidden />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                    )}
                    <span className={step.active ? "font-medium text-foreground" : "text-muted-foreground"}>
                      {step.label}
                      {step.active ? "…" : step.complete ? "" : "…"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {closureMode && runtimeTrust.whatHappensNextLines.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {GROWTH_HOME_OPERATOR_CLOSURE_WHAT_HAPPENS_NEXT_TITLE}
          </p>
          <ol className="space-y-1.5">
            {runtimeTrust.whatHappensNextLines.map((line) => (
              <li key={line} className="text-sm text-foreground">
                {line}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {closureMode && runtimeTrust.canCloseBrowserLine ? (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-3 text-sm text-foreground dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="font-medium">Can I close the browser?</span> {runtimeTrust.canCloseBrowserLine}
        </div>
      ) : null}

      {heartbeat.length > 0 && !closureMode ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {employeeMode ? "Status" : "Runtime heartbeat"}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {heartbeat.map((line) => (
              <div key={line.id} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                <p className="text-xs text-muted-foreground">{line.label}</p>
                <p className="text-sm font-medium text-foreground">{line.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {closureMode && heartbeat.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          {heartbeat.slice(0, 2).map((line) => (
            <div key={line.id} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <p className="text-xs text-muted-foreground">{line.label}</p>
              <p className="text-sm font-medium text-foreground">{line.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {activityFeed.length > 0 && !closureMode ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {employeeMode ? "What I've accomplished" : "Live activity feed"}
          </p>
          <ol className="space-y-3 border-l border-border/60 pl-4">
            {activityFeed.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-primary/70" aria-hidden />
                <p className="text-xs text-muted-foreground">{entry.timeLabel}</p>
                <p className="text-sm text-foreground">{entry.summary}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function AuthorityRow({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string | null
  muted?: boolean
}) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  )
}
