import { NextResponse } from "next/server"

/** Uses Buffer + multipart parsing — Node runtime. */
export const runtime = "nodejs"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { pathFromAvatarPublicUrl, PROFILE_AVATARS_BUCKET } from "@/lib/profile/avatar-storage"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; userId: string }> },
) {
  const { organizationId, userId } = await context.params

  if (!UUID_RE.test(organizationId) || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid request." }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            /* ignore read-only cookie context */
          }
        },
      },
    },
  )

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const { data: callerRow, error: callerErr } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (callerErr || !callerRow) {
    return NextResponse.json({ error: "forbidden", message: "You are not a member of this organization." }, { status: 403 })
  }

  if (callerRow.role !== "owner" && callerRow.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Only owners and admins can set profile photos for technicians." },
      { status: 403 },
    )
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      {
        error: "upload_unavailable",
        message:
          "Photo upload is not configured (missing SUPABASE_SERVICE_ROLE_KEY). Add the service role key or upload the photo later from the technician profile.",
      },
      { status: 503 },
    )
  }

  const { data: targetMem, error: memErr } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .in("status", ["active", "invited"])
    .maybeSingle()

  if (memErr || !targetMem) {
    return NextResponse.json({ error: "forbidden", message: "That person is not on this organization roster." }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Expected multipart form data." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "invalid_file", message: "Choose an image file." }, { status: 400 })
  }

  const mime = (file as File).type || "application/octet-stream"
  if (!mime.startsWith("image/") || !ALLOWED_TYPES.has(mime)) {
    return NextResponse.json(
      { error: "invalid_file", message: "Please choose an image file (JPEG, PNG, WebP, or GIF)." },
      { status: 400 },
    )
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "invalid_file", message: "Image must be 5 MB or smaller." }, { status: 400 })
  }

  const { data: profileBefore } = await admin.from("profiles").select("avatar_url").eq("id", userId).maybeSingle()
  const prevPath = pathFromAvatarPublicUrl(profileBefore?.avatar_url?.trim() ?? null)

  const originalName = typeof (file as File).name === "string" ? (file as File).name : "photo.jpg"
  const ext = (originalName.split(".").pop() ?? "jpg").toLowerCase()
  const safeExt =
    ext === "jpeg" || ext === "jpg" ? "jpg" : ["png", "webp", "gif"].includes(ext) ? ext : "jpg"
  const path = `${userId}/${crypto.randomUUID()}.${safeExt}`

  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin.storage.from(PROFILE_AVATARS_BUCKET).upload(path, buf, {
    contentType: mime,
    cacheControl: "3600",
    upsert: false,
  })

  if (upErr) {
    return NextResponse.json({ error: "upload_failed", message: upErr.message }, { status: 400 })
  }

  const { data: pub } = admin.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { error: upProf } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId)

  if (upProf) {
    await admin.storage.from(PROFILE_AVATARS_BUCKET).remove([path])
    return NextResponse.json(
      { error: "profile_update_failed", message: upProf.message ?? "Could not save profile photo URL." },
      { status: 400 },
    )
  }

  if (prevPath) {
    await admin.storage.from(PROFILE_AVATARS_BUCKET).remove([prevPath])
  }

  return NextResponse.json({ ok: true, avatarUrl: publicUrl })
}
