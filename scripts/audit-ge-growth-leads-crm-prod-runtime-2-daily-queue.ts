/**
 * GE-GROWTH-LEADS-CRM-PROD-RUNTIME-2 — probe daily work queue lead_status for CRM drawer crash.
 */
import { createClient } from "@supabase/supabase-js"

const LEAD_ID = "ec176375-8b43-4fa5-b63d-3cfdc8a18461"

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env")

  process.env.GROWTH_NATIVE_DECISION_ENGINE = process.env.GROWTH_NATIVE_DECISION_ENGINE ?? "true"
  process.env.GROWTH_COMMUNICATION_STRATEGY = process.env.GROWTH_COMMUNICATION_STRATEGY ?? "true"

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const { fetchDailyRevenueWorkQueueLeadStatus } = await import(
    "../lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts"
  )

  const result = await fetchDailyRevenueWorkQueueLeadStatus(admin, LEAD_ID)
  console.log(JSON.stringify(result, null, 2))

  const status = result.lead_status
  if (!status) {
    console.log("No lead_status returned")
    return
  }

  console.log("\nProbe panel render guard:")
  console.log("  in_queue:", status.in_queue)
  console.log("  reasoning is array:", Array.isArray(status.reasoning))
  try {
    console.log("  status.reasoning.length:", status.reasoning.length)
    console.log("  PANEL OK")
  } catch (error) {
    console.log("  PANEL CRASH:", error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.log(error.stack.split("\n").slice(0, 6).join("\n"))
    }
  }
}

void main()
