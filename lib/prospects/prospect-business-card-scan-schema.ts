import { z } from "zod"

/** Raw structured output from the business card vision model. */
export const prospectBusinessCardScanModelSchema = z.object({
  company_name: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
})

export type ProspectBusinessCardScanModelResult = z.infer<typeof prospectBusinessCardScanModelSchema>

export type ProspectBusinessCardScanFields = {
  company_name: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  notes: string | null
  confidence: number | null
}
