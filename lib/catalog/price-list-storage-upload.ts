import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { PRICE_LIST_IMPORTS_BUCKET } from "@/lib/catalog/constants"
import {
  friendlyPriceListStorageUploadError,
  priceListStorageContentType,
  type PriceListFileKind,
} from "@/lib/catalog/price-list-file-validation"

export async function uploadPriceListImportFile(args: {
  svc: SupabaseClient
  storagePath: string
  buffer: Buffer
  kind: PriceListFileKind
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const contentType = priceListStorageContentType(args.kind)

  const { error } = await args.svc.storage.from(PRICE_LIST_IMPORTS_BUCKET).upload(args.storagePath, args.buffer, {
    contentType,
    cacheControl: "3600",
    upsert: true,
  })

  if (error) {
    console.warn(
      "[price-list-storage-upload]",
      JSON.stringify({
        storagePath: args.storagePath,
        contentType,
        kind: args.kind,
        error: error.message,
      }),
    )
    return {
      ok: false,
      message: friendlyPriceListStorageUploadError(error.message, contentType),
    }
  }

  return { ok: true }
}
