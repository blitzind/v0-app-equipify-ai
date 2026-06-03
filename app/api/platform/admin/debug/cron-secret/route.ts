import { NextResponse } from "next/server"
import { describeConfiguredGrowthCronSecret } from "@/lib/growth/runtime/growth-cron-auth"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
/** Always read live env — do not cache CRON_SECRET across requests/build. */
export const dynamic = "force-dynamic"

/** Temporary platform-admin diagnostic: runtime CRON_SECRET fingerprint (no raw value). */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  return NextResponse.json(describeConfiguredGrowthCronSecret())
}
