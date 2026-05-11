import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { DEMO_INDUSTRY_PROFILES, normalizeIndustryKey, type DemoIndustryKey } from "@/lib/demo-seeding/profiles"
import { executeDemoSeed } from "@/lib/demo-seeding/seed-demo-content"
import { resetSampleDataForOrganization } from "@/lib/demo-data/reset-sample-data"

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
    prospects?: number
    inventoryLocations?: number
    inventoryStockRows?: number
    communications?: number
    aiOpsRecommendations?: number
    technicianSkillTags?: number
    calibrationTemplates?: number
    calibrationRecords?: number
  }
  techniciansSeeded?: boolean
  resumedFromPartial?: boolean
}

const STALE_RUN_MS = 10 * 60 * 1000

function logSeed(event: string, payload: Record<string, unknown>) {
  try {
    console.info(`[demo-seed] ${event}`, payload)
  } catch {
    /* logging is best-effort */
  }
}

function logSeedError(event: string, payload: Record<string, unknown>) {
  try {
    console.error(`[demo-seed] ${event}`, payload)
  } catch {
    /* logging is best-effort */
  }
}

type SeedStatusRow = {
  demo_seed_status: "pending" | "running" | "succeeded" | "failed" | null
  demo_seed_started_at: string | null
  demo_seed_completed_at: string | null
  industry: string | null
}

async function readOrgSeedStatus(args: SeedArgs): Promise<SeedStatusRow | null> {
  const { data, error } = await args.supabase
    .from("organizations")
    .select("demo_seed_status, demo_seed_started_at, demo_seed_completed_at, industry")
    .eq("id", args.organizationId)
    .maybeSingle<SeedStatusRow>()
  if (error) {
    // Backwards-compat: org table may not yet have these columns on a stale environment.
    logSeedError("status_read_failed", { organizationId: args.organizationId, error: error.message })
    return null
  }
  return data
}

async function markSeedStatus(
  args: SeedArgs,
  patch: Partial<{
    demo_seed_status: "pending" | "running" | "succeeded" | "failed"
    demo_seed_started_at: string | null
    demo_seed_completed_at: string | null
    demo_seed_error: string | null
    demo_seed_industry: DemoIndustryKey | null
    industry: DemoIndustryKey | null
  }>,
) {
  const payload = { ...patch, updated_at: new Date().toISOString() } as Record<string, unknown>
  const { error } = await args.supabase.from("organizations").update(payload).eq("id", args.organizationId)
  if (error) {
    logSeedError("status_write_failed", {
      organizationId: args.organizationId,
      patch,
      error: error.message,
    })
  }
}

export async function seedDemoForIndustry(args: SeedArgs): Promise<SeedResult> {
  const industry = normalizeIndustryKey(args.industry)

  // Always persist the canonical industry choice as early as possible so
  // industry-aware defaults render even if seeding fails or is skipped.
  await markSeedStatus(args, { industry })

  const status = await readOrgSeedStatus(args)
  const startedAtMs = status?.demo_seed_started_at ? Date.parse(status.demo_seed_started_at) : NaN
  const isStaleRunning =
    status?.demo_seed_status === "running" && Number.isFinite(startedAtMs) && Date.now() - startedAtMs > STALE_RUN_MS

  // Existence checks are kept on the user-scoped client so they continue to
  // honor RLS in the ordinary path.
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
  } else {
    // Onboarding path. Decide between skip / fresh / resume.
    const isCurrentlySucceeded = status?.demo_seed_status === "succeeded" && (sampleCustomers ?? 0) > 0
    if (isCurrentlySucceeded) {
      logSeed("skipped_already_succeeded", { organizationId: args.organizationId, industry })
      return { seeded: false, skipped: true, industry }
    }

    const looksPartial =
      (sampleCustomers ?? 0) > 0 ||
      status?.demo_seed_status === "failed" ||
      isStaleRunning
    if (looksPartial) {
      logSeed("partial_state_detected", {
        organizationId: args.organizationId,
        sampleCustomers,
        previousStatus: status?.demo_seed_status,
        isStaleRunning,
      })
      try {
        await resetSampleDataForOrganization(args.supabase, args.organizationId)
        logSeed("partial_state_cleared", { organizationId: args.organizationId })
      } catch (resetError) {
        const message = resetError instanceof Error ? resetError.message : "Unknown reset error"
        logSeedError("partial_state_reset_failed", { organizationId: args.organizationId, error: message })
        // Non-fatal: continue to run, the seed will surface a more specific error if it can't proceed.
      }
    }
  }

  // Touch profile to validate key exists
  void DEMO_INDUSTRY_PROFILES[industry]

  await markSeedStatus(args, {
    demo_seed_status: "running",
    demo_seed_started_at: new Date().toISOString(),
    demo_seed_completed_at: null,
    demo_seed_error: null,
  })

  let result
  try {
    result = await executeDemoSeed({
      supabase: args.supabase,
      organizationId: args.organizationId,
      ownerUserId: args.ownerUserId,
      industry,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown seed error"
    logSeedError("seed_failed", {
      organizationId: args.organizationId,
      industry,
      error: message,
    })
    await markSeedStatus(args, {
      demo_seed_status: "failed",
      demo_seed_error: message.slice(0, 1000),
    })
    throw e
  }

  await markSeedStatus(args, {
    demo_seed_status: "succeeded",
    demo_seed_completed_at: new Date().toISOString(),
    demo_seed_error: null,
    demo_seed_industry: industry,
    industry,
  })

  logSeed("seed_succeeded", {
    organizationId: args.organizationId,
    industry,
    counts: result.counts,
  })

  return {
    seeded: result.seeded,
    skipped: result.skipped,
    industry: result.industry,
    counts: result.counts,
    techniciansSeeded: result.techniciansSeeded,
    resumedFromPartial: status?.demo_seed_status === "failed" || (sampleCustomers ?? 0) > 0,
  }
}
