import type {
  ServiceContractRow,
  SlaCoverageLabel,
  SlaEvaluationContext,
} from "@/lib/service-contracts/types"

const MS_PER_HOUR = 3600_000

export function dateInContractWindow(row: ServiceContractRow, asOf: Date): boolean {
  const day = asOf.toISOString().slice(0, 10)
  const start = row.start_date.slice(0, 10)
  const end = row.end_date.slice(0, 10)
  return day >= start && day <= end
}

/** Active coverage: status active and current calendar day within [start_date, end_date]. */
export function contractIsActivelyCovering(row: ServiceContractRow, asOf: Date): boolean {
  if (row.status !== "active") return false
  return dateInContractWindow(row, asOf)
}

export function contractMatchesContext(row: ServiceContractRow, ctx: SlaEvaluationContext, asOf: Date): boolean {
  if (row.customer_id !== ctx.customerId) return false
  if (!contractIsActivelyCovering(row, asOf)) return false

  if (row.equipment_id) {
    if (!ctx.equipmentId || row.equipment_id !== ctx.equipmentId) return false
  }

  if (row.customer_location_id) {
    if (!ctx.locationId || row.customer_location_id !== ctx.locationId) return false
  }

  return true
}

function specificityScore(row: ServiceContractRow): number {
  let s = 0
  if (row.equipment_id) s += 4
  if (row.customer_location_id) s += 2
  return s
}

export function pickBestContract(
  rows: ServiceContractRow[],
  ctx: SlaEvaluationContext,
  asOf: Date = new Date(),
): ServiceContractRow | null {
  const matches = rows.filter((r) => contractMatchesContext(r, ctx, asOf))
  if (matches.length === 0) return null
  matches.sort((a, b) => {
    const ds = specificityScore(b) - specificityScore(a)
    if (ds !== 0) return ds
    const end = b.end_date.localeCompare(a.end_date)
    if (end !== 0) return end
    return a.id.localeCompare(b.id)
  })
  return matches[0] ?? null
}

function hoursBetween(startMs: number, endMs: number): number {
  return Math.max(0, (endMs - startMs) / MS_PER_HOUR)
}

function isServiceRequestClosed(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase()
  return s === "converted" || s === "declined" || s === "archived"
}

function isWorkOrderClosed(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase()
  return (
    s === "completed" ||
    s === "completed_pending_signature" ||
    s === "invoiced"
  )
}

/**
 * Operational SLA labels (not legal entitlement). Uses response + resolution hour targets when set.
 */
export function evaluateSlaCoverageLabel(
  contract: ServiceContractRow | null,
  ctx: SlaEvaluationContext,
  now: Date = new Date(),
): {
  label: SlaCoverageLabel
  contractId: string | null
  contractName: string | null
  responseHoursElapsed: number | null
  resolutionHoursElapsed: number | null
} {
  if (!contract) {
    return {
      label: "no_contract",
      contractId: null,
      contractName: null,
      responseHoursElapsed: null,
      resolutionHoursElapsed: null,
    }
  }

  const opened = new Date(ctx.openedAtIso).getTime()
  if (Number.isNaN(opened)) {
    return {
      label: "covered",
      contractId: contract.id,
      contractName: contract.contract_name,
      responseHoursElapsed: null,
      resolutionHoursElapsed: null,
    }
  }

  const respTarget = contract.sla_response_hours
  const resTarget = contract.sla_resolution_hours
  if (respTarget == null && resTarget == null) {
    return {
      label: "covered",
      contractId: contract.id,
      contractName: contract.contract_name,
      responseHoursElapsed: null,
      resolutionHoursElapsed: null,
    }
  }

  const closedMsRaw = ctx.closedAtIso ? new Date(ctx.closedAtIso).getTime() : NaN
  const closedMs = Number.isFinite(closedMsRaw) ? closedMsRaw : null

  const lifecycle = (ctx.lifecycleStatus ?? "").toLowerCase()
  const lifecycleClosed = isServiceRequestClosed(lifecycle) || isWorkOrderClosed(lifecycle)

  if (lifecycleClosed && closedMs == null) {
    return {
      label: "covered",
      contractId: contract.id,
      contractName: contract.contract_name,
      responseHoursElapsed: null,
      resolutionHoursElapsed: null,
    }
  }

  const endMs = closedMs ?? now.getTime()
  const elapsed = hoursBetween(opened, endMs)

  let label: SlaCoverageLabel = "covered"

  const bump = (limit: number | null) => {
    if (limit == null) return
    if (elapsed > limit) label = "sla_overdue"
    else if (elapsed >= limit * 0.75 && label !== "sla_overdue") label = "sla_at_risk"
  }

  bump(respTarget)
  bump(resTarget)

  return {
    label,
    contractId: contract.id,
    contractName: contract.contract_name,
    responseHoursElapsed: respTarget != null ? elapsed : null,
    resolutionHoursElapsed: resTarget != null ? elapsed : null,
  }
}

export function summarizeContractForPortal(row: ServiceContractRow): {
  id: string
  contract_name: string
  contract_number: string | null
  start_date: string
  end_date: string
  coverage_type: string
  status: string
} {
  return {
    id: row.id,
    contract_name: row.contract_name,
    contract_number: row.contract_number,
    start_date: row.start_date,
    end_date: row.end_date,
    coverage_type: row.coverage_type,
    status: row.status,
  }
}
