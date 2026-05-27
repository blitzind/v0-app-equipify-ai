import type { GrowthRealWorldDiscoveryProvider } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Public business directory / search API abstraction.
 * Wire a compliant provider via BUSINESS_DIRECTORY_API_URL + BUSINESS_DIRECTORY_API_KEY.
 */
export function createRealWorldBusinessDirectoryProvider(_options?: {
  admin?: SupabaseClient | null
}): GrowthRealWorldDiscoveryProvider {
  return {
    provider_name: "business_directory",
    provider_type: "business_directory",
    isConfigured: () =>
      Boolean(
        process.env.BUSINESS_DIRECTORY_API_URL?.trim() &&
          process.env.BUSINESS_DIRECTORY_API_KEY?.trim(),
      ),
    discover: async () => ({
      provider_name: "business_directory",
      provider_type: "business_directory",
      status: "skipped",
      message:
        "Business directory slot reserved — set BUSINESS_DIRECTORY_API_URL and BUSINESS_DIRECTORY_API_KEY.",
      candidates: [],
    }),
  }
}
