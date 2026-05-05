import type { User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createServerSupabaseClient, getBearerAccessToken } from "@/lib/supabase/server"
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

  const supabase = await createServerSupabaseClient()
  const bearer = getBearerAccessToken(request)
  let user: User | null = null

  if (bearer) {
    const { data, error } = await supabase.auth.getUser(bearer)
    if (error || !data.user) {
      return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
    }
    user = data.user
  } else {
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser()
    user = cookieUser ?? null
  }

  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "invites_unavailable", message: "Invites are not configured on this server." }, { status: 503 })
  }

  const { data: invite, error: inviteErr } = await admin
    .from("invites")
    .select("id, email, organization_id, role, expires_at, accepted_at")
    .eq("token", inviteToken)
    .maybeSingle()
  if (inviteErr || !invite) {
    return NextResponse.json({ error: "invalid_token", message: "Invalid invite link." }, { status: 404 })
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: "invite_used", message: "This invite has already been used." }, { status: 409 })
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "invite_expired", message: "This invite has expired. Request a new one." }, { status: 410 })
  }
  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: "email_mismatch", message: "Invite email does not match the signed-in user." }, { status: 403 })
  }

  const { error: membershipErr } = await admin.from("organization_members").upsert(
    {
      organization_id: invite.organization_id,
      user_id: user.id,
      role: invite.role,
      status: "active",
      invited_by: null,
    },
    { onConflict: "organization_id,user_id" },
  )
  if (membershipErr) {
    return NextResponse.json({ error: "membership_failed", message: membershipErr.message }, { status: 400 })
  }

  await admin
    .from("profiles")
    .update({ default_organization_id: invite.organization_id, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("accepted_at", null)

  return NextResponse.json({ ok: true, organizationId: invite.organization_id })
}
