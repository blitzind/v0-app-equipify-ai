export type ServiceContractStatusDb =
  | "draft"
  | "active"
  | "suspended"
  | "expired"
  | "cancelled"

export type ServiceContractCoverageTypeDb =
  | "full_service"
  | "labor_only"
  | "parts_and_labor"
  | "inspection_only"
  | "emergency"
  | "pm_only"
  | "other"

export type ServiceContractRow = {
  id: string
  organization_id: string
  customer_id: string
  customer_location_id: string | null
  equipment_id: string | null
  contract_name: string
  contract_number: string | null
  start_date: string
  end_date: string
  status: ServiceContractStatusDb
  coverage_type: ServiceContractCoverageTypeDb
  sla_response_hours: number | null
  sla_resolution_hours: number | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

/** UI / API label for coverage + SLA posture */
export type SlaCoverageLabel = "covered" | "no_contract" | "sla_at_risk" | "sla_overdue"

export type SlaEvaluationContext = {
  customerId: string
  locationId?: string | null
  equipmentId?: string | null
  /** When the ticket / WO / request clock starts */
  openedAtIso: string
  /** When work finished (WO completed_at, etc.) */
  closedAtIso?: string | null
  /**
   * Work order or similar: `completed` / `invoiced` means resolution clock stopped.
   * Service request: `converted` / `declined` / `archived` stops SLA warnings.
   */
  lifecycleStatus?: string | null
}
