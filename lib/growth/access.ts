import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { isGrowthQaAccelerationEnabled } from "@/lib/growth/sequence-enrollment/qa-acceleration-config"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/** Global kill switch for Growth Engine platform routes. Default off. */
export function isGrowthEngineEnabledEnv(): boolean {
  return process.env.GROWTH_ENGINE_ENABLED?.trim() === "true"
}

/** Org UUID used for ai_usage_logs when running internal Growth Engine research. */
export function getGrowthEngineAiOrgId(): string | null {
  const id = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (!id) return null
  const parsed = z.string().uuid().safeParse(id)
  return parsed.success ? parsed.data : null
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
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    const missingServiceRoleKey = detail.includes("SUPABASE_SERVICE_ROLE_KEY")
    logGrowthEngine("access_denied", { reason: "server_config", detail })
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "server_config",
          message: missingServiceRoleKey
            ? "SUPABASE_SERVICE_ROLE_KEY is not configured. Growth Engine requires the service role client for growth schema access."
            : "Server is not configured for platform admin operations.",
        },
        { status: 503 },
      ),
    }
  }
}

export async function requireGrowthQaAccelerationAccess(): Promise<GrowthEnginePlatformAccess> {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access

  if (!isGrowthQaAccelerationEnabled()) {
    logGrowthEngine("qa_acceleration_denied", { reason: "disabled_in_environment" })
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "qa_acceleration_disabled",
          message: "QA acceleration controls are disabled in this environment.",
        },
        { status: 403 },
      ),
    }
  }

  return access
}
