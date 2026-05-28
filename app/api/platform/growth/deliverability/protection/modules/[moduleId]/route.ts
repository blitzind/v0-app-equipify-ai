import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildDeliverabilityProtectionModule } from "@/lib/growth/deliverability/deliverability-protection-console"
import {
  GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS,
  type GrowthDeliverabilityProtectionModuleId,
} from "@/lib/growth/deliverability/deliverability-protection-console-types"

export const runtime = "nodejs"

function isModuleId(value: string): value is GrowthDeliverabilityProtectionModuleId {
  return (GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS as readonly string[]).includes(value)
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ moduleId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { moduleId } = await context.params
  if (!isModuleId(moduleId)) {
    return NextResponse.json({ ok: false, error: "unknown_module" }, { status: 404 })
  }

  try {
    const moduleResult = await buildDeliverabilityProtectionModule(access.admin, moduleId)
    return NextResponse.json({ ok: true, module: moduleResult })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[deliverability-module:${moduleId}]`, message)
    return NextResponse.json(
      {
        ok: false,
        error: "module_fetch_failed",
        message,
        module_id: moduleId,
      },
      { status: 500 },
    )
  }
}
