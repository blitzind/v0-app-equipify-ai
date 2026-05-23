import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/** Global kill switch for Growth Engine platform routes. Default off. */
export function isGrowthEngineEnabledEnv(): boolean {
  return process.env.GROWTH_ENGINE_ENABLED?.trim() === "true"
}

export function logGrowthEngine(event: string, details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      source: "growth-engine",
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

export type GrowthEnginePlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string
    }
  | { ok: false; response: NextResponse }

export async function requireGrowthEnginePlatformAccess(): Promise<GrowthEnginePlatformAccess> {
  if (!isGrowthEngineEnabledEnv()) {
    logGrowthEngine("access_denied", { reason: "feature_disabled" })
    return {
      ok: false,
      response: NextResponse.json(
        { error: "feature_disabled", message: "Growth Engine is not enabled for this deployment." },
        { status: 403 },
      ),
    }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    logGrowthEngine("access_denied", { reason: "forbidden" })
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", message: "Platform admin access required." },
        { status: 403 },
      ),
    }
  }

  try {
    return {
      ok: true,
      admin: createServiceRoleSupabaseClient(),
      userId: user.id,
      userEmail: user.email,
    }
  } catch {
    logGrowthEngine("access_denied", { reason: "server_config" })
    return {
      ok: false,
      response: NextResponse.json(
        { error: "server_config", message: "Server is not configured for platform admin operations." },
        { status: 503 },
      ),
    }
  }
}
