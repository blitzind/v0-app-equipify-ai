import type { RepairLog } from "@/lib/mock-data"

/** Conservative snapshot for conflict fallback when `updated_at` is unavailable. */
export function repairLogConflictFingerprint(args: {
  problemReported: string
  diagnosis: string
  technicianNotes: string
  notesColumn: string
  tasksJson?: Array<{ id: string; label: string; done: boolean }> | null
}): string {
  const core = {
    p: args.problemReported.trim(),
    d: args.diagnosis.trim(),
    t: args.technicianNotes.trim(),
    n: args.notesColumn.trim(),
    tasks: (args.tasksJson ?? []).map((x) => ({ id: x.id, label: x.label, done: x.done })),
  }
  return JSON.stringify(core)
}

export function repairLogFingerprintFromWorkOrder(
  problemReported: string,
  repairLog: RepairLog,
  notesColumn: string,
): string {
  return repairLogConflictFingerprint({
    problemReported,
    diagnosis: repairLog.diagnosis ?? "",
    technicianNotes: repairLog.technicianNotes ?? "",
    notesColumn,
    tasksJson: repairLog.tasks?.map((t) => ({ id: t.id, label: t.label, done: t.done })) ?? null,
  })
}
