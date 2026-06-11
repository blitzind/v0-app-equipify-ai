import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveApolloAccountPlaybook,
  rejectApolloAccountPlaybook,
  rerunApolloAccountPlaybookIntelligence,
} from "@/lib/growth/apollo/apollo-account-playbooks-queue"

export const runtime = "nodejs"

type PlaybookQueueAction = "approve_playbook" | "reject_playbook" | "rerun_playbook"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = asString(body?.action) as PlaybookQueueAction
  const playbookId = asString(body?.playbookId) || asString(body?.playbook_id)
  const note = asString(body?.note) || null

  if (!playbookId) {
    return NextResponse.json({ ok: false, message: "playbookId is required." }, { status: 400 })
  }

  const actor = {
    approver_user_id: access.userId,
    approver_email: access.userEmail,
    note,
  }

  let result
  switch (action) {
    case "approve_playbook":
      result = await approveApolloAccountPlaybook(access.admin, {
        playbook_id: playbookId,
        ...actor,
      })
      break
    case "reject_playbook":
      result = await rejectApolloAccountPlaybook(access.admin, {
        playbook_id: playbookId,
        ...actor,
      })
      break
    case "rerun_playbook":
      result = await rerunApolloAccountPlaybookIntelligence(access.admin, {
        playbook_id: playbookId,
      })
      break
    default:
      return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 400 })
  }

  logGrowthEngine("apollo_account_playbook_queue_action", {
    action,
    playbook_id: playbookId,
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    outreach_sent: false,
  })

  return NextResponse.json({ ok: result.ok, result }, { status: result.ok ? 200 : 422 })
}
