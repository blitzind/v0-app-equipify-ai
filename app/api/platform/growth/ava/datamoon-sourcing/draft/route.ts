import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  isRecognizedAvaDatamoonSourcingCommand,
  parseAvaDatamoonSourcingCommand,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-command-parser"
import {
  GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER,
  type GrowthHomeDatamoonSourcingDraftApiResponse,
} from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"

const BodySchema = z.object({
  command: z.string().trim().min(3).max(2000),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Command is required (3–2000 characters)." },
      { status: 400 },
    )
  }

  if (!isRecognizedAvaDatamoonSourcingCommand(parsed.data.command)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Could not interpret that command. Try describing the industry, intent, geography, and titles you want.",
      },
      { status: 422 },
    )
  }

  const draft = parseAvaDatamoonSourcingCommand(parsed.data.command)

  const response: GrowthHomeDatamoonSourcingDraftApiResponse = {
    ok: true,
    readOnly: true,
    qa_marker: GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER,
    draft,
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL,
    },
  })
}
