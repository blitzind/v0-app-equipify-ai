import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { DEMO_INDUSTRY_PROFILES, normalizeIndustryKey, type DemoIndustryKey } from "@/lib/demo-seeding/profiles"
import { executeDemoSeed } from "@/lib/demo-seeding/seed-demo-content"

type SeedArgs = {
  supabase: SupabaseClient
  organizationId: string
  ownerUserId: string
  industry: string | null | undefined
  /**
   * From Settings sample import: workspace must have zero non-sample rows and zero sample rows
   * (reset clears samples). Onboarding leaves this false.
   */
  import?: boolean
}

type SeedResult = {
  seeded: boolean
  skipped: boolean
  industry: DemoIndustryKey
  counts?: {
    customers: number
    equipment: number
    workOrders: number
    maintenancePlans: number
    technicians: number
    techniciansOperational?: number
    vendors?: number
    catalogItems?: number
    quotes?: number
    invoices?: number
    purchaseOrders?: number
    calibrationTemplates?: number
    calibrationRecords?: number
  }
  techniciansSeeded?: boolean
}

export async function seedDemoForIndustry(args: SeedArgs): Promise<SeedResult> {
  const industry = normalizeIndustryKey(args.industry)

  const { count: existingCustomers, error: existingErr } = await args.supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", args.organizationId)
  if (existingErr) throw new Error(existingErr.message)

  const { count: nonSampleCustomers, error: nonSampleErr } = await args.supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", args.organizationId)
    .eq("is_sample", false)
  if (nonSampleErr) throw new Error(nonSampleErr.message)

  const { count: sampleCustomers, error: sampleErr } = await args.supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", args.organizationId)
    .eq("is_sample", true)
  if (sampleErr) throw new Error(sampleErr.message)

  if (args.import) {
    if ((nonSampleCustomers ?? 0) > 0) {
      throw new Error(
        "This workspace already has non-sample customer records. Sample import is only for empty workspaces.",
      )
    }
    if ((sampleCustomers ?? 0) > 0) {
      throw new Error("Sample rows are still present. Run “Reset sample data” before importing again.")
    }
  } else if ((existingCustomers ?? 0) > 0) {
    return { seeded: false, skipped: true, industry }
  }

  // Touch profile to validate key exists
  void DEMO_INDUSTRY_PROFILES[industry]

  const result = await executeDemoSeed({
    supabase: args.supabase,
    organizationId: args.organizationId,
    ownerUserId: args.ownerUserId,
    industry,
  })

  return {
    seeded: result.seeded,
    skipped: result.skipped,
    industry: result.industry,
    counts: result.counts,
    techniciansSeeded: result.techniciansSeeded,
  }
}
