import "server-only"

import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"

export type GrowthWorkspaceSettingsApiAccess =
  | {
      ok: true
      admin: Awaited<ReturnType<typeof requireGrowthEnginePlatformAccess>> extends { ok: true; admin: infer A }
        ? A
        : never
      userId: string
      userEmail: string
    }
  | { ok: false; response: NextResponse }

export async function requireGrowthWorkspaceSettingsAccess(
  request?: Request,
): Promise<GrowthWorkspaceSettingsApiAccess> {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access
  return access
}

export function growthWorkspaceSettingsJsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}
