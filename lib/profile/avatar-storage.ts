import type { SupabaseClient } from "@supabase/supabase-js"

export const PROFILE_AVATARS_BUCKET = "avatars" as const

/** Extract storage path after bucket from a Supabase public asset URL, or null. */
export function pathFromAvatarPublicUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl?.trim()) return null
  try {
    const u = new URL(publicUrl)
    const marker = `/object/public/${PROFILE_AVATARS_BUCKET}/`
    const i = u.pathname.indexOf(marker)
    if (i === -1) return null
    return decodeURIComponent(u.pathname.slice(i + marker.length))
  } catch {
    return null
  }
}

export async function uploadProfileAvatar(
  supabase: SupabaseClient,
  params: { targetUserId: string; file: File },
): Promise<{ publicUrl: string } | { error: string }> {
  const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase()
  const safeExt =
    ext === "jpeg" || ext === "jpg"
      ? "jpg"
      : ["png", "webp", "gif"].includes(ext)
        ? ext
        : "jpg"
  const path = `${params.targetUserId}/${crypto.randomUUID()}.${safeExt}`

  const { error: upErr } = await supabase.storage.from(PROFILE_AVATARS_BUCKET).upload(path, params.file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (upErr) {
    return { error: upErr.message }
  }

  const { data } = supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(path)
  return { publicUrl: data.publicUrl }
}

export async function removeAvatarObjectIfInBucket(
  supabase: SupabaseClient,
  previousPublicUrl: string | null | undefined,
): Promise<void> {
  const path = pathFromAvatarPublicUrl(previousPublicUrl)
  if (!path) return
  await supabase.storage.from(PROFILE_AVATARS_BUCKET).remove([path])
}
