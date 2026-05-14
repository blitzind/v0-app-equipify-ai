import { z } from "zod"

export const organizationTaxSettingsPatchSchema = z.object({
  autoTaxEnabled: z.boolean().optional(),
  fallbackTaxRatePercent: z.number().min(0).max(100).optional(),
  taxableLaborDefault: z.boolean().optional(),
  taxablePartsDefault: z.boolean().optional(),
  sourcingMode: z.enum(["origin", "destination"]).optional(),
  manualOverrideAllowed: z.boolean().optional(),
  primaryProvider: z.string().max(64).optional(),
})

export type OrganizationTaxSettingsPatch = z.infer<typeof organizationTaxSettingsPatchSchema>

export const salesTaxCalculateRequestSchema = z.object({
  preferAutomatic: z.boolean(),
  taxBasis: z.enum(["service_location", "billing_address", "manual"]),
  customerTaxExempt: z.boolean().optional(),
  customerId: z.string().uuid().optional().nullable(),
  serviceAddress: z
    .object({
      countryCode: z.string().min(2).max(2),
      regionCode: z.string().min(1).max(8),
      countyName: z.string().max(120).optional().nullable(),
      cityName: z.string().max(120).optional().nullable(),
      postalCode: z.string().max(16).optional().nullable(),
    })
    .optional()
    .nullable(),
  billingAddress: z
    .object({
      countryCode: z.string().min(2).max(2),
      regionCode: z.string().min(1).max(8),
      countyName: z.string().max(120).optional().nullable(),
      cityName: z.string().max(120).optional().nullable(),
      postalCode: z.string().max(16).optional().nullable(),
    })
    .optional()
    .nullable(),
  lines: z.array(
    z.object({
      qty: z.number(),
      unit: z.number(),
      taxable: z.boolean().optional().nullable(),
      tax_category: z.string().max(120).optional().nullable(),
      source_ref: z.string().max(200).optional().nullable(),
    }),
  ),
  asOfYmd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  persistLog: z.boolean().optional(),
  idempotencyKey: z.string().max(200).optional().nullable(),
})

export type SalesTaxCalculateRequest = z.infer<typeof salesTaxCalculateRequestSchema>
