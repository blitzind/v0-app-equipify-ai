import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import {
  registerUserPushDevice,
  unregisterAllUserPushDevicesForOrg,
  unregisterUserPushDevice,
} from "@/lib/push/register-user-push-device.server"
import { isValidExpoPushToken } from "@/lib/push/push-device-validation"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

type RegisterBody = {
  expoPushToken?: string
  platform?: string
}

type UnregisterBody = {
  expoPushToken?: string
  all?: boolean
}

/**
 * POST — register or refresh an Expo push token for the signed-in user in this workspace.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("Invalid workspace.", 400)
  }

  const session = await requireOrgMemberSession(organizationId)
  if ("error" in session) {
    return session.error
  }

  let body: RegisterBody
  try {
    body = (await request.json()) as RegisterBody
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const token = body.expoPushToken?.trim()
  if (!token || !isValidExpoPushToken(token)) {
    return jsonError("A valid Expo push token is required.", 400, "invalid_token")
  }

  const result = await registerUserPushDevice(session.supabase, {
    userId: session.userId,
    organizationId,
    expoPushToken: token,
    platform: body.platform,
  })

  if (!result.ok) {
    return jsonError("Unable to register this device for push alerts.", 500, result.code)
  }

  return NextResponse.json({ ok: true, deviceId: result.deviceId })
}

/**
 * DELETE — remove one token or all tokens for this user in the workspace (sign-out).
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("Invalid workspace.", 400)
  }

  const session = await requireOrgMemberSession(organizationId)
  if ("error" in session) {
    return session.error
  }

  let body: UnregisterBody = {}
  try {
    const text = await request.text()
    if (text.trim()) {
      body = JSON.parse(text) as UnregisterBody
    }
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  if (body.all) {
    await unregisterAllUserPushDevicesForOrg(session.supabase, {
      userId: session.userId,
      organizationId,
    })
    return NextResponse.json({ ok: true })
  }

  const token = body.expoPushToken?.trim()
  if (!token) {
    return jsonError("Provide expoPushToken or set all=true.", 400)
  }

  await unregisterUserPushDevice(session.supabase, {
    userId: session.userId,
    organizationId,
    expoPushToken: token,
  })

  return NextResponse.json({ ok: true })
}
