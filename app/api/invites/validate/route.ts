import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"

type Body = {
  inviteToken?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request body." }, { status: 400 })
  }

  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken.trim() : ""
  if (!inviteToken) {
    return NextResponse.json({ error: "invalid_token", message: "Invalid invite link." }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "invites_unavailable", message: "Invites are not configured on this server." }, { status: 503 })
  }

  const { data: invite, error } = await admin
    .from("invites")
    .select("email, organization_id, role, expires_at, accepted_at")
    .eq("token", inviteToken)
    .maybeSingle()

  if (error || !invite) {
    return NextResponse.json({ error: "invalid_token", message: "Invalid invite link." }, { status: 404 })
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: "invite_used", message: "This invite has already been used." }, { status: 409 })
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "invite_expired", message: "This invite has expired. Request a new one." }, { status: 410 })
  }

  return NextResponse.json({
    ok: true,
    invite: {
      email: invite.email,
      organizationId: invite.organization_id,
      role: invite.role,
      expiresAt: invite.expires_at,
    },
  })
}
