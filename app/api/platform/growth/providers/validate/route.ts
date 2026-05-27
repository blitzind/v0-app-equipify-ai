import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { validateDeliveryProvider } from "@/lib/growth/providers/provider-repository"
import { isGrowthProviderDeliverySchemaReady } from "@/lib/growth/providers/provider-schema-health"

export const runtime = "nodejs"

const ValidateSchema = z.object({
  providerId: z.string().uuid(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthProviderDeliverySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = ValidateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid provider validation payload." }, { status: 400 })
  }

  try {
    const provider = await validateDeliveryProvider(access.admin, parsed.data.providerId, {
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, provider })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not validate delivery provider."
    const status = message === "delivery_provider_not_found" ? 404 : 500
    return NextResponse.json({ error: "delivery_provider_validate_failed", message }, { status })
  }
}
