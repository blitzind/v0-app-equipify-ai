import { z } from "zod"

/** Raw structured output from the equipment scan model (image or PDF text path). */
export const equipmentAiScanModelSchema = z.object({
  equipmentName: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  equipmentType: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  /** Customer / account name printed on the document — informational only. */
  documentCustomerName: z.string().nullable().optional(),
  installDate: z.string().nullable().optional(),
  warrantyExpiration: z.string().nullable().optional(),
  lastServiceDate: z.string().nullable().optional(),
  nextServiceDue: z.string().nullable().optional(),
  nextCalibrationDue: z.string().nullable().optional(),
  calibrationIntervalMonths: z.number().int().positive().max(240).nullable().optional(),
  serviceIntervalDescription: z.string().nullable().optional(),
  /** Primary free-text observations from the asset or certificate. */
  notes: z.string().nullable().optional(),
  /** Short bullet lines (standards, technician, lab, firmware, probes, etc.) merged into notes server-side. */
  supportingDetails: z.array(z.string().max(400)).max(14).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
})

export type EquipmentAiScanModelResult = z.infer<typeof equipmentAiScanModelSchema>
