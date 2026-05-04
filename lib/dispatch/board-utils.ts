/** Monday 00:00:00 local of the week containing `d`. */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10))
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/** 30-minute slots from 6:00 to 17:30 (inclusive) → 24 rows. */
export const DISPATCH_SLOT_MINUTES = 30
export const DISPATCH_FIRST_SLOT_HOUR = 6
export const DISPATCH_SLOT_COUNT = 24

export function slotIndexToTimeHhMm(idx: number): string {
  const clamped = Math.max(0, Math.min(DISPATCH_SLOT_COUNT - 1, idx))
  const startMins = DISPATCH_FIRST_SLOT_HOUR * 60 + clamped * DISPATCH_SLOT_MINUTES
  const h = Math.floor(startMins / 60)
  const m = startMins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Map Postgres time / "HH:MM:SS" to slot index. */
export function timeToSlotIndex(t: string | null | undefined): number {
  if (!t || !t.trim()) return 0
  const head = t.trim().slice(0, 5)
  const [hh, mm] = head.split(":").map((x) => parseInt(x, 10))
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0
  const mins = hh * 60 + mm
  const gridStart = DISPATCH_FIRST_SLOT_HOUR * 60
  const gridEnd = gridStart + DISPATCH_SLOT_COUNT * DISPATCH_SLOT_MINUTES - 1
  const clamped = Math.max(gridStart, Math.min(gridEnd, mins))
  let idx = Math.floor((clamped - gridStart) / DISPATCH_SLOT_MINUTES)
  idx = Math.max(0, Math.min(DISPATCH_SLOT_COUNT - 1, idx))
  return idx
}

export function formatSlotLabel(idx: number): string {
  const t = slotIndexToTimeHhMm(idx)
  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10))
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  const am = hh < 12 ? "AM" : "PM"
  return `${h12}:${String(mm).padStart(2, "0")} ${am}`
}

/** DnD id fragments — UUID-safe (`@@` separators). */
export const DND = {
  wo: (woId: string) => `wo@@${woId}`,
  parseWo: (id: string): string | null => {
    if (!id.startsWith("wo@@")) return null
    return id.slice(4)
  },
  pool: () => `pool@@unassigned`,
  isPool: (id: string) => id === "pool@@unassigned",
  cell: (techId: string, slotIdx: number) => `cell@@${techId}@@${slotIdx}`,
  parseCell: (id: string): { techId: string; slotIdx: number } | null => {
    if (!id.startsWith("cell@@")) return null
    const parts = id.split("@@")
    if (parts.length < 3) return null
    const slotIdx = parseInt(parts[parts.length - 1] ?? "", 10)
    const techId = parts.slice(1, -1).join("@@")
    if (!techId || Number.isNaN(slotIdx)) return null
    return { techId, slotIdx }
  },
}
