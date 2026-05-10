export type EquipmentWarrantyStatusDb = "active" | "expired" | "void"

export type EquipmentWarrantyRow = {
  id: string
  organization_id: string
  equipment_id: string
  warranty_provider: string
  start_date: string | null
  end_date: string
  status: EquipmentWarrantyStatusDb
  coverage_summary: string | null
  reference_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** Operational UI labels (not legal entitlement). */
export type WarrantyCoverageLabel = "under_warranty" | "expiring_soon" | "warranty_expired" | "no_warranty"

export type WarrantyEvaluationResult = {
  label: WarrantyCoverageLabel
  /** Best current end date among record + equipment fallback, YYYY-MM-DD */
  endDate: string | null
  provider: string | null
  daysRemaining: number | null
  source: "record" | "equipment" | "none"
  referenceNumber: string | null
}
