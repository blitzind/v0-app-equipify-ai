import { NextResponse } from "next/server"
import { buildConversationalPlaybookReadinessPayload } from "@/lib/growth/conversational-playbooks/conversational-playbook-route-gates"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    ok: true,
    ...buildConversationalPlaybookReadinessPayload(),
  })
}
