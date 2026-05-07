/**
 * Certificates + Portal Release Workflow — Phase 2
 *
 * Helpers for managing a technician's stored signature image. Files live in
 * the new private `equipify-signatures` storage bucket; the storage path is
 * persisted on `technicians.signature_url` so that certificate output can
 * automatically render the technician's signature when no fresh visit
 * signature was captured.
 *
 * Path scheme: {organization_id}/technicians/{technician_id}/signature-{uuid}.{ext}
 *
 * Strict rules:
 *   - tenant-scoped via `organization_id`
 *   - upload requires authenticated user (RLS enforces manager+ role)
 *   - non-throwing fallbacks for legacy DBs missing the Phase 2 column
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

export const SIGNATURES_BUCKET = "equipify-signatures" as const

const ALLOWED_SIGNATURE_MIME = new Set(["image/png", "image/jpeg", "image/webp"])

/** Bucket-level cap is 2 MiB; we duplicate the check client-side for nicer UX. */
export const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024

export function validateSignatureFile(file: File | Blob & { name?: string; type?: string }): string | null {
  const size = (file as { size?: number }).size ?? 0
  const type = (file as { type?: string }).type ?? ""
  if (size > SIGNATURE_MAX_BYTES) {
    return `Signature too large (max ${Math.round(SIGNATURE_MAX_BYTES / (1024 * 1024))} MB).`
  }
  if (!ALLOWED_SIGNATURE_MIME.has((type || "").toLowerCase())) {
    return "Allowed image types: PNG, JPEG, WEBP."
  }
  return null
}

function missingTechnicianSignatureColumn(err: PostgrestError | null | undefined): boolean {
  if (!err) return false
  const m = (err.message ?? "").toLowerCase()
  if (!m.includes("signature_url") && !m.includes("signature_updated_at")) return false
  if (err.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}

export type StoredTechnicianSignature = {
  technicianId: string
  storagePath: string | null
  updatedAt: string | null
}

/** Read the signature path for a single technician — null when not set. */
export async function loadTechnicianSignaturePath(
  supabase: SupabaseClient,
  args: { organizationId: string; technicianId: string },
): Promise<StoredTechnicianSignature | null> {
  const { organizationId, technicianId } = args
  const { data, error } = await supabase
    .from("technicians")
    .select("id, signature_url, signature_updated_at")
    .eq("organization_id", organizationId)
    .eq("id", technicianId)
    .maybeSingle()
  if (error) {
    if (missingTechnicianSignatureColumn(error)) return null
    return null
  }
  if (!data) return null
  const row = data as { id: string; signature_url: string | null; signature_updated_at: string | null }
  return {
    technicianId: row.id,
    storagePath: row.signature_url?.trim() || null,
    updatedAt: row.signature_updated_at,
  }
}

/** Bulk-load signature paths keyed by technician id. Empty map when column missing. */
export async function loadTechnicianSignaturePathsByIds(
  supabase: SupabaseClient,
  args: { organizationId: string; technicianIds: string[] },
): Promise<Map<string, StoredTechnicianSignature>> {
  const out = new Map<string, StoredTechnicianSignature>()
  const ids = [...new Set(args.technicianIds.filter(Boolean))]
  if (ids.length === 0) return out
  const { data, error } = await supabase
    .from("technicians")
    .select("id, signature_url, signature_updated_at")
    .eq("organization_id", args.organizationId)
    .in("id", ids)
  if (error) {
    if (missingTechnicianSignatureColumn(error)) return out
    return out
  }
  for (const row of (data ?? []) as Array<{
    id: string
    signature_url: string | null
    signature_updated_at: string | null
  }>) {
    out.set(row.id, {
      technicianId: row.id,
      storagePath: row.signature_url?.trim() || null,
      updatedAt: row.signature_updated_at,
    })
  }
  return out
}

export async function signedUrlForTechnicianSignature(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!storagePath) return null
  const { data, error } = await supabase.storage
    .from(SIGNATURES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/**
 * Upload (or replace) a technician's stored signature image. Removes the
 * previous object on success.
 */
export async function uploadTechnicianSignature(
  supabase: SupabaseClient,
  args: { organizationId: string; technicianId: string; file: File | Blob },
): Promise<{ storagePath: string }> {
  const file = args.file as File
  const name = (file as File).name ?? "signature.png"
  const validation = validateSignatureFile({
    size: file.size,
    type: file.type,
    name,
  } as File)
  if (validation) throw new Error(validation)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")

  const ext = (() => {
    const t = (file.type || "").toLowerCase()
    if (t === "image/png") return "png"
    if (t === "image/webp") return "webp"
    return "jpg"
  })()
  const path = `${args.organizationId}/technicians/${args.technicianId}/signature-${crypto.randomUUID()}.${ext}`

  // Look up the previous path so we can clean up after a successful replace.
  const { data: prevRow } = await supabase
    .from("technicians")
    .select("signature_url")
    .eq("organization_id", args.organizationId)
    .eq("id", args.technicianId)
    .maybeSingle()
  const previousPath = (prevRow as { signature_url?: string | null } | null)?.signature_url ?? null

  const { error: upErr } = await supabase.storage
    .from(SIGNATURES_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type })
  if (upErr) throw new Error(upErr.message)

  const { error: updErr } = await supabase
    .from("technicians")
    .update({
      signature_url: path,
      signature_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", args.organizationId)
    .eq("id", args.technicianId)

  if (updErr) {
    if (missingTechnicianSignatureColumn(updErr)) {
      // Clean up upload — the migration hasn't been applied yet.
      await supabase.storage.from(SIGNATURES_BUCKET).remove([path])
      throw new Error(
        "Technician signatures are not enabled in this database yet — apply migration 20260722120000_certificate_workflow_phase2.sql to enable uploads.",
      )
    }
    await supabase.storage.from(SIGNATURES_BUCKET).remove([path])
    throw new Error(updErr.message)
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from(SIGNATURES_BUCKET).remove([previousPath])
  }

  return { storagePath: path }
}

export async function deleteTechnicianSignature(
  supabase: SupabaseClient,
  args: { organizationId: string; technicianId: string },
): Promise<void> {
  const { data: row } = await supabase
    .from("technicians")
    .select("signature_url")
    .eq("organization_id", args.organizationId)
    .eq("id", args.technicianId)
    .maybeSingle()
  const previousPath = (row as { signature_url?: string | null } | null)?.signature_url ?? null

  const { error: updErr } = await supabase
    .from("technicians")
    .update({
      signature_url: null,
      signature_updated_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", args.organizationId)
    .eq("id", args.technicianId)
  if (updErr) {
    if (missingTechnicianSignatureColumn(updErr)) return
    throw new Error(updErr.message)
  }

  if (previousPath) {
    await supabase.storage.from(SIGNATURES_BUCKET).remove([previousPath])
  }
}
