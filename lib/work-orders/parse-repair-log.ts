import type { Part, RepairLog } from "@/lib/mock-data"

function normalizeTaskEntry(
  raw: unknown,
  index: number,
): { id: string; label: string; done: boolean; description?: string } | null {
  if (typeof raw === "string" && raw.trim()) {
    return { id: `t-${index}`, label: raw.trim(), done: false }
  }
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const label =
    typeof o.label === "string"
      ? o.label
      : typeof o.name === "string"
        ? o.name
        : typeof o.title === "string"
          ? o.title
          : ""
  if (!label.trim()) return null
  const id = typeof o.id === "string" && o.id.trim() ? o.id : `t-${index}`
  const done = o.done === true || o.completed === true || o.checked === true
  const description =
    typeof o.description === "string" && o.description.trim() ? o.description.trim() : undefined
  return { id, label: label.trim(), done, description }
}

/** Parses `work_orders.repair_log` JSON into the app repair log shape (incl. optional checklist tasks). */
export function parseRepairLog(raw: unknown): RepairLog {
  const empty: RepairLog = {
    problemReported: "",
    diagnosis: "",
    partsUsed: [],
    laborHours: 0,
    technicianNotes: "",
    photos: [],
    signatureDataUrl: "",
    signedBy: "",
    signedAt: "",
    tasks: [],
  }
  if (!raw || typeof raw !== "object") return empty
  const o = raw as Record<string, unknown>
  let tasks: { id: string; label: string; done: boolean; description?: string }[] = []
  if (Array.isArray(o.tasks)) {
    tasks = o.tasks
      .map((t, i) => normalizeTaskEntry(t, i))
      .filter((x): x is { id: string; label: string; done: boolean; description?: string } => x !== null)
  }
  return {
    problemReported: typeof o.problemReported === "string" ? o.problemReported : "",
    diagnosis: typeof o.diagnosis === "string" ? o.diagnosis : "",
    partsUsed: Array.isArray(o.partsUsed) ? (o.partsUsed as Part[]) : [],
    laborHours: typeof o.laborHours === "number" ? o.laborHours : 0,
    technicianNotes: typeof o.technicianNotes === "string" ? o.technicianNotes : "",
    photos: Array.isArray(o.photos) ? (o.photos as string[]) : [],
    signatureDataUrl: typeof o.signatureDataUrl === "string" ? o.signatureDataUrl : "",
    signedBy: typeof o.signedBy === "string" ? o.signedBy : "",
    signedAt: typeof o.signedAt === "string" ? o.signedAt : "",
    tasks,
  }
}

export function serializeRepairLog(rl: RepairLog): Record<string, unknown> {
  return {
    problemReported: rl.problemReported,
    diagnosis: rl.diagnosis,
    partsUsed: rl.partsUsed,
    laborHours: rl.laborHours,
    technicianNotes: rl.technicianNotes,
    photos: rl.photos,
    signatureDataUrl: rl.signatureDataUrl,
    signedBy: rl.signedBy,
    signedAt: rl.signedAt,
    tasks: rl.tasks ?? [],
  }
}

/** Optional strips keep `repair_log` JSON from duplicating data now stored in dedicated tables. */
export function repairLogJsonForPersist(
  rl: RepairLog,
  opts: { stripTasks?: boolean; stripParts?: boolean; stripPhotos?: boolean },
): Record<string, unknown> {
  const base = serializeRepairLog(rl)
  if (opts.stripTasks) base.tasks = []
  if (opts.stripParts) base.partsUsed = []
  if (opts.stripPhotos) base.photos = []
  return base
}
