import type { TechSkill } from "@/lib/mock-data"
import { ALL_SKILLS } from "@/lib/technicians/roster-form-constants"

export const WO_TYPE_EST_HOURS: Record<string, number> = {
  repair: 2,
  pm: 2.5,
  inspection: 1.5,
  install: 4,
  emergency: 2,
}

export function estimatedHoursForWoType(typeDb: string): number {
  return WO_TYPE_EST_HOURS[typeDb] ?? 1.5
}

export function normalizeRosterSkills(arr: string[] | undefined): TechSkill[] {
  const allowed = new Set<string>(ALL_SKILLS)
  return (arr ?? []).filter((s): s is TechSkill => allowed.has(s as TechSkill))
}

function norm(s: string) {
  return s.trim().toLowerCase()
}

export type SuggestTech = {
  id: string
  name: string
  homeRegion: string | null
  skills: TechSkill[]
}

export function suggestTechnicians(
  job: { typeDb: string; siteText: string },
  roster: SuggestTech[],
  workloadByTechId: Record<string, number>,
): { id: string; name: string; reasons: string[] }[] {
  const site = norm(job.siteText)
  const loads = Object.values(workloadByTechId)
  const maxLoad = Math.max(1, ...loads, 8)

  const typeHints: Record<string, string[]> = {
    repair: ["Repair", "Mechanical", "Electrical", "HVAC"],
    pm: ["PM", "Maintenance", "Preventive"],
    inspection: ["Inspection", "Compliance"],
    install: ["Installations", "Installation"],
    emergency: ["Emergency", "Repair"],
  }
  const hints = typeHints[job.typeDb] ?? ["Repair", "HVAC"]

  const scored = roster.map((t) => {
    let score = 0
    const reasons: string[] = []
    const hr = (t.homeRegion ?? "").trim()
    if (hr) {
      const hrn = norm(hr)
      if (site.includes(hrn) || hrn.length > 2 && site.split(/[,\n]/).some((part) => norm(part).includes(hrn))) {
        score += 90
        reasons.push("Region match")
      } else if (site.length > 3 && hrn.length > 2) {
        const siteWords = site.split(/[\s,]+/).filter((w) => w.length > 2)
        if (siteWords.some((w) => hrn.includes(w) || w.includes(hrn))) {
          score += 50
          reasons.push("Region overlap")
        }
      }
    }

    const skillSet = t.skills.map((s) => s.toLowerCase())
    const skillHit = hints.some((h) => skillSet.some((sk) => sk.includes(h.toLowerCase()) || h.toLowerCase().includes(sk)))
    if (skillHit) {
      score += 48
      reasons.push("Skill match")
    }

    const load = workloadByTechId[t.id] ?? 0
    score += Math.round((maxLoad - load) * 3)
    if (load === 0) reasons.push("Light workload today")

    return { id: t.id, name: t.name, score, reasons: [...new Set(reasons)] as string[] }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ id, name, reasons }) => ({ id, name, reasons }))
}

export function parseDragQueuedWo(id: string): string | null {
  if (!id.startsWith("qwo@@")) return null
  return id.slice(4) || null
}

export function dropTechId(overId: string): string | null {
  if (!overId.startsWith("drop-tech@@")) return null
  return overId.slice("drop-tech@@".length) || null
}

export function dropDayYmd(overId: string): string | null {
  if (!overId.startsWith("drop-day@@")) return null
  return overId.slice("drop-day@@".length) || null
}
