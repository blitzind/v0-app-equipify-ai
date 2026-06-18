import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseGrowthVideoStorageProvider } from "@/lib/growth/videos/providers/supabase-video-storage-provider"
import { GrowthVideoStorageService } from "@/lib/growth/videos/growth-video-storage-service"
import type { GrowthVideoStorageProvider } from "@/lib/growth/videos/growth-video-types"

export function createGrowthVideoStorageService(admin: SupabaseClient): GrowthVideoStorageService {
  const supabaseProvider = createSupabaseGrowthVideoStorageProvider(admin)
  return new GrowthVideoStorageService({
    resolveAdapter(provider: GrowthVideoStorageProvider) {
      if (provider === "supabase_storage") return supabaseProvider
      return null
    },
  })
}

export function getGrowthVideoSupabaseStorageProvider(admin: SupabaseClient) {
  return createSupabaseGrowthVideoStorageProvider(admin)
}
