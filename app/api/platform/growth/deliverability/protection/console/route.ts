import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { buildDeliverabilityProtectionConsole } from "@/lib/growth/deliverability/deliverability-protection-console"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  try {
    const consoleSnapshot = await buildDeliverabilityProtectionConsole(access.admin)
    return NextResponse.json({ ok: true, console: consoleSnapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[deliverability-protection-console]", message)
    return NextResponse.json(
      {
        ok: false,
        error: "console_fetch_failed",
        message,
        impact: "Deliverability console modules could not be assembled.",
        remediation: "Retry refresh or inspect Growth schema migrations.",
      },
      { status: 500 },
    )
  }
}
