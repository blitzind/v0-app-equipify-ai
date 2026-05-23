import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listImportVendorAdapters } from "@/lib/growth/import/vendors/registry"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({ ok: true, vendors: listImportVendorAdapters() })
}
