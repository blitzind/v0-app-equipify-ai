/** Client-safe helpers for focusing a sequence execution job row in the console. */

export const GROWTH_SEQUENCE_EXECUTION_FOCUS_JOB_EVENT = "growth-sequence-execution-focus-job" as const

export const GROWTH_SEQUENCE_EXECUTION_JOB_HIGHLIGHT_CLASS = "ring-2 ring-indigo-500 bg-indigo-50/70" as const

export function sequenceExecutionJobRowId(jobId: string): string {
  return `sequence-job-${jobId}`
}

export function dispatchSequenceExecutionJobFocus(jobId: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(GROWTH_SEQUENCE_EXECUTION_FOCUS_JOB_EVENT, { detail: { jobId } }),
  )
}

export function focusSequenceExecutionJobRow(jobId: string): boolean {
  if (typeof document === "undefined") return false
  const row = document.getElementById(sequenceExecutionJobRowId(jobId))
  if (!row) return false

  row.scrollIntoView({ behavior: "smooth", block: "center" })
  row.classList.add(...GROWTH_SEQUENCE_EXECUTION_JOB_HIGHLIGHT_CLASS.split(" "))

  const approveButton = row.querySelector<HTMLButtonElement>('button[data-sequence-action="approve"]')
  approveButton?.focus({ preventScroll: true })

  window.setTimeout(() => {
    row.classList.remove(...GROWTH_SEQUENCE_EXECUTION_JOB_HIGHLIGHT_CLASS.split(" "))
  }, 4500)

  return true
}

export function scheduleSequenceExecutionJobFocus(jobId: string, maxAttempts = 12): void {
  if (typeof window === "undefined") return

  let attempts = 0
  const tryFocus = () => {
    if (focusSequenceExecutionJobRow(jobId)) return
    attempts += 1
    if (attempts >= maxAttempts) return
    window.setTimeout(tryFocus, 75)
  }

  tryFocus()
}
