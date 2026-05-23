import { readFileSync } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { processOutboundFixture } from "@/lib/growth/outbound/ingest-webhook"
import type { OutboundFixtureEnvelope } from "@/lib/growth/outbound/types"

export const runtime = "nodejs"

const BodySchema = z.union([
  z.object({ fixture: z.record(z.string(), z.unknown()) }),
  z.object({ fixtureId: z.string().trim().min(1) }),
])

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const raw = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Provide fixture or fixtureId." }, { status: 400 })
  }

  try {
    let fixture: OutboundFixtureEnvelope
    if ("fixtureId" in parsed.data) {
      const fixturePath = path.join(
        process.cwd(),
        "lib/growth/outbound/fixtures",
        `${parsed.data.fixtureId}.json`,
      )
      fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as OutboundFixtureEnvelope
    } else {
      fixture = parsed.data.fixture as OutboundFixtureEnvelope
    }

    const result = await processOutboundFixture(access.admin, fixture, access.userId)
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fixture_failed", message }, { status: 500 })
  }
}
