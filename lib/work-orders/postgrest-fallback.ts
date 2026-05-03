import type { PostgrestError } from "@supabase/supabase-js"

/** True when PostgREST/Postgres reports the work_order_number column is missing (migration not applied). */
export function missingWorkOrderNumberColumn(error: PostgrestError | null | undefined): boolean {
  if (!error) return false
  const m = (error.message ?? "").toLowerCase()
  if (!m.includes("work_order_number")) return false
  if (error.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}
