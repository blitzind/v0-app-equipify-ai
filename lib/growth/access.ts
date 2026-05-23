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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Org UUID used for ai_usage_logs when running internal Growth Engine research. */
export function getGrowthEngineAiOrgId(): string | null {
  const id = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  return id && UUID_RE.test(id) ? id : null
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
