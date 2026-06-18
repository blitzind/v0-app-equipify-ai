/**
 * EC-7 — Equipify Core smoke certification module matrix.
 * Validation-only checks grouped by production module (no mutations/emails/payments).
 */

import type { CertCheckResult } from "@/lib/certification/equipify-core-production-certification"

export const EQUIPIFY_CORE_SMOKE_CERT_QA_MARKER = "equipify-core-smoke-ec-7-v1" as const

export const EQUIPIFY_CORE_SMOKE_MODULES = [
  "authentication",
  "customers",
  "prospects",
  "work_orders",
  "quotes",
  "invoices",
  "purchase_orders",
  "blitzpay",
  "portal",
  "notifications",
  "settings",
  "mobile_apis",
] as const

export type EquipifyCoreSmokeModule = (typeof EQUIPIFY_CORE_SMOKE_MODULES)[number]

export type SmokeModuleSummary = {
  module: EquipifyCoreSmokeModule
  pass: number
  fail: number
  blocked: number
  skipped: number
  status: "pass" | "fail" | "blocked" | "partial"
  notes: string
}

export type SmokeCertReport = {
  qa_marker: typeof EQUIPIFY_CORE_SMOKE_CERT_QA_MARKER
  mode: "smoke"
  production_host: string
  organization_id: string | null
  executed_at: string
  checks: CertCheckResult[]
  modules: SmokeModuleSummary[]
  ok: boolean
}

export function summarizeSmokeModules(checks: CertCheckResult[]): SmokeModuleSummary[] {
  const byModule = new Map<EquipifyCoreSmokeModule, CertCheckResult[]>()
  for (const mod of EQUIPIFY_CORE_SMOKE_MODULES) byModule.set(mod, [])
  for (const check of checks) {
    const mod = check.category as EquipifyCoreSmokeModule
    if (byModule.has(mod)) byModule.get(mod)!.push(check)
  }

  return EQUIPIFY_CORE_SMOKE_MODULES.map((module) => {
    const rows = byModule.get(module) ?? []
    const pass = rows.filter((r) => r.status === "pass").length
    const fail = rows.filter((r) => r.status === "fail").length
    const blocked = rows.filter((r) => r.status === "blocked").length
    const skipped = rows.filter((r) => r.status === "skipped").length
    const hasCriticalFail = rows.some(
      (r) => r.status === "fail" && (r.criticality === "critical" || r.criticality === "high"),
    )
    const hasBlocked = rows.some((r) => r.status === "blocked" && r.criticality !== "low")
    let status: SmokeModuleSummary["status"] = "pass"
    if (hasCriticalFail) status = "fail"
    else if (hasBlocked && pass === 0) status = "blocked"
    else if (hasBlocked || fail > 0) status = "partial"

    const notes = rows
      .filter((r) => r.status !== "pass")
      .slice(0, 3)
      .map((r) => `${r.id}: ${r.status}`)
      .join("; ")

    return { module, pass, fail, blocked, skipped, status, notes: notes || "All exercised checks passed." }
  })
}

export function smokeReportOk(checks: CertCheckResult[]): boolean {
  return !checks.some(
    (c) => c.status === "fail" && (c.criticality === "critical" || c.criticality === "high"),
  )
}
