import { NextResponse } from "next/server"
import { requireCanCreateRecord } from "@/lib/billing/server-guard"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATUS_RE = /^(open|done|dismissed)$/

type Body = {
  organizationId?: string
  title?: string
  description?: string
  sourceType?: string
  sourceId?: string | null
  status?: string
  dueDate?: string | null
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const title = typeof body.title === "string" ? body.title.trim() : ""
  if (!title || title.length > 500) {
    return NextResponse.json({ error: "invalid_title", message: "Title is required (max 500 characters)." }, { status: 400 })
  }

  const description = typeof body.description === "string" ? body.description.trim() : ""
  if (description.length > 8000) {
    return NextResponse.json({ error: "invalid_description", message: "Description is too long." }, { status: 400 })
  }

  const sourceType =
    typeof body.sourceType === "string" && body.sourceType.trim()
      ? body.sourceType.trim().slice(0, 64)
      : "manual"

  let sourceId: string | null = null
  if (body.sourceId != null) {
    if (typeof body.sourceId !== "string") {
      return NextResponse.json({ error: "invalid_source_id", message: "sourceId must be a string or null." }, { status: 400 })
    }
    const s = body.sourceId.trim()
    sourceId = s.length ? s.slice(0, 256) : null
  }

  const status = typeof body.status === "string" && body.status.trim() ? body.status.trim() : "open"
  if (!STATUS_RE.test(status)) {
    return NextResponse.json({ error: "invalid_status", message: "Invalid status." }, { status: 400 })
  }

  let dueDate: string | null = null
  if (body.dueDate != null && body.dueDate !== "") {
    if (typeof body.dueDate !== "string") {
      return NextResponse.json({ error: "invalid_due_date", message: "dueDate must be an ISO date string or null." }, { status: 400 })
    }
    const d = body.dueDate.trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return NextResponse.json({ error: "invalid_due_date", message: "dueDate must be YYYY-MM-DD." }, { status: 400 })
    }
    dueDate = d
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to create tasks." }, { status: 401 })
  }

  const { data: member, error: memberErr } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memberErr || !member) {
    return NextResponse.json(
      { error: "forbidden", message: "You do not have access to this organization." },
      { status: 403 },
    )
  }

  const billingGate = await requireCanCreateRecord(supabase, user.id, organizationId, "org_task")
  if (!billingGate.ok) {
    return NextResponse.json(
      { error: "billing_gate", message: billingGate.message },
      { status: billingGate.httpStatus },
    )
  }

  const { data: row, error: insertErr } = await supabase
    .from("org_tasks")
    .insert({
      organization_id: organizationId,
      title,
      description,
      source_type: sourceType,
      source_id: sourceId,
      status,
      due_date: dueDate,
    })
    .select("id, organization_id, title, description, source_type, source_id, status, due_date, created_at, updated_at")
    .single()

  if (insertErr) {
    const msg = insertErr.message ?? String(insertErr)
    const missing =
      insertErr.code === "42P01" ||
      msg.toLowerCase().includes("does not exist") ||
      msg.toLowerCase().includes("schema cache")
    if (missing) {
      return NextResponse.json(
        { error: "not_deployed", message: "Tasks storage is not available yet. Apply database migrations." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "insert_failed", message: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, task: row })
}
